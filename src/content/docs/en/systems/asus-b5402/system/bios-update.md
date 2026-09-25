---
title: Updating BIOS/UEFI on ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-09-09"
verified_on: [asus-b5402]
---

## Current result

The BIOS was successfully updated from version `313` to `314` through ASUS
Firmware Update/EZ Flash (2026-09-09). The system uses Secure Boot with
`sbctl` keys, LUKS2, and automatic unlocking through TPM2.

- BIOS: `B5402CBA.314`; the DMI image date is `06/02/2026`.
- Secure Boot: restored and enabled after the update; Setup Mode is disabled.
- TPM2/LUKS auto-unlock: works after the update — the root LUKS partition
  unlocked automatically (`/dev/tpmrm0`).
- There are no failed systemd units.

An important detail of this machine: with Secure Boot enabled and custom
`sbctl` keys, ASUS Firmware Update rejected the official image even though the
checksum, model, and file version were correct. The update worked only after
Secure Boot was temporarily disabled (see [Firmware update](#firmware-update)).
This is an observation for this machine, not a universal property of ASUS
firmware.

## Prerequisites

Before changing Secure Boot, check the fallback method for unlocking the root
LUKS partition:

```bash
doas cryptsetup open --test-passphrase /dev/nvme1n1p2
```

The command must exit with code `0`. Do not store the passphrase or recovery
key in the repository.

The laptop must be connected to AC power. ASUS requires at least 20% battery
charge; before this update it was 80%.

## Image verification

Download **BIOS for ASUS EZ Flash Utility** for the `B5402CBA` model, not the
Windows installer.

For the `B5402CBAAS314.zip` archive:

```bash
sha256sum "$HOME/Downloads/B5402CBAAS314.zip"
unzip -t "$HOME/Downloads/B5402CBAAS314.zip"
unzip -l "$HOME/Downloads/B5402CBAAS314.zip"
```

Verified SHA-256 of the archive:

```text
bfb12fb5b44a5f2d4b0a47be221802a66e50536bbf43850c20a9541a4d79c48d
```

The archive must contain one file, `B5402CBAAS.314`. Its internal model
identifier is `B5402CBA`.

## USB preparation

The USB drive used had three partitions:

- the main Ventoy partition — exFAT;
- the `VTOYEFI` service partition;
- a separate 1 GiB FAT32 partition for firmware files.

`/dev/sdX` names can change. Identify the FAT32 partition again before
mounting it:

```bash
lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS,RO,RM
```

In the verified update it was `/dev/sda3` — the name can differ in another
session, so use `lsblk` as the reference:

```bash
doas mkdir -p /mnt/bios-usb
doas mount -o rw,nosuid,nodev,noexec,uid=$(id -u),gid=$(id -g),umask=022 \
  /dev/sda3 /mnt/bios-usb
findmnt -no SOURCE,FSTYPE,OPTIONS /mnt/bios-usb
```

The `findmnt` output must include the `rw` option. If the partition was
mounted read-only:

```bash
doas mount -o remount,rw /mnt/bios-usb
```

Extract and copy the image:

```bash
mkdir -p /tmp/b5402-bios-314
unzip -j "$HOME/Downloads/B5402CBAAS314.zip" B5402CBAAS.314 \
  -d /tmp/b5402-bios-314
cp /tmp/b5402-bios-314/B5402CBAAS.314 /mnt/bios-usb/
sync -f /mnt/bios-usb
cmp /tmp/b5402-bios-314/B5402CBAAS.314 \
  /mnt/bios-usb/B5402CBAAS.314
doas umount /mnt/bios-usb
```

`cmp` must produce no differences. Verified SHA-256 of the extracted file:

```text
fba0d81fe3fd1739bddf798f2acc1c5704be56c180830fbc65ffd899f079f4c7
```

## Firmware update

With Secure Boot enabled, ASUS Firmware Update rejected the official image,
reporting that the selected file was not suitable for the BIOS update. The
checksum, model, and file version were correct.

On this system, the reason was the check with Secure Boot enabled and custom
`sbctl` keys. This sequence worked:

1. Enter UEFI with `F2`.
2. Disable Secure Boot only.
3. Do not clear the TPM, PK, KEK, `db`, or `dbx`, and do not load UEFI default
   settings.
4. Save the settings and reboot.
5. Enter UEFI again, open `Advanced` → `ASUS Firmware Update` or
   `ASUS EZ Flash`, and select `B5402CBAAS.314` on the FAT32 partition.
6. Confirm the update and do not disconnect power until the automatic reboot.
7. After the update, enable Secure Boot again and boot the system.

## Post-update verification

```bash
cat /sys/class/dmi/id/bios_version
cat /sys/class/dmi/id/bios_date
sbctl status
systemd-cryptenroll --tpm2-device=list
systemctl --failed
```

Verification result on 2026-09-09:

- BIOS: `B5402CBA.314`;
- DMI image date: `06/02/2026`;
- Secure Boot enabled; Setup Mode disabled;
- TPM2 is detected as `/dev/tpmrm0`;
- the root LUKS partition unlocked automatically through TPM2;
- there are no failed systemd units.

## Recovery notes

If TPM2 unlocking does not work, use the LUKS passphrase verified in advance.
If firmware rejects the signed UKI after Secure Boot is enabled, temporarily
disable Secure Boot, boot the system, and check the keys and signatures with
`sbctl`. Do not clear the TPM or the UEFI key databases.

## Sources

- [BIOS for ASUS ExpertBook B5402CBA](https://www.asus.com/us/supportonly/b5402cba/helpdesk_bios/)
- [Updating BIOS through ASUS Firmware Update/EZ Flash](https://www.asus.com/support/faq/1008859/)
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html)
