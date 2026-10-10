---
title: "Second disk: backups and additional storage"
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Status

**PLAN — NOT APPLIED** (verified by the 2026-09-22 audit; design corrected
without live checks).

Current machine state:

- `nvme0n1` is a single LUKS partition containing the old Arch Linux and is
  not open;
- the new backup/data layout on the second disk has not been created;
- no `/etc/crypttab` exists for it;
- btrbk/borg timers are not configured;
- Arch UKIs remain in the ESP.

The plan is to use the second NVMe (`nvme0n1`, previously Arch Linux) as
encrypted storage for **system and configuration backups** and
**additional data space**. There is no RAID and no change to the critical
boot path.

This is the design of a future implementation, not a live-system change.
Before applying it, the hardware/device state is verified again;
`last_verified` refers to the machine state on 2026-09-22, not to this
layout.

## Applicability

The machine already runs Gentoo on `nvme1n1` (LUKS2 + TPM2 + UKI + Btrfs) and
has a second physical disk, `nvme0n1`, intended for backups and data.

Context: see [installation/systemd-uki-setup](../../../../installation/systemd-uki-setup/) and [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/) for the boot stack. Btrfs conventions are in [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/).

## 1. Target design

Everything in this section describes the state **after the plan is applied**,
rather than the current machine (the current state is in Status above).

### Key principles

- **The second disk is NOT in the initramfs.** It is opened through systemd
  `/etc/crypttab` only after the rootfs is booted. Do **not** change
  Dracut/UKI/`rd.luks.*`/sbctl.
- **One LUKS2 + TPM2 (PCR 7) + an independent passphrase keyslot.** The same
  TPM and the same PCR set as the first disk (PCR 7 is the selected policy of
  the first disk; the 2026-09-14 episode is described in §7). Automatic
  unlock at boot.
- **Boot independence.** A failure, absence, or TPM unlock failure of the
  second NVMe must not break the Gentoo boot and must not require an
  interactive passphrase for the second disk. This is provided by `nofail` +
  `headless` (§9) and a root-owned mount point (§10).
- **Soft-cold for backups.** `@backup` is mounted `noauto`; the orchestration
  service mounts it only for the duration of a backup and unmounts it
  afterwards (§13). Outside the backup window, plain userspace without root
  does not see `/mnt/backup`.
- **`@data` is hot**: it is always mounted at `/home/<username>/data` as
  additional working storage.
- **btrbk for the system** (snapshots of the Gentoo root), **borg for
  `/home` and `/etc`** (file-level restore, deduplication, encryption,
  exclude patterns).

### Target layout

```text
nvme0n1 (second NVMe, confirmed via /dev/disk/by-id — §3)
└─ one GPT partition, type 8309 (Linux LUKS)
   └─ LUKS2 + TPM2 PCR 7 + independent passphrase keyslot
      │  (opened via /etc/crypttab → /dev/mapper/cryptdata)
      └─ Btrfs, label "backup", compress=zstd:3
         ├─ @data
         │  └─ /home/<username>/data
         │     hot, not a boot dependency
         │     additional/reproducible storage
         │
         └─ @backup
            └─ /mnt/backup
               noauto / soft-cold
               ├─ gentoo/    ← btrbk: snapshots of the Gentoo root
               ├─ home.borg  ← borg: /home/<username>
               └─ etc.borg   ← borg: /etc
```

### Accepted threat model

- **We protect against the failure of the first system NVMe**: the system is
  lost, local backups remain on the second disk.
- **Versioned/file-level recovery**: root snapshots (btrbk) plus `/home` and
  `/etc` archives (borg).
- **`@backup` is usually not mounted**, which reduces exposure to ordinary
  userspace.
- **We do not promise protection against root compromise** — see the
  boundary below.
- **`@data` contains no unique data** and is not part of the mandatory
  backup contract: it is additional/reproducible space.
- **A failure of the second NVMe** means losing `@data` and the local backup
  tier — this is an accepted risk.
- **Critical data** still requires a separate external/cloud copy outside
  this disk.

