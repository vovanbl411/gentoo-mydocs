---
title: "Kernel and boot: Unified Kernel Image (UKI)"
kind: guide
scope: general
status: current
last_verified: "2026-09-13"
verified_on: [asus-b5402]
---

## Goal / Result

This guide builds a UKI — a single signed EFI image that combines the
kernel, microcode, initramfs and the kernel command line — and hooks it up
to systemd-boot.

The boot path after setup:

```text
systemd-boot
→ signed UKI
→ kernel + microcode + initramfs + cmdline
→ LUKS/Btrfs root
```

Roles in the main chain:

- **Dracut = UKI generator** — builds the initramfs and packs it together
  with the kernel and cmdline into the UKI file, then signs it;
- **systemd-boot = loader** — finds Type #2 UKIs in `EFI/Linux` on the ESP
  and loads them;
- **sbctl = signing/verification** — Secure Boot keys and signature
  verification (creating keys and enrolling them is covered in
  [Security: Secure Boot and TPM 2.0](../secure-boot-tpm/)).

`ukify` is an alternative UKI generator, not a stage of the main chain; it
is covered in the “Alternative path: ukify” section.

## Applicability

- Gentoo with `sys-kernel/gentoo-kernel` (savedconfig) and systemd;
- the initramfs and the UKI are built by Dracut;
- the example cmdline assumes a LUKS2 root with Btrfs inside;
- signing is done with sbctl keys.

The actual state of the reference ASUS B5402 is recorded in
[the system section](../../systems/asus-b5402/system/boot-and-portage/).

## Prerequisites / Recovery prerequisites

Changing the boot chain can leave the system unbootable. Before you start,
make sure you have:

- a working way to unlock LUKS (the passphrase);
- a recovery/live medium;
- a saved working UKI (a fallback image) in the ESP that you can return to
  from the systemd-boot menu;
- an understanding of your ESP: which partition it is and where systemd-boot
  and the UKIs live in it (`EFI/Linux`).

## Main procedure: Dracut generates the UKI

```text
Recommended/example path in this guide: Dracut generates the UKI
Alternative: ukify generates the UKI — separate section below
```

The main chain is configured linearly: kernel → Dracut → cmdline →
installkernel → systemd-boot. Config files of the alternative path
(`/etc/kernel/uki.conf`) are not part of the main procedure.

### 1. Building the kernel (gentoo-kernel)

The example uses `sys-kernel/gentoo-kernel` with `savedconfig` support.

- Flags: make sure dist-kernel and savedconfig are enabled for the kernel.
- Config path: `/etc/portage/savedconfig/sys-kernel/gentoo-kernel-<version>`.

When the kernel is updated, Portage automatically picks up your optimized
config and starts the build.

### 2. Dracut configuration (initramfs and UKI)

Dracut builds the initramfs and can pack it together with the kernel into
a UKI file. The configuration is split into modules for easier maintenance.
Below is the path with Dracut as the UKI generator; the alternative `ukify`
path is described separately.

> **Note**: the optional `dracut-cpio` USE flag enables a multi-threaded
> archive generator instead of the `find | cpio` pipeline — the initramfs
> builds noticeably faster. It does not affect the image contents.

#### Global settings (`/etc/dracut.conf.d/00-global.conf`)

Minimize the image size and enable Intel microcode.

```conf
hostonly="yes"
hostonly_mode="strict"
compress="zstd"
early_microcode="yes"
```

#### Drivers and modules (`10-drivers.conf`, `20-modules.conf`)

The example enables `i915`, NVMe and the components needed for encryption.
`xe` requires a separate compatibility check.

```conf
# Target Xe driver (disabled until the switch)
#force_drivers+=" xe "

# Current i915 driver
add_drivers+=" i915 "

add_drivers+=" nvme "

# systemd in the initramfs is required for TPM2 integration
add_dracutmodules+=" systemd tpm2-tss crypt btrfs "
omit_dracutmodules+=" network nfs "
```

> **Tip**: until `xe` is stable on your hardware, keep `force_drivers`
> commented out and add `i915` explicitly via `add_drivers`.

> **Important**: `hostonly_mode="strict"` suits an unchanging boot layout,
> but after changing the controller, the disk or a required driver the UKI
> must be rebuilt. Do not disable networking in the initramfs if the root
> filesystem or LUKS unlocking requires the network.

#### UKI and Secure Boot settings (90-uki.conf)

This file is responsible for creating the final EFI file and signing it
automatically.

```conf
uefi="yes"

# Automatic image signing with sbctl keys
uefi_secureboot_cert="/var/lib/sbctl/keys/db/db.pem"
uefi_secureboot_key="/var/lib/sbctl/keys/db/db.key"
```

### 3. Kernel command line (CMDLINE)

All parameters are passed to the kernel inside the UKI. When the UKI is
signed, they become part of the verified EFI image.

File: `/etc/dracut.conf.d/90-uki.conf` (the kernel_cmdline variable)

