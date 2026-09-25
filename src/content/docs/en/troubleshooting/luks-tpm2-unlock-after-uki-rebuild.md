---
title: TPM2 automatic LUKS unlock fails after rebuilding the UKI
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-14"
verified_on: [asus-b5402]
---

If boot unexpectedly asks for the LUKS passphrase even though TPM2 automatic
unlock had been working, first check the journal for a TPM policy mismatch. On
the ASUS B5402 reference system, re-enrolling the `systemd-tpm2` token for PCR
7 restored automatic unlock, and this was verified with an actual boot.

The cause of that specific episode has not been proven: the cmdline change
coincided with the problem, but no direct before-and-after measurement of PCR 7
was taken. The relationship `cmdline change → PCR 7 change → token invalidation`
remains a hypothesis.

## 1. Symptom

- The boot process asks for the LUKS passphrase instead of unlocking
  automatically.
- The current boot journal contains:

```text
systemd-cryptsetup: TPM policy does not match current system state. \
Either system has been tampered with or policy out-of-date: Operation not permitted
```

## 2. Applicability and incident context

The fix was verified on the ASUS B5402 reference system with this boot chain:

- systemd-boot;
- a UKI generated with Dracut;
- sbctl;
- a `systemd-tpm2` token for PCR 7.

This describes the verified reference system, not a universal TPM policy.
Different firmware, PCR sets, or boot chains may behave differently.

## 3. Diagnosis

### Step 1 — check the current boot journal

Confirm the error class:

```bash
journalctl -b -u systemd-cryptsetup@cryptroot.service --no-pager
```

### Step 2 — check persistent journal history

The `Starting` / `Finished` history across boots shows when the problem
appeared and whether automatic unlock had worked before:

```bash
journalctl -u systemd-cryptsetup@cryptroot.service --no-pager -o short \
  | grep -E 'Starting Crypt|Finished Crypt|does not match'
```

In this incident, timing served as an indicator:

- `Starting → Finished` in 1–2 seconds — automatic unlock;
- 15–25 seconds and a pair of `does not match` messages — the passphrase was
  entered manually.

This is an observation on the reference system, not a universal guarantee for
every configuration.

### Step 3 — inspect the token contents

The LUKS partition on the reference system is `/dev/nvme1n1p2`. Find your own
`crypto_LUKS` partition with `lsblk -f`:

```bash
doas cryptsetup luksDump /dev/nvme1n1p2 | grep -A20 '^Tokens:'
```

Look for `tpm2-hash-pcrs` in the `Tokens:` block; it identifies the token's PCR
set.

> ⚠️ **Important nuance**: Do not spend time on these approaches (checked on
> 2026-09-14 with systemd 261 / cryptsetup 2.x): `systemd-cryptenroll` has no
> `--json` flag; cryptsetup has no `token list` action; **a token ID is not a
> slot number** (tokens are numbered separately, starting at zero); and a test
> `systemd-cryptsetup attach` of the root LUKS device from the running system
> is impossible because the device is already mounted (“already in use”). A
> reboot is the only honest way to verify automatic unlock.

## 4. What is known and what remains a hypothesis

### Confirmed observations

- Automatic unlock worked before the 2026-09-14 episode.
- After the episode, the system asked for the passphrase, and the journal
  contained `TPM policy does not match current system state`.
- Re-enrolling the token for PCR 7 restored automatic unlock; this was verified
  with an actual boot on the same day.
- Rebuilding the kernel with the same signing certificate did not itself break
  unlock: the 7.2.2 → 7.2.5 transition completed without consequences.

### PCR 7 context

The `systemd-tpm2` token is bound to a PCR value — here, PCR 7 in the sha256
bank, which the existing description associates with Secure Boot state, keys,
and certificates. A boot-chain change measured by firmware into this PCR makes
the token invalid. The document lists these changes among them:

- rewriting Secure Boot keys (`sbctl enroll-keys`) and db/dbx updates;
- changing Secure Boot mode in BIOS.