> ⚠️ **Soft-cold boundary**: soft-cold does not protect against root. Root
> can open the LUKS container and mount `@backup` at any moment; a
> TPM-enrolled second LUKS does not by itself make the backup
> root-resistant. A genuinely root-resistant model would require an
> independent secret, physical/off-device isolation, or a different
> architecture — this is deliberately **out of scope** for the current
> design.

### What is backed up and what is not

| Source | Destination | Tool | Excluded data |
|--------|-------------|------|---------------|
| `@` (Gentoo root: OS + `/etc`) | `/mnt/backup/gentoo/` | btrbk (send/receive) | caches in separate subvols are not part of `@`; `/.snapshots` is not copied |
| `/home/<username>` | `/mnt/backup/home.borg` | borg | `data` (second NVMe — §12.3), `.cache`, `llvm-project`, `llvm-for-bolt-perf`, `Downloads`, `.steam`, `*.venv`, `__pycache__` |
| `/etc` | `/mnt/backup/etc.borg` | borg | `—` (file-level restore) |
| `~/.ssh`, `~/.gnupg`, tokens | inside `home.borg` | borg (encrypted) | — |

**Not backed up** (reproducible or outside the contract): `@var_cache`,
`@distfiles`, `@var_log` (optional), `@portage_tree` (`emerge --sync`),
`@portage_tmp`, `@ccache`, `/.snapshots` (local protection, not a backup),
`/home/<username>/data` (on the second disk, additional/reproducible).

---

## 2. Prerequisites

```bash
# A system snapshot for rollback (just in case)
doas snapper -c root create -d "before second disk setup"

# Backup tools
doas emerge -av app-backup/btrbk app-backup/borgbackup

# Check: the old Arch LUKS passphrase is known (to rescue data)
# Check: the list of Arch data to rescue is prepared (§4)
# Check: the ESP is shared and lives on the Gentoo disk (nvme1n1p1 → /boot)
lsblk -o NAME,FSTYPE,MOUNTPOINTS,PARTTYPENAME /dev/nvme1n1
```

---

## 3. Identity gate: confirming the physical disk

> ⚠️ **STOP.** Before any `wipefs`, `sgdisk`, or `cryptsetup luksFormat`,
> confirm that the selected device node points at the physical second NVMe.
> `/dev/nvme0n1` is not an identity: the name can change after disk
> replacement, firmware updates, or initialization order. Destroying the
> wrong disk means losing the working system.

Capture the identity of both NVMe drives:

```bash
lsblk -d -o NAME,MODEL,SERIAL,SIZE,WWN
ls -l /dev/disk/by-id/ | grep nvme
```

Pick the stable symlink of the specific second NVMe from `/dev/disk/by-id/`
(of the form `nvme-<MODEL>_<SERIAL>`) and check where it leads and what is
on it:

```bash
readlink -f /dev/disk/by-id/<SECOND-NVME>
doas sgdisk -p /dev/disk/by-id/<SECOND-NVME>
```

Before any destructive operation, record and cross-check manually:

- **model** and **serial** — from `lsblk` and from the by-id name;
- **size** — matches the expected second disk;
- **the current partition layout** (`sgdisk -p`) — one partition with the
  old Arch LUKS;
- **WWN** — as a cross-check.

Throughout the rest of this document, `<SECOND-NVME>` is this confirmed
by-id path, and the partition node is `<SECOND-NVME>-part1`. In destructive
steps it is convenient to use a variable:

```bash
DISK=/dev/disk/by-id/<CONFIRMED-SECOND-NVME>
```

---

## 4. Rescue Arch data

The old partition currently holds the Arch LUKS (UUID `<arch-luks-uuid>`).
Before erasing it, open it read-only and recover what is needed.

The temporary storage is a root-only directory on the already encrypted
first disk, not a user `~/arch-rescue`: the rescued data includes root-owned
secrets, and keeping them in a user-writable home directory is unnecessary.

```bash
doas install -d -m 0700 -o root -g root /root/arch-rescue
```

