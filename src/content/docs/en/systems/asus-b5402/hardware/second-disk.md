---
title: "Second disk: backups and additional storage"
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Status

**PLAN — NOT APPLIED** (verified by the 2026-09-22 audit).

Current machine state:

- `nvme0n1` is a single LUKS partition containing the old Arch Linux and is not open;
- the new backup/data layout on the second disk has not been created;
- no `/etc/crypttab` exists for it;
- btrbk/borg timers are not configured;
- Arch UKIs remain in the ESP.

The plan is to use the second NVMe (`nvme0n1`, previously Arch Linux) as
encrypted storage for **system and configuration backups** plus
**additional data space**. There is no RAID and no change to the critical boot
path.

Before applying it, check device names, mount points, and the state of both
disks again.

## Applicability

The machine already runs Gentoo on `nvme1n1` (LUKS2 + TPM2 + UKI + Btrfs) and
has a second physical disk, `nvme0n1`, intended for backups and data.

Context: see [installation/systemd-uki-setup](../../../../installation/systemd-uki-setup/) and [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/) for the boot stack. Btrfs conventions are in [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/).

## 1. Target design

Everything in this section describes the state **after the plan is applied**,
rather than the current machine (the current state is in Status above).

### Key principles

- **The second disk is NOT in the initramfs.** It is opened through systemd `/etc/crypttab` only after the rootfs is booted. Do **not** change Dracut/UKI/`rd.luks.*`/sbctl. The critical boot path remains equally reliable.
- **One LUKS2 + TPM2 (PCR 7)** uses the same TPM and PCR set as the first disk (PCR 7 is the selected policy of the first disk; the 2026-09-14 episode is described in §6). Automatic unlock at boot.
- **Soft-cold for backups**: `@backup` is mounted with `noauto`; a systemd unit mounts it only for the duration of a backup and unmounts it afterwards. This protects against ransomware in userspace (without root, `/mnt/backup` is inaccessible).
- **`@data` is hot**: it is always mounted at `/home/<username>/data` as working storage.
- **btrbk for the system** (atomic Btrfs snapshots of `@`), **borg for `/home` and `/etc`** (file-level restore, deduplication, encryption, exclude patterns).

### Target layout

```text
/dev/nvme0n1 (whole disk, new partition table)
└─ nvme0n1p1   LUKS2 (TPM2 PCR 7)   →  /dev/mapper/cryptdata
   └─ Btrfs, label "backup", compress=zstd:3
      ├─ @backup   → /mnt/backup            (noauto, soft-cold)
      │   ├─ gentoo/      ← btrbk: incremental snapshots of @ (Gentoo root)
      │   ├─ home.borg    ← borg repository (encrypted, /home/<username>)
      │   └─ etc.borg     ← borg repository (/etc)
      └─ @data     → /home/<username>/data    (hot, always mounted)
```

> ⚠️ **Important soft-cold nuance**: with one LUKS container, it remains open for as long as the system runs (for the hot `@data`). Protection is at the mount-point level: `/mnt/backup` is not mounted, so a userspace process cannot access the backups. To protect even against root, use **hard-cold** (two separate LUKS containers on two disk partitions); see §14.

### What is backed up and what is not

| Source | Destination | Tool | Excluded data |
|--------|-------------|------|---------------|
| `@` (Gentoo root: OS + `/etc`) | `/mnt/backup/gentoo/` | btrbk (send/receive) | caches in separate subvols are not part of `@` |
| `/home/<username>` | `/mnt/backup/home.borg` | borg | `.cache`, `llvm-project`, `llvm-for-bolt-perf`, `Downloads`, `.steam`, `*.venv`, `__pycache__` |
| `/etc` | `/mnt/backup/etc.borg` | borg | `—` (file-level restore) |
| `~/.ssh`, `~/.gnupg`, tokens | inside `home.borg` | borg (encrypted) | — |

**Not backed up** (reproducible): `@var_cache`, `@distfiles`, `@var_log` (optional), `@portage_tree` (`emerge --sync`), `@portage_tmp`, `@ccache`, `/.snapshots` (local protection, not a backup).

---

## 2. Prerequisites

```bash
# A system snapshot for rollback (just in case)
doas snapper -c root create -d "before second disk setup"

# Backup tools
doas emerge -av app-backup/btrbk app-backup/borgbackup

# Check: the old Arch LUKS passphrase is known (to rescue data)
# Check: the ESP is shared and lives on the Gentoo disk (nvme1n1p1 → /boot)
lsblk -o NAME,FSTYPE,MOUNTPOINTS,PARTTYPENAME /dev/nvme1n1
```