### Correlation and hypothesis

The first cmdline change since setup, on 2026-09-14, coincided with automatic
unlock failing. No direct before-and-after PCR 7 measurement was taken, so it
has not been established whether firmware measures cmdline directly into PCR
7. In the canonical model, cmdline is associated with PCR 8/12.

Thus, the confirmed fact is that unlock recovered after re-enrollment. The
coincidence with the cmdline change is a correlation. The causal chain
`cmdline change → PCR 7 change → token invalidation` has not been proven and
remains a hypothesis.

## 5. Fix

Before applying the fix:

- keep a working passphrase slot that does not rely on TPM2; it is the recovery
  path. If the passphrase is forgotten, the disk cannot be accessed;
- recovery media is not required, but may be useful.

Re-enroll the token for the current PCR state. Substitute your PCR set from
step 3; the command will ask for the current LUKS passphrase:

```bash
doas systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 \
  --wipe-slot=tpm2 /dev/nvme1n1p2
```

> **Important**: `--wipe-slot=tpm2` removes **all** TPM2 slots. This operation
> changes the LUKS2 header; slot 0's passphrase remains a working way to unlock
> the disk regardless of the outcome.

## 6. Verification

A real reboot is the only honest verification of automatic unlock in this
scenario. After reboot:

- no passphrase prompt appears;
- the journal shows `Starting → Finished` in 1–2 seconds;
- the `does not match` message is absent.

## 7. Recovery after re-enrollment

A normal rollback of the token state is not possible: the previous token was
removed by the wipe and cannot be restored; it was already unusable in any
case. If the new token does not work, unlock the disk with the slot 0
passphrase, then repeat enrollment with the same command.

## 8. How to check for correlation with a PCR change

Capture the PCR value before and after a suspected change — a cmdline change,
UKI rebuild, or sbctl update — and compare the results:

```bash
doas tpm2_pcrread sha256:7 > ~/pcr7-before.txt
# ... change the boot chain and reboot ...
doas tpm2_pcrread sha256:7 > ~/pcr7-after.txt
diff ~/pcr7-before.txt ~/pcr7-after.txt
```

The comparison shows whether PCR 7 changed between the two boots. No such
before-and-after measurement exists for the 2026-09-14 episode, so its cause
remains a hypothesis.

### Rejected alternative on ASUS B5402

A more radical alternative is a PCR signature (`--tpm2-public-key` with ukify
as the UKI generator): automatic unlock survives any rebuild, at the cost of
changing the UKI generator. This option was rejected on ASUS B5402 on
2026-09-14: incidents are rare, and recovery requires one command. This is a
decision for the reference system, not a general recommendation.

## 9. Observation history on ASUS B5402

- March 2026 — 2 errors; April — 14. The episode passed on its own, and its
  cause was not investigated.
- 2026-09-14 — the first cmdline change since setup added
  `audit_backlog_limit`. It coincided with unlock failing.
- Re-enrollment for PCR 7 restored automatic unlock; this was verified with an
  actual boot on the same day.
- No before-and-after PCR 7 measurement was taken. The causal link
  `cmdline → PCR 7` remains a hypothesis until measured as described in
  section 8.

## 10. Incident/reference environment

Gentoo, systemd 261.2, cryptsetup 2.x, systemd-boot + UKI (Dracut generator),
sbctl, firmware TPM; `systemd-tpm2` token: PCR 7, sha256, SRK. Verified on
2026-09-14. This is the environment of the verified incident, not a claim
about today's system state.

## 11. References and related docs

- [`systemd-cryptenroll(8)`](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html) — PCR policies and re-enrollment
- [`systemd-cryptsetup(8)`](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptsetup.html)
- [TPM2 PCR measurements (systemd)](https://systemd.io/TPM2_PCR_MEASUREMENTS/)
- [Kernel and boot: UKI](../../installation/systemd-uki-setup/)
- [Secure Boot and TPM2](../../installation/secure-boot-tpm/)