Open the old LUKS read-only:

```bash
doas cryptsetup open --type luks --readonly /dev/disk/by-id/<SECOND-NVME>-part1 cryptarch-ro

doas mkdir -p /mnt/arch
# The Arch root is the @ subvolume (see rd.luks...rootflags=subvol=@ in bootctl)
doas mount -o ro,subvol=/@ /dev/mapper/cryptarch-ro /mnt/arch

# Inspect its contents
ls -la /mnt/arch
ls -la /mnt/arch/home   # Arch user
```

Copy valuable data with root privileges. Do not suppress copy errors: an
empty result caused by a suppressed error is silent data loss.

```bash
# Secrets
doas cp -a /mnt/arch/etc/ssh /root/arch-rescue/etc-ssh
# Find the Arch user's home directory and recover ~/.ssh, ~/.gnupg, dotfiles, projects:
# doas cp -a /mnt/arch/home/<arch-user>/.ssh   /root/arch-rescue/
# doas cp -a /mnt/arch/home/<arch-user>/.gnupg /root/arch-rescue/
# doas cp -a /mnt/arch/etc                     /root/arch-rescue/etc-arch
```

Close it:

```bash
doas umount /mnt/arch
doas cryptsetup close cryptarch-ro
```

### Verification gate before destroying the disk

No destructive step (§6 onward) until all of this is confirmed:

- [ ] a list of the data that had to be rescued has been written;
- [ ] every item on the list is physically present in `/root/arch-rescue`
      (`doas ls -laR /root/arch-rescue`);
- [ ] permissions/ownership are acceptable (`doas stat`);
- [ ] important files actually open and read (keys, configs, projects);
- [ ] you have explicitly confirmed that the old Arch disk may be destroyed.

### Lifecycle of the rescue copy

After a successful migration (backups configured and verified, §12–14), the
temporary copy is no longer needed:

```bash
doas rm -rf /root/arch-rescue
```

This is a plain deletion, not a physical secure erase. Single-file
"wiping" utilities rely on in-place overwrite; Btrfs (CoW) and SSD/NVMe
(wear levelling) break that guarantee. The real security boundary is
encryption at rest: both disks are under LUKS, and `/root` lives on the
encrypted first disk.

---

## 5. Remove Arch UKIs from the ESP

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

## 6. Repartition the second disk

> ⚠️ **Destructive**: this erases everything on the second NVMe. The
> identity gate (§3) and the rescue verification gate (§4) must have been
> passed first.

```bash
DISK=/dev/disk/by-id/<CONFIRMED-SECOND-NVME>

# Ensure that the old LUKS is closed
doas cryptsetup status cryptarch-ro   # expected: "is inactive"
doas cryptsetup status cryptarch      # if it was ever opened — also closed

# Clear disk signatures
doas wipefs -a "$DISK"

# New GPT with one partition
doas sgdisk -Z "$DISK"
doas sgdisk -n 1:0:0 -t 1:8309 "$DISK"

# Check
doas sgdisk -p "$DISK"
```

The partition type is `8309` (**Linux LUKS**), not generic `8300`: the
purpose of the partition is already known, and the partition table should
reflect that. The new partition node: `<SECOND-NVME>-part1`.

---

## 7. LUKS2 + TPM2

The workstation policy is unchanged: LUKS2, TPM2, PCR 7 — as on the first
disk. PCR 7 is an already-accepted decision of the current boot design; the
second disk is not enrolled yet, and before the actual implementation the
current TPM/systemd state is checked again.

```bash
# Create LUKS2; the passphrase is an independent recovery path, not tied to the TPM
doas cryptsetup luksFormat --type luks2 --pbkdf argon2id /dev/disk/by-id/<SECOND-NVME>-part1

# Open it
doas cryptsetup open --type luks /dev/disk/by-id/<SECOND-NVME>-part1 cryptdata

# Enroll TPM2: PCR 7, the same set as the first disk
doas systemd-cryptenroll --wipe-slot=tpm2 --tpm2-device=auto --tpm2-pcrs=7 /dev/disk/by-id/<SECOND-NVME>-part1
```