---

## 3. Rescue Arch data

`nvme0n1p1` currently holds the Arch LUKS partition (`cryptarch`, UUID `<arch-luks-uuid>`). Before erasing it, open it read-only and recover what is needed.

```bash
# Open Arch LUKS read-only
doas cryptsetup open --type luks --readonly /dev/nvme0n1p1 cryptarch-ro

# The Arch root is subvol @ (see rd.luks...rootflags=subvol=@ in bootctl)
doas mkdir -p /mnt/arch
doas mount -o ro,subvol=/@ /dev/mapper/cryptarch-ro /mnt/arch

# Inspect its contents
ls -la /mnt/arch
ls -la /mnt/arch/home   # Arch user
```

Copy valuable data to a temporary location on the first disk:

```bash
mkdir -p ~/arch-rescue
# Secrets (careful: delete ~/arch-rescue or encrypt it after transfer)
cp -a /mnt/arch/etc/ssh                ~/arch-rescue/etc-ssh 2>/dev/null
# Find the Arch user's home directory and recover ~/.ssh, ~/.gnupg, dotfiles, projects
# cp -a /mnt/arch/home/<arch-user>/.ssh   ~/arch-rescue/
# cp -a /mnt/arch/home/<arch-user>/.gnupg ~/arch-rescue/
# cp -a /mnt/arch/etc                     ~/arch-rescue/etc-arch
```

Close it:

```bash
doas umount /mnt/arch
doas cryptsetup close cryptarch-ro
```

> **Important**: `~/arch-rescue/` contains secrets. After setup is complete, either delete it or move it into `home.borg` and wipe the originals (`shred -u`).

---

## 4. Remove Arch UKIs from the ESP

Arch bootloaders (`arch-linux-cachyos.efi`, `arch-linux.efi`) are in the **shared ESP** at `/boot/EFI/Linux/`. systemd-boot detects them automatically through BLS Type #2, so there is no separate NVRAM entry and no need to clean up `efibootmgr`.

```bash
# View Arch UKIs in the ESP
ls -l /boot/EFI/Linux/arch-linux*.efi

# Remove them
doas rm -v /boot/EFI/Linux/arch-linux*.efi

# Check that systemd-boot no longer sees Arch
doas bootctl list | grep -i arch   # must be empty
```

---

## 5. Repartition nvme0n1

> ⚠️ **Destructive**: this erases everything on `nvme0n1`. Make sure Arch data was rescued (§3).

```bash
# Ensure that cryptarch is closed
doas cryptsetup status cryptarch 2>/dev/null
doas cryptsetup status cryptarch-ro 2>/dev/null

# Clear disk signatures
doas wipefs -a /dev/nvme0n1

# New GPT with one partition (type 8304 = Linux root x86-64)
doas sgdisk -Z /dev/nvme0n1
doas sgdisk -n 1:0:0 -t 1:8304 /dev/nvme0n1

# Check
doas sgdisk -p /dev/nvme0n1
```

---

## 6. LUKS2 + TPM2

```bash
# Create LUKS2 (the passphrase is a fallback slot for TPM failure/PCR changes)
doas cryptsetup luksFormat --type luks2 --pbkdf argon2id /dev/nvme0n1p1

# Open it
doas cryptsetup open --type luks /dev/nvme0n1p1 cryptdata

# Enroll TPM2: PCR 7, the same set as the first disk
doas systemd-cryptenroll --wipe-slot=tpm2 --tpm2-device=auto --tpm2-pcrs=7 /dev/nvme0n1p1

# Check slots: there must be a passphrase slot (0) and TPM2
doas cryptsetup luksDump /dev/nvme0n1p1

# Record the LUKS UUID for /etc/crypttab
doas blkid -s UUID -o value /dev/nvme0n1p1
```

> ⚠️ **Important**: keep the **passphrase slot**. If the TPM dies or PCRs change (a firmware update or Secure Boot remount), the disk can never be opened without its passphrase. Compare the first disk: `doas cryptsetup luksDump /dev/nvme1n1p2` must also show a passphrase slot beside TPM.

