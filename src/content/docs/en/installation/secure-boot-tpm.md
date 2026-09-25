---
title: "Security: Secure Boot and TPM 2.0"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Result / Trust model

What you get after the setup:

- **Secure Boot** — the firmware verifies the signatures of the trusted
  boot chain: an unsigned or tampered component fails the check.
- **TPM2** — the LUKS partition unlocks automatically as long as the chosen
  PCR policy matches the actual measured state: if the measured state at
  boot time differs from the state at the moment the token was enrolled,
  the system asks for the LUKS passphrase instead of auto-unlocking.
- **The LUKS passphrase remains the recovery path**: the TPM token adds
  convenience, but does not replace the passphrase and does not remove the
  password slot.

The level of protection is determined by the chosen PCR set and the boot
chain configuration, not by the mere fact that Secure Boot is enabled.

## Applicability

- x86 UEFI, root on LUKS2;
- systemd in the initramfs with tpm2-tss (the Dracut modules from the
  [UKI guide](../systemd-uki-setup/));
- keys and image signing via sbctl; the UKI is signed at build time.

## Before you begin

Before `sbctl create-keys`, `sbctl enroll-keys` and enrolling the TPM
token, make sure you have:

- a working LUKS passphrase — you must be able to unlock the partition
  manually;
- a recovery/live medium in case of boot problems;
- an understanding of the current Secure Boot state (check it with
  `doas sbctl status`);