Verify the result with `luksDump` (inspection; do not confuse keyslot
numbers with token numbers — they are different entities):

```bash
doas cryptsetup luksDump /dev/disk/by-id/<SECOND-NVME>-part1
```

Required outcome:

- at least **one passphrase keyslot** exists (the `Keyslots` section);
- a **TPM2 token** exists (the `Tokens` section);
- the passphrase actually opens the LUKS independently of the TPM:

```bash
doas cryptsetup open --test-passphrase /dev/disk/by-id/<SECOND-NVME>-part1
```

A "passphrase slot 0" is not a universal fact: slot numbering is a detail
of a particular enrollment — verify the actual state, not an assumed
number.

Record the LUKS UUID for `/etc/crypttab`:

```bash
doas blkid -s UUID -o value /dev/disk/by-id/<SECOND-NVME>-part1
```

> ⚠️ **Important**: keep a passphrase keyslot. If the TPM dies or the PCRs change (a firmware update or a Secure Boot remount), the disk can never be opened without its passphrase. Compare the first disk: `doas cryptsetup luksDump /dev/nvme1n1p2` must also show a passphrase keyslot beside TPM.

> ⚠️ **Important nuance**: use PCR 7 specifically, rather than an extended set such as `0+7`. On this machine, even with the minimal set, a cmdline change (2026-09-14) coincided with a PCR mismatch and loss of unlock; re-enrollment restored operation. The exact firmware measurement path has not been confirmed (there was no direct before-and-after PCR 7 measurement). See [troubleshooting: TPM2 unlock after rebuilding the UKI](../../../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/) for the timeline and re-enrollment procedure. If you choose another set, synchronize `tpm2-pcrs=` in `/etc/crypttab` (§9).

---

## 8. Btrfs + subvolumes

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

One Btrfs filesystem with exactly two subvolumes: `@data` + `@backup`. No
extra subvolumes are added without a need.

---

## 9. /etc/crypttab and /etc/fstab: boot independence

Architectural requirement:

> A failure, absence, or TPM unlock failure of the second NVMe must not
> break the Gentoo boot and must not require an interactive passphrase for
> the second disk during a normal boot. The recovery passphrase is used
> manually, during diagnostics/restore.

File: `/etc/crypttab` (create it if absent):

```text
# <name>      <device>          <password>   <options>
cryptdata      UUID=<LUKS-UUID>  none         luks,tpm2-device=auto,tpm2-pcrs=7,nofail,headless
```

- `nofail` — the encrypted device is not a hard boot dependency: the system
  boots even if the second disk is absent or fails to open;
- `headless` — on TPM failure the boot does not turn into an interactive
  password prompt: the device simply stays closed;
- `tpm2-pcrs=7` is specified explicitly and matches the set in
  `systemd-cryptenroll` (§7), so unlock does not depend on crypttab
  defaults.

Manual recovery when TPM has problems:

```bash
doas cryptsetup open --type luks /dev/disk/by-id/<SECOND-NVME>-part1 cryptdata
```

File: `/etc/fstab`: add these lines (following the style of the existing
Btrfs entries):

```text
# Second disk — data (hot, not a boot dependency)
UUID=<BTRFS-UUID>  /home/<username>/data  btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@data,nofail  0 0

# Second disk — backup target (soft-cold)
UUID=<BTRFS-UUID>  /mnt/backup  btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@backup,noauto,nofail  0 0
```

- `@data`: `nofail` — the absence or failure of the second disk does not
  hang the boot;
- `@backup`: `noauto,nofail` — usually not mounted (soft-cold) and not part
  of the boot.

> `<LUKS-UUID>` comes from §7 and `<BTRFS-UUID>` from §8. An arbitrary
> `x-systemd.device-timeout=` is not added: without a live measurement of
> the need and a tuned value, it only masks the problem.

The second disk is not part of the initramfs: Dracut/UKI/kernel
cmdline/sbctl are not changed.