> ⚠️ **Important nuance**: use PCR 7 specifically, rather than an extended set such as `0+7`. On this machine, even with the minimal set, a cmdline change (2026-09-14) coincided with a PCR mismatch and loss of unlock; re-enrollment restored operation. The exact firmware measurement path has not been confirmed (there was no direct before-and-after PCR 7 measurement). See [troubleshooting: TPM2 unlock after rebuilding the UKI](../../../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/) for the timeline and re-enrollment procedure. If you choose another set, synchronize `tpm2-pcrs=` in `/etc/crypttab` (§8).

---

## 7. Btrfs + subvolumes

```bash
# Create the filesystem (single profile, no RAID; this is the default for one device)
doas mkfs.btrfs -L backup /dev/mapper/cryptdata

# Temporarily mount the filesystem root to create subvols
doas mkdir -p /mnt/cryptdata-root
doas mount /dev/mapper/cryptdata /mnt/cryptdata-root

# Create subvols (flat layout, as on the first disk)
doas btrfs subvolume create /mnt/cryptdata-root/@backup
doas btrfs subvolume create /mnt/cryptdata-root/@data

# Record the Btrfs UUID for /etc/fstab
doas blkid -s UUID -o value /dev/mapper/cryptdata

# Unmount the temporary mount
doas umount /mnt/cryptdata-root
```

---

## 8. /etc/crypttab and /etc/fstab

Mount points:

```bash
doas mkdir -p /home/<username>/data /mnt/backup
doas chown <username>:<username> /home/<username>/data
```

File: `/etc/crypttab` (create it if absent):

```text
# <name>      <device>                <password>   <options>
cryptdata      UUID=<LUKS-UUID>        none         luks,tpm2-device=auto,tpm2-pcrs=7
```

> `<LUKS-UUID>` is the UUID from `blkid -s UUID -o value /dev/nvme0n1p1` (§6). `tpm2-pcrs=` is specified explicitly and matches the set in `systemd-cryptenroll` in §6, so unlock does not depend on crypttab defaults.

File: `/etc/fstab`: add these lines (following the style of the existing Btrfs entries):

```text
# Second disk (nvme0n1) — data (hot)
UUID=<BTRFS-UUID>  /home/<username>/data  btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@data     0 0

# Second disk — backup target (soft-cold, noauto)
UUID=<BTRFS-UUID>  /mnt/backup          btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@backup,noauto  0 0
```

> `<BTRFS-UUID>` is the UUID from `blkid -s UUID -o value /dev/mapper/cryptdata` (§7).

Activate and check:

```bash
doas systemctl daemon-reload

# Reload crypttab and open the second LUKS through TPM
doas systemctl start systemd-cryptsetup@cryptdata

# Mount hot data (do NOT mount backup: noauto)
doas mount /home/<username>/data

# Check
lsblk -o NAME,FSTYPE,MOUNTPOINTS /dev/nvme0n1
mount | grep -E 'cryptdata|/home/<username>/data'
```

---

## 9. btrbk: backup of the Gentoo root

btrbk makes incremental `btrfs send/receive` snapshots of subvol `@` (the Gentoo root) on the second disk. The source is the first disk (`/`); the target is `/mnt/backup/gentoo`.

File: `/etc/btrbk/btrbk.conf`:

```text
# Retention
snapshot_preserve_min   latest
snapshot_preserve       14d 4w 6m
target_preserve_min     latest
target_preserve         14d 4w 6m

# Logging
loglevel                info
lockfile                /var/lock/btrbk.lock

# Source: Gentoo root (Btrfs with subvol @)
volume /
  subvolume @
    target send-receive /mnt/backup/gentoo
```

Check the configuration (without writing):

```bash
doas btrbk dryrun
doas btrbk config print
```

---

## 10. borg: backup of /home and /etc

### 10.1. Initialize repositories

```bash
# Mount the backup target manually (it is noauto)
doas mount /mnt/backup

# Create repository directories (owned by root)
doas mkdir -p /mnt/backup/home.borg /mnt/backup/etc.borg

# Initialize with repokey encryption (the key is in the repository and protected by the passphrase)
doas borg init --encryption=repokey /mnt/backup/home.borg
doas borg init --encryption=repokey /mnt/backup/etc.borg

# Save the repository passphrase in a password manager!
```

> ⚠️ **Important**: the borg repository passphrase and key are **critical** for recovery. Without them, the backup is useless. Store the passphrase in a password manager. With `repokey`, the key is inside the repository (on the encrypted disk); restore requires the passphrase plus access to `/mnt/backup`.

### 10.2. Backup script