| Parameter | Description |
|----------|-------------|
| `rd.luks.uuid` | UUID of your encrypted partition. |
| `rd.luks.name=...=cryptroot` | Mapped device name for the root LUKS. |
| `rd.luks.options=tpm2-device=auto,discard` | Automatic TPM2 discovery + `discard` for TRIM. |
| `root=UUID=...` | UUID of the filesystem inside the LUKS container. |
| `rootflags=subvol=@` | Mounting a specific Btrfs subvolume. |
| `rootfstype=btrfs` | Root filesystem type. |
| `rw` | Mounting the root read-write. |
| `quiet` | Suppressing extra boot output. |
| `audit=1` | Enabling kernel auditing. |
| `apparmor=1` | Explicitly enabling AppArmor. |
| `lsm=landlock,lockdown,yama,integrity,apparmor,bpf` | The list of active security modules. |

`security=apparmor` is not needed here: with an explicit `lsm=` the kernel
uses the order from that parameter. After changing the cmdline, rebuild and
verify the UKI, since the string is part of the signed image.

### 4. installkernel: generators and plugins

On Gentoo the build path is chosen by `sys-kernel/installkernel` via
`/etc/kernel/install.conf`.

For the main path, specify a single UKI generator — Dracut:

```conf
# /etc/kernel/install.conf
layout=uki
initrd_generator=dracut
uki_generator=dracut
```

With systemd 261, the `52-dracut.install` plugin in this configuration runs
`dracut --uefi --no-ukify` and creates `uki.efi` in the staging directory.
`90-uki-copy.install` moves it to `EFI/Linux`, and `91-sbctl.install` hands
the final file over to `sbctl sign`. Dracut uses the
`uefi_secureboot_cert` and `uefi_secureboot_key` values from `90-uki.conf`.

Important: with `uki_generator=dracut`, the file `/etc/kernel/uki.conf` is
not involved in the generation path — the `60-ukify.install` plugin exits
when `uki_generator` is not `ukify`.

For the kernel to automatically turn into a UKI and land in the ESP after
a build, `sys-kernel/installkernel` needs the USE flags
`systemd-boot ukify dracut uki`:

```makefile
# /etc/portage/package.use/installkernel
sys-kernel/installkernel systemd-boot ukify dracut uki -grub -efistub -ugrd -refind
```

### 5. systemd-boot (loader)

systemd-boot is the loader of the main chain: it automatically finds
Type #2 UKIs in `EFI/Linux` on the ESP, where the image has already been
copied by the `90-uki-copy.install` plugin.

## Alternative path: ukify generates the UKI

```text
Alternative: ukify generates the UKI
```

`ukify` is an alternative, not an extra stage on top of the Dracut UKI
generator. For it, keep Dracut as the initramfs generator but switch the
UKI generator:

```conf
# /etc/kernel/install.conf
layout=uki
initrd_generator=dracut
uki_generator=ukify
```

In this mode `52-dracut.install` creates only the initramfs, with
`--no-uefi`. Then `60-ukify.install` reads `/etc/kernel/uki.conf`, combines
the kernel, initramfs and cmdline into `uki.efi`, after which the same
`90-uki-copy.install` installs the image into `EFI/Linux`. The plugin takes
the cmdline parameters from `/etc/kernel/cmdline`, or from `/proc/cmdline`
if the file is missing.

In `ukify` mode, signing keys are managed by `/etc/kernel/uki.conf`:

```ini
# /etc/kernel/uki.conf
[UKI]
SecureBootPrivateKey=/var/lib/sbctl/keys/db/db.key
SecureBootCertificate=/var/lib/sbctl/keys/db/db.pem
```

Do not switch the generator without a working LUKS passphrase and a boot
medium. A new UKI changes the measured boot chain; after switching, verify
Secure Boot and automatic TPM2 unlocking before deleting fallback images.

## Maintenance: rebuilding the UKI

After changing the configuration, rebuild the UKI via `kernel-install` so
that all install plugins run, including copying and signature verification:

```bash
KERNEL_VERSION="$(uname -r)"
doas kernel-install add "$KERNEL_VERSION" \
  "/usr/lib/modules/$KERNEL_VERSION/vmlinuz"
```

## Verification

Before rebooting, check the selected image:

```bash
doas bootctl list
UKI_PATH="/boot/EFI/Linux/<name-from-bootctl-list>.efi"
doas sbctl verify "$UKI_PATH"
doas ukify inspect "$UKI_PATH"
```

After booting, check the actual cmdline string and the LSM set:

```bash
cat /proc/cmdline
cat /sys/kernel/security/lsm
```

## Rollback / Fallback

If the new UKI does not boot or TPM2 does not unlock LUKS automatically,
pick the saved signed fallback UKI from the systemd-boot menu and restore
the working configuration before rebuilding. Do not delete fallback images
until the new chain has been verified.

For diagnosing broken TPM2 unlocking (a PCR mismatch, re-enrolling the
token), see [troubleshooting: TPM2 unlock after a UKI
rebuild](../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/).

## References

- [systemd kernel-install](https://www.freedesktop.org/software/systemd/man/latest/kernel-install.html)
- [systemd ukify](https://www.freedesktop.org/software/systemd/man/latest/ukify.html)
- [Dracut](https://man7.org/linux/man-pages/man8/dracut.8.html)
- [Linux kernel parameters](https://www.kernel.org/doc/html/latest/admin-guide/kernel-parameters.html)