---

## 10. Mount points and ownership

`/mnt/backup` stays root-controlled. For `@data` the order is critical:
ownership is changed **after** a successful mount, not before.

Why: if `chown <username>` runs before the mount and the second disk does
not mount (absent, LUKS not opened), applications get a user-writable
directory on the first NVMe and silently start writing data there. A
root-owned non-writable mount point gives the opposite semantics: without
the disk, writes fail with an error instead of silently landing on the
first disk.

```bash
# 1. Mount point — root-owned and non-user-writable (before the mount)
doas install -d -m 0755 -o root -g root /home/<username>/data
doas install -d -m 0755 -o root -g root /mnt/backup

# 2. Activate the configuration: open the second LUKS through TPM
doas systemctl daemon-reload
doas systemctl start systemd-cryptsetup@cryptdata

# 3. Mount hot data (do NOT mount backup: noauto)
doas mount /home/<username>/data

# 4. Verify that the mounted filesystem is exactly @data with the expected UUID/subvol
findmnt --mountpoint /home/<username>/data

# 5. Only after a successful mount — ownership of the mounted @data root
doas chown <username>:<username> /home/<username>/data

# Control
lsblk -o NAME,FSTYPE,MOUNTPOINTS /dev/disk/by-id/<SECOND-NVME>
```

The `chown` in step 5 changes the owner of the root of the mounted `@data`
subvolume (on the second disk), not of the mount-point directory on the
first disk.

---

## 11. btrbk: backup of the Gentoo root

btrbk takes snapshots of the Gentoo root and incrementally sends them with
`btrfs send/receive` to the second disk. The source is the first disk; the
target is `/mnt/backup/gentoo`.

The source in the configuration is `/` as an absolute path: `/` is already
the mounted `@` subvolume, and a separate top-level mount (subvolid=5) just
for btrbk is not needed. The previous configuration form assumed that `@`
was reachable as a nested path inside the root — that does not match the
actual workstation layout.

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

# Root snapshots — in a dedicated directory inside /.snapshots
snapshot_dir            /.snapshots/btrbk

# Source: / (the mounted @ subvolume of the Gentoo root)
subvolume /
  snapshot_name root
  target send-receive /mnt/backup/gentoo
```

Before the first run, create the snapshot directory:

```bash
doas mkdir -p /.snapshots/btrbk
```

The target directory is created **only after a successful mount** of
`/mnt/backup`:

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup   # verify: subvol=/@backup, expected UUID
doas mkdir -p /mnt/backup/gentoo
```

Do not create the target in an empty `/mnt/backup`: if the subvolume is not
mounted, the directory lands on the root filesystem of the first disk, and
the backup goes there instead.

Configuration check (without writing):

```bash
doas btrbk config print
doas btrbk run -n
```

`btrbk run -n` is the documented dry-run form. No real send is performed as
part of this plan.

---

## 12. Borg: repositories, secrets, exclude policy

Two repositories: `/mnt/backup/home.borg` and `/mnt/backup/etc.borg`. `/etc`
is saved separately for convenient file-level restore, even though the root
also lands in the btrbk backup.

### 12.1. Initialization and key export

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup   # subvol=/@backup