- an existing signed boot path and a way back to it (a fallback UKI, see
  [Rollback in the UKI guide](../systemd-uki-setup/#rollback--fallback));
- do not clear the TPM or the firmware key databases without a separate
  reason.

## 1. Secure Boot

Keys are managed by `app-crypt/sbctl`: it creates its own key hierarchy and
writes it into the motherboard's NVRAM.

### Prepare firmware (Setup Mode)

Before generating keys, the firmware must be switched into a mode that
allows writing your own keys.

1. Enter BIOS/UEFI (usually the F2 or Del key).
2. Go to Security -> Secure Boot.
3. Find the option to delete the standard (Microsoft) keys or to switch to
   Setup Mode (often called "Reset to Setup Mode" or "Custom Mode").
4. Make sure Secure Boot is enabled but is in User Mode: Setup.
5. Save the settings and boot into Gentoo.

### Create keys

```bash
# Create your own key hierarchy
doas sbctl create-keys
```

### Enroll keys

Write your keys (and, if needed, the Microsoft keys for third-party
hardware/Option ROM support).

```bash
# Write the keys to UEFI
doas sbctl enroll-keys -m
```

> **Note**: `-m` additionally enrolls the Microsoft keys. It is a
> compatibility choice for firmwares and option ROMs of third-party devices
> (video cards, for example), not a mandatory part of the procedure: if you
> have no such hardware, you can enroll only your own keys.

### Verify signed UKI

After enrolling the keys, make sure your UKI image is signed. In the Dracut
configuration from the [UKI guide](../systemd-uki-setup/) signing happens
automatically (`uefi_secureboot_cert/key` in `90-uki.conf`), but it can be
verified manually:

```bash
doas sbctl status
doas sbctl verify
```

## 2. TPM2 and LUKS: automatic unlocking

### The model: slots, token, policy

```text
password slot = recovery
TPM token = convenience / policy-bound auto-unlock
PCR selection = policy decision
```

- **password slot** — the LUKS passphrase slot stays: it is the way to open
  the partition if the TPM is unavailable or the PCRs do not match;
- **TPM token** — a key enrolled via `systemd-cryptenroll` that unlocks
  automatically only when the selected PCRs match;
- **PCR selection** — the set of PCRs the TPM policy is bound to. These
  registers are extended by different components of the boot chain:
  firmware, boot loader, systemd-stub and others depending on the PCR.
  Choosing the set is a policy decision: the stricter it is, the fewer
  scenarios exist in which unlocking works on its own.

### How PCR registers are chosen

A key enrolled via `systemd-cryptenroll` unlocks automatically only if the
values of the selected PCRs at boot time match the values at enrollment
time. Commonly used registers:

- **PCR 0** — firmware control (Core System Firmware);
- **PCR 2** — option ROM;
- **PCR 4** — the boot loader (for a UKI, the image itself);
- **PCR 7** — Secure Boot state: policy, keys, certificates;
- **PCR 8/12** — the kernel command line and boot parameters.

The wider the set, the stricter the policy — and the more often the token
has to be re-enrolled: any change to the measured content (a BIOS update,
rewriting the Secure Boot keys, rebuilding the UKI with a changed cmdline)
invalidates it.

A common "strict" variant is `0+7`: unlocking becomes bound to both the
firmware and the Secure Boot state.

> ⚠️ **Important nuance**: do not assume the actual measurement path of a
> particular machine from the expected scheme alone. If PCR behavior
> differs from expectations, compare the values and the TPM event log
> before and after a controlled change (snapshots:
> `tpm2_pcrread sha256:<N>`). For finding the actual composition, see
> [troubleshooting: TPM2 unlock after a UKI rebuild](../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/).

### Binding (systemd-cryptenroll)

Find your encrypted partition (for example, `/dev/nvme0n1p3`) and bind it
with the selected PCR set:

```bash
# Generic example: PCR 0 + 7
doas systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=0+7 /dev/nvme0n1p3

# The set verified on the reference asus-b5402 machine: PCR 7 only
doas systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 /dev/nvme0n1p3
```

> **Important**: enrolling a TPM token does not remove the passphrase slot —
> the passphrase stays as the way to open the partition if the TPM breaks
> or the PCRs change. After enrollment, on the next boot `systemd-cryptsetup`
> in the initramfs (added by Dracut) talks to the TPM, checks the selected
> PCRs and hands over the key for decryption.

### The reference machine: ASUS B5402

The policy and observations of this particular machine are not a universal
recommendation. The timeline, diagnostics and the re-enrollment procedure
are in [troubleshooting: TPM2 unlock after a UKI rebuild](../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/).

- **Machine policy**: a single **PCR 7**; the token was re-enrolled and
  verified by a real boot on 2026-09-14.
- **Observation (2026-09-14)**: a cmdline change coincided with a PCR
  mismatch and the loss of auto-unlock; re-enrolling restored it. In
  March/April there were unlock failures whose cause was not investigated.
- **Hypothesis (not proven)**: one of the boot chain changes also affects
  the PCR 7 value. The firmware's exact measurement path is unconfirmed: no
  direct before/after measurement of `tpm2_pcrread sha256:7` was taken for
  the cmdline change.
- **State as of 2026-09-22**: `sbctl status` — Setup Mode Disabled, Secure
  Boot Enabled, vendor keys microsoft; `sbctl verify` — all images present
  in the ESP are signed (including the current UKI and systemd-boot).

## Finalization

1. Reboot into BIOS.
2. Make sure Secure Boot is active and has moved from Setup Mode to User
   Mode (Deployed).
3. Boot the system. Entering the LUKS passphrase will no longer be required
   as long as the boot proceeds normally.

## Verification

These checks are performed manually after the setup, as a statement of
fact; there is no need to run them as a test during the setup.

1. **Secure Boot**: `doas sbctl status` — Secure Boot Enabled, Setup Mode
   Disabled (User Mode).
2. **UKI signature**: `doas sbctl verify` — all images in the ESP are
   signed.
3. **TPM token**: `doas cryptsetup luksDump /dev/nvme0n1p3 | grep -A20 '^Tokens:'`
   (substitute your LUKS partition) — the `Tokens:` block contains a token
   with `tpm2-hash-pcrs`.
4. **A successful reboot**: the system booted without asking for the LUKS
   passphrase; the only honest check of auto-unlocking is a real boot.
5. **The recovery passphrase still works**: the passphrase slot is visible
   in `luksDump` and is not removed by enrollment; in practice the
   passphrase is requested and accepted when the PCRs do not match.

## Troubleshooting / Recovery

- Auto-unlock disappeared after a UKI rebuild or a cmdline change —
  diagnostics (PCR snapshots, the `systemd-cryptsetup` journal) and token
  re-enrollment: [troubleshooting: TPM2 unlock after a UKI rebuild](../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/).
- The system does not boot after changing the keys or the image — the
  fallback UKI in the systemd-boot menu and a recovery medium; the rollback
  order is in [Rollback in the UKI guide](../systemd-uki-setup/#rollback--fallback).

## References

- [`systemd-cryptenroll(8)`](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html) — PCR policies, enrolling the TPM2 token
- [TPM2 PCR measurements (systemd)](https://systemd.io/TPM2_PCR_MEASUREMENTS/) — the canonical PCR composition
- [sbctl](https://github.com/Foxboron/sbctl) — Secure Boot key management
- [troubleshooting: TPM2 unlock after a UKI rebuild](../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/) — reference machine observations