File: `/usr/local/bin/borg-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_HOME=/mnt/backup/home.borg
REPO_ETC=/mnt/backup/etc.borg
BACKUP_TARGET=/mnt/backup

# Soft-cold: mount target, unmount it at the end
mount "$BACKUP_TARGET" 2>/dev/null || true
trap 'umount "$BACKUP_TARGET" 2>/dev/null || true' EXIT

ARCHIVE_HOME="home-$(date +%Y-%m-%d_%H:%M)"
ARCHIVE_ETC="etc-$(date +%Y-%m-%d_%H:%M)"

# /home/<username> with exclude patterns
borg create --stats --progress \
  --exclude '/home/<username>/.cache' \
  --exclude '/home/<username>/llvm-project' \
  --exclude '/home/<username>/llvm-for-bolt-perf' \
  --exclude '/home/<username>/Downloads' \
  --exclude '/home/<username>/.steam' \
  --exclude '/home/<username>/.local/share/Trash' \
  --exclude '*/.venv' \
  --exclude '*/__pycache__' \
  --exclude '*/node_modules' \
  --exclude-caches \
  --exclude '*.pyc' \
  "${REPO_HOME}::${ARCHIVE_HOME}" \
  /home/<username>

# /etc
borg create --stats \
  --exclude-caches \
  "${REPO_ETC}::${ARCHIVE_ETC}" \
  /etc

# Retention + compaction
for repo in "$REPO_HOME" "$REPO_ETC"; do
  borg prune --keep-daily 14 --keep-weekly 4 --keep-monthly 6 "$repo"
  borg compact "$repo"
done
```

Make it executable:

```bash
doas chmod +x /usr/local/bin/borg-backup.sh
```

> ⚠️ **Secrets**: `~/.ssh`, `~/.gnupg`, `~/.ansible_vault_pass`, `~/.mcp-auth`, `~/.codex`, `.claude.json`, and `~/.mozilla` are included in `home.borg`. This is acceptable because the repository is **encrypted** and on an **encrypted disk**. Never copy them to public git or cloud storage.

### 10.3. Test the first backup

```bash
doas /usr/local/bin/borg-backup.sh
doas borg list /mnt/backup/home.borg
doas borg list /mnt/backup/etc.borg
```

---

## 11. Automation: systemd units and timers

### 11.1. btrbk

File: `/etc/systemd/system/btrbk-backup.service`:

```ini
[Unit]
Description=btrbk backup of Gentoo root subvol @
Wants=mnt-backup.mount
After=mnt-backup.mount

[Service]
Type=oneshot
ExecStartPre=/usr/bin/mount /mnt/backup
ExecStart=/usr/sbin/btrbk run
ExecStopPost=/usr/bin/umount /mnt/backup
IOSchedulingClass=idle
Nice=10
```

File: `/etc/systemd/system/btrbk-backup.timer`:

```ini
[Unit]
Description=Daily btrbk backup

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

### 11.2. borg

File: `/etc/systemd/system/borg-backup.service`:

```ini
[Unit]
Description=borg backup of /home and /etc
After=network.target

[Service]
Type=oneshot
Environment=BORG_PASSPHRASE=<your-borg-passphrase>
Environment=BORG_RELOCATED_REPO_ACCESS_IS_OK=yes
ExecStart=/usr/local/bin/borg-backup.sh
IOSchedulingClass=idle
Nice=10
```

> ⚠️ `BORG_PASSPHRASE` in EnvironmentFile/Unit is better placed in `/etc/borg-passphrase` (mode `600`, owned by root) and included with `EnvironmentFile=/etc/borg-passphrase`.

File: `/etc/systemd/system/borg-backup.timer`:

```ini
[Unit]
Description=Daily borg backup

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Activation:

```bash
doas systemctl daemon-reload
doas systemctl enable --now btrbk-backup.timer borg-backup.timer

# Check timers
systemctl list-timers btrbk-backup.timer borg-backup.timer
```

> **Advice**: btrbk runs at 03:00 and borg at 04:00 so they do not overlap. Adjust this to your schedule.

---

## 12. Verification

### 12.1. Reboot (main verification)

```bash
doas reboot
```

After boot:

```bash
# The second LUKS is automatically unlocked through TPM
lsblk -o NAME,FSTYPE,MOUNTPOINTS /dev/nvme0n1
systemctl status systemd-cryptsetup@cryptdata

# @data is mounted
mount | grep /home/<username>/data

# @backup is NOT mounted (soft-cold)
mount | grep /mnt/backup   # must be empty

# Arch is no longer visible in systemd-boot
doas bootctl list | grep -i arch   # empty

# Gentoo boots as before (UKI/Secure Boot untouched)
doas sbctl verify
```

### 12.2. Test the backup manually

```bash
# btrbk
doas systemctl start btrbk-backup.service
doas btrfs subvolume list /mnt/backup/gentoo   # snapshots @.* must appear

# borg
doas systemctl start borg-backup.service
doas borg list /mnt/backup/home.borg
doas borg list /mnt/backup/etc.borg
```

### 12.3. Test recovery (required!)

```bash
# Restore one file from /etc
doas mount /mnt/backup
doas borg extract --list /mnt/backup/etc.borg::etc-<DATE> etc/fstab
# (run in /tmp and check that the content is correct)
doas umount /mnt/backup
```

---

## 13. Rollback

**Disconnect the second disk from boot** (if anything goes wrong):

```bash
# Comment out/remove cryptdata and second-disk lines from fstab and crypttab
doas nano /etc/crypttab   # remove cryptdata
doas nano /etc/fstab      # remove @data and @backup
doas systemctl daemon-reload

# Disable timers
doas systemctl disable --now btrbk-backup.timer borg-backup.timer

# Reboot: Gentoo boots independently of nvme0n1
doas reboot
```

> Arch **cannot** be restored: the disk was erased (§5). If dual boot is still needed, make that decision before §4.

---

## 14. Risks

| Risk | Consequence | Mitigation |
|------|-------------|------------|
| TPM fails / PCRs change | Neither LUKS is automatically unlocked | A **passphrase slot** on each disk; boot with the passphrase, then re-enroll TPM |
| Second-disk failure | Backups + `~/data` lost; Gentoo continues to work | An external/cloud backup of critical data outside the laptop |
| First-disk (Gentoo) failure | System lost; backups intact on the second disk | Restore `@` to a new disk with `btrbk`/`btrfs receive` + reinstall bootloader |
| nvme0n1 name changes when disks are replaced | fstab/crypttab cannot find the device | Use **UUID**, not `/dev/nvme...` |
| borg repository corrupts | Some archives unavailable | Periodic `borg check --verify-data` |
| Soft-cold does not protect against root | A root process can mount `/mnt/backup` | Hard-cold (see below), or physically disconnect the disk |
| borg passphrase lost | Backup is useless | Keep it in a password manager + back up the key |
| `~/arch-rescue` containing secrets is forgotten | Secrets remain in plaintext on the first disk | After transfer to `home.borg`, run `shred -u ~/arch-rescue/*` |

### Hard-cold (optional, for paranoia)

If soft-cold is insufficient, split `nvme0n1` into two partitions: `nvme0n1p1` (LUKS-data, hot, opened at boot for `@data`) and `nvme0n1p2` (LUKS-backup, **not in crypttab** at all, opened only with `systemd-cryptsetup start cryptbackup` before a backup). This protects up to the root level (backup LUKS is closed between backups). The cost is two LUKS containers, two TPM enrollments, and a more complex fstab/crypttab.

---

## 15. Cheat sheet

```bash
# Open the backup target manually (for verification/restore)
doas mount /mnt/backup

# btrbk status
doas btrbk list snapshots
doas btrfs subvolume list /mnt/backup/gentoo

# borg status
doas borg list /mnt/backup/home.borg
doas borg info /mnt/backup/home.borg::home-<DATE>
doas borg check --verify-data /mnt/backup/home.borg

# Restore a file/directory
cd /tmp && doas borg extract /mnt/backup/home.borg::home-<DATE> home/<username>/<path>

# Close the backup target
doas umount /mnt/backup

# TPM slot status on both disks
doas cryptsetup luksDump /dev/nvme0n1p1
doas cryptsetup luksDump /dev/nvme1n1p2
```

---

## 16. References

- [btrbk documentation](https://digint.ch/btrbk/) — configuration, retention, send/receive
- [borgbackup documentation](https://borgbackup.readthedocs.io/) — exclude patterns, restore, automation
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/systemd-cryptenroll.html) — TPM2 enrollment
- [crypttab](https://www.freedesktop.org/software/systemd/man/crypttab.html) — LUKS options through systemd
- [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/) — subvolume/mount-option conventions
- [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/) — TPM/LUKS model of the first disk