doas mkdir -p /mnt/backup/home.borg /mnt/backup/etc.borg
doas borg init --encryption=repokey /mnt/backup/home.borg
doas borg init --encryption=repokey /mnt/backup/etc.borg
```

Right after init, export the key of each repository:

```bash
doas borg key export /mnt/backup/home.borg <OFF-DEVICE-PATH>/home.borg.key
doas borg key export /mnt/backup/etc.borg  <OFF-DEVICE-PATH>/etc.borg.key
```

- with `repokey`, the main key lives inside the repository: the export is
  not the only copy, but it protects against corruption/loss of the
  repository-contained key;
- recovery still requires the passphrase;
- the exported key is stored **outside the second NVMe** and definitely not
  on `@backup`;
- the passphrase is additionally stored in a password manager (off-device
  recovery context).

### 12.2. Passphrase for automation

The passphrase itself must never appear in a systemd unit, a command line,
or example history — only in a root-only file:

```bash
doas install -d -m 0700 -o root -g root /etc/borg
doas nano /etc/borg/passphrase   # write the passphrase
doas chmod 0600 /etc/borg/passphrase
doas stat -c '%a %U:%G' /etc/borg/passphrase   # expected: 600 root:root
```

Borg automation reads it through a passcommand:

```bash
export BORG_PASSCOMMAND='cat /etc/borg/passphrase'
```

### 12.3. Exclude policy and dry-run verification

The critical rule: `/home/<username>/data` lives on the same second NVMe as
the backup target. The Borg `/home` backup **must exclude this path** —
otherwise the backup copies second-disk data onto the same physical disk.

Exclude patterns are in normalized form: Borg 1.2+ normalizes discovered
paths without a leading slash, so the reliable anchor is a path without the
leading `/`:

- `home/<username>/data/` — critical, see above;
- `home/<username>/.cache/`;
- `home/<username>/llvm-project/`;
- `home/<username>/llvm-for-bolt-perf/`;
- `home/<username>/Downloads/`;
- `home/<username>/.steam/`;
- `home/<username>/.local/share/Trash/`;
- `*/.venv`, `*/__pycache__`, `*/node_modules`, `*.pyc`, `--exclude-caches`.

Before the first real backup — dry-run/list verification of the exclusion
semantics (documented Borg capabilities):

```bash
doas mount /mnt/backup

doas borg create --dry-run --list \
  --exclude 'home/<username>/data/' \
  --exclude 'home/<username>/.cache/' \
  --exclude 'home/<username>/llvm-project/' \
  --exclude 'home/<username>/llvm-for-bolt-perf/' \
  --exclude 'home/<username>/Downloads/' \
  --exclude 'home/<username>/.steam/' \
  --exclude 'home/<username>/.local/share/Trash/' \
  --exclude '*/.venv' \
  --exclude '*/__pycache__' \
  --exclude '*/node_modules' \
  --exclude-caches \
  --exclude '*.pyc' \
  /mnt/backup/home.borg::dryrun \
  /home/<username> | tee /tmp/borg-dryrun.txt

# Every line containing data must have status 'x' (excluded)
grep 'home/<username>/data' /tmp/borg-dryrun.txt
```

> ⚠️ **Secrets**: `~/.ssh`, `~/.gnupg`, `~/.ansible_vault_pass`, `~/.mcp-auth`, `~/.codex`, `.claude.json`, and `~/.mozilla` are included in `home.borg`. The repository is encrypted and lives on an encrypted disk — this is acceptable. Never copy them to public git or cloud storage.

---

## 13. Automation: one orchestration service + one timer

Instead of two independent timers that separately mount/unmount the same
`/mnt/backup`, there is **one backup orchestration service and one timer**:
one mount lifecycle, no race between btrbk and Borg, one systemd status,
one failure-reporting point, and simple soft-cold semantics.

File: `/usr/local/bin/second-disk-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_TARGET=/mnt/backup
REPO_HOME=$BACKUP_TARGET/home.borg
REPO_ETC=$BACKUP_TARGET/etc.borg
export BORG_PASSCOMMAND='cat /etc/borg/passphrase'

MOUNTED_BY_US=0

cleanup() {
  local rc=$?
  # Unmount is guaranteed on success AND failure — but only our own mount
  if [[ $MOUNTED_BY_US -eq 1 ]] && findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
    umount "$BACKUP_TARGET" || rc=1
  fi
  exit "$rc"
}
trap cleanup EXIT

# 1. A foreign mount is an explicit fail; never unmount it silently.
#    Note --mountpoint specifically: --target would return the filesystem
#    containing the path (the first disk's root) and block every run
if findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
  echo "ERROR: $BACKUP_TARGET is already mounted; unmount it manually and investigate" >&2
  exit 1
fi

# 2. Mount: no '|| true' — the backup never continues after a failed mount,
#    otherwise writes would go into the empty mount point on the first disk
mount "$BACKUP_TARGET"
MOUNTED_BY_US=1

# 3. btrbk: root snapshots + send/receive
btrbk run

# 4–5. Borg: /home and /etc
STAMP=$(date +%Y-%m-%d_%H:%M)

borg create --stats \
  --exclude 'home/<username>/data/' \
  --exclude 'home/<username>/.cache/' \
  --exclude 'home/<username>/llvm-project/' \
  --exclude 'home/<username>/llvm-for-bolt-perf/' \
  --exclude 'home/<username>/Downloads/' \
  --exclude 'home/<username>/.steam/' \
  --exclude 'home/<username>/.local/share/Trash/' \
  --exclude '*/.venv' \
  --exclude '*/__pycache__' \
  --exclude '*/node_modules' \
  --exclude-caches \
  --exclude '*.pyc' \
  "${REPO_HOME}::home-${STAMP}" \
  /home/<username>

borg create --stats \
  --exclude-caches \
  "${REPO_ETC}::etc-${STAMP}" \
  /etc

# 6. Retention + compaction
for repo in "$REPO_HOME" "$REPO_ETC"; do
  borg prune --keep-daily 14 --keep-weekly 4 --keep-monthly 6 "$repo"
  borg compact "$repo"
done

# 7. Unmount — in the trap (cleanup), on success AND failure
```

```bash
doas chmod +x /usr/local/bin/second-disk-backup.sh
```

File: `/etc/systemd/system/second-disk-backup.service`:

```ini
[Unit]
Description=Second-disk backup orchestration (btrbk + borg)

[Service]
Type=oneshot
ExecStart=/usr/local/bin/second-disk-backup.sh
IOSchedulingClass=idle
Nice=10
```

File: `/etc/systemd/system/second-disk-backup.timer`:

```ini
[Unit]
Description=Daily second-disk backup (btrbk + borg)

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Activation:

```bash
doas systemctl daemon-reload
doas systemctl enable --now second-disk-backup.timer
systemctl list-timers second-disk-backup.timer
```

---

## 14. Verification / acceptance

### 14.1. Design-time (this document)

Nothing listed below has been **verified live**: the layout is a plan.
`btrbk config print`, `btrbk run -n`, and the Borg dry-run here are future
implementation steps, not executed checks. No separate concurrent timers
are added.

### 14.2. Future implementation acceptance

The minimum set of checks at implementation time.

Disks and boot:

- [ ] the identity of the selected disk is confirmed (§3:
      model/serial/size/WWN, by-id recorded);
- [ ] the LUKS passphrase unlock works
      (`cryptsetup open --test-passphrase`);
- [ ] the TPM unlock works;
- [ ] reboot with a healthy second disk — PASS: Gentoo boots, `@data` is
      mounted;
- [ ] the second disk is not boot-critical — negative test: with the second
      disk absent or failing to unlock, the Gentoo boot does not break and
      does not require an interactive passphrase (`nofail` + `headless`);
- [ ] after such a boot, `/home/<username>/data` does not silently accept
      data on the first disk — the mount point is root-owned, writes fail
      with an error:

```bash
findmnt --mountpoint /home/<username>/data   # expected: not mounted
touch /home/<username>/data/test         # expected: Permission denied
```

Btrfs:

- [ ] exactly the expected `@data` and `@backup` exist;
- [ ] `findmnt` shows the correct UUID/subvol for both mount points;
- [ ] `@backup` is unmounted again after the backup job.

btrbk:

- [ ] `btrbk config print` completes without errors;
- [ ] `btrbk run -n` shows the expected actions;
- [ ] a manual first real backup has been run;
- [ ] the received subvolume exists in `/mnt/backup/gentoo`;
- [ ] the backup opens and reads;
- [ ] a full disaster restore is not claimed as PASS without a real restore
      drill.

Borg:

- [ ] dry-run/list confirms the exclusion semantics (§12.3);
- [ ] the `home` backup does not contain `home/<username>/data`;
- [ ] archives list/info are available;
- [ ] `borg check` runs according to the accepted policy;
- [ ] the passphrase recovery path is verified (passcommand and manual
      entry);
- [ ] the exported repokey exists outside the second NVMe.

File restore test — a safe restore into a separate temporary directory,
never `borg extract` into `/`:

```bash
doas mount /mnt/backup
mkdir /tmp/borg-restore-test
cd /tmp/borg-restore-test
doas borg extract /mnt/backup/etc.borg::etc-<DATE> etc/fstab
cat etc/fstab   # check the content
cd /
doas rm -rf /tmp/borg-restore-test
doas umount /mnt/backup
```

---

## 15. Rollback

**Disconnect the second disk from boot** (if anything goes wrong):

```bash
# Remove cryptdata and second-disk lines from fstab and crypttab
doas nano /etc/crypttab   # remove cryptdata
doas nano /etc/fstab      # remove @data and @backup
doas systemctl daemon-reload

# Disable automation
doas systemctl disable --now second-disk-backup.timer

# Reboot: Gentoo boots independently of the second NVMe
doas reboot
```

> Arch **cannot** be restored: the disk was erased (§6). If dual boot is still needed, make that decision before §5.

---

## 16. Risks

| Risk | Consequence | Mitigation |
|------|-------------|------------|
| First (system) NVMe fails | System lost; local backups remain on the second disk | Restore `@` to a new disk with btrbk/`btrfs receive` + reinstall the bootloader; critical data additionally off-device |
| Second NVMe fails | Local backup tier and `@data` lost; Gentoo keeps working | Accepted risk: `@data` is additional/reproducible storage; unique critical data — external/cloud copy |
| Whole laptop lost/stolen | Both local disks are lost | External/cloud copy of critical data outside the laptop |
| TPM failure / PCR change | Automatic unlock of the second disk stops working | Independent passphrase keyslot: manual unlock + re-enroll TPM |
| Root compromise | Soft-cold does not protect: root can open the LUKS and mount `@backup` | Out of scope for this design (boundary in §1); a root-resistant model requires a different architecture |
| Backup corruption | Some archives/snapshots unavailable | Periodic `borg check`, restore drills |
| Borg passphrase / repository key lost | The encrypted Borg backup becomes inaccessible | Passphrase in a password manager; `borg key export` stored outside the second NVMe |
| NVMe names change when disks are replaced | fstab/crypttab cannot find the device | UUIDs in fstab/crypttab; during setup — the confirmed `/dev/disk/by-id/` |

---

## 17. Cheat sheet

```bash
# Open the backup target manually (for verification/restore)
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup        # verify: subvol=/@backup

# btrbk status
doas btrbk list snapshots
doas btrfs subvolume list /mnt/backup/gentoo

# borg status (asks for the passphrase interactively)
doas borg list /mnt/backup/home.borg
doas borg info /mnt/backup/home.borg::home-<DATE>
doas borg check --verify-data /mnt/backup/home.borg

# borg without manual passphrase entry
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' borg list /mnt/backup/home.borg

# Restore a file/directory — only into a separate temporary directory
mkdir /tmp/borg-restore-test && cd /tmp/borg-restore-test
doas borg extract /mnt/backup/home.borg::home-<DATE> home/<username>/<path>

# Close the backup target
doas umount /mnt/backup

# TPM/token status of both disks
doas cryptsetup luksDump /dev/disk/by-id/<SECOND-NVME>-part1
doas cryptsetup luksDump /dev/nvme1n1p2
```

---

## 18. References

- [btrbk documentation](https://digint.ch/btrbk/) — configuration, retention, send/receive
- [borgbackup documentation](https://borgbackup.readthedocs.io/) — exclude patterns, restore, automation
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/systemd-cryptenroll.html) — TPM2 enrollment
- [crypttab](https://www.freedesktop.org/software/systemd/man/crypttab.html) — LUKS options through systemd (`nofail`, `headless`)
- [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/) — subvolume/mount-option conventions
- [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/) — TPM/LUKS model of the first disk
