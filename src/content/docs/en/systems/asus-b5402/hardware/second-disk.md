---
title: "Second NVMe: data storage and backup plan"
kind: system
scope: system
status: draft
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

## Current state

The plan has not been applied. Gentoo is currently booted from the primary
NVMe; the second NVMe, a Micron 2450 (476.9G as shown by `lsblk`), still has
one GPT partition of type `8304` with the old Arch `LUKS2` volume; it is not
mounted. Its UUID matches the `rd.luks.name` value in the old Arch UKIs; the
LUKS header has two keyslots: one is associated with the `systemd-tpm2` token,
the other is not. The current boot
entry is Gentoo, but the default is `arch-linux-cachyos.efi`, which references
the second disk. The ESP is on the primary NVMe. There are no new
`/etc/crypttab` or `/etc/fstab` entries for the second disk, no installed
`btrbk` or `Borg` packages, and no backup service or timer for it.

The metadata date records this state and the plan's applicability, not
implementation of the target layout.

## Target layout

```text
second NVMe
└─ GPT: one Linux LUKS partition
   └─ LUKS2
      ├─ TPM2 unlock, PCR 7
      ├─ passphrase keyslot for recovery
      └─ decrypted payload: Btrfs
         ├─ @data   → /home/<username>/data
         └─ @backup → /mnt/backup
```

- The second disk is not part of the `initramfs` and is not a boot dependency.
  Its absence or a TPM unlock failure must not stop boot or prompt for a
  passphrase interactively.
- `@data` is normally mounted as additional storage.
- `@backup` uses `noauto` and is mounted only during a backup job.
- No RAID is used. `@data` is not a source of unique data; critical data needs
  a separate copy off this laptop.
- `@backup` is `soft-cold`: ordinary userspace cannot see it outside the backup
  window, but root can open the container and mount the subvolume. This does
  not protect against root compromise.

## Backup set

| Source | Destination | Tool | Notes |
|---|---|---|---|
| Root subvolume `@` (`/`) | `@backup/gentoo` | `btrbk` | Separate subvolumes (`/home`, `/var/log`, caches, `/.snapshots`) are not included |
| `/home/<username>` | `@backup/home.borg` | `Borg 1.x` | Encrypted archive and accepted exclude file |
| `/etc` | `@backup/etc.borg` | `Borg 1.x` | Separate archive for file-level restore |

The `/home` archive includes sensitive files such as `~/.ssh` and `~/.gnupg`,
so keep `Borg` encryption enabled. This local copy does not replace an
external/off-device backup; keep the passphrase and exported repository keys
outside the second NVMe.

## Preparation and implementation

### 1. Confirm the disk and ESP

`/dev/nvme0n1` and `/dev/nvme1n1` show the current device order; they do not
identify the disk for destructive commands. Select the second NVMe by
`/dev/disk/by-id/` and cross-check its model, serial, size, WWN, symlink, and
partition table each time:

```bash
lsblk -d -o NAME,MODEL,SERIAL,SIZE,WWN
ls -l /dev/disk/by-id/ | grep nvme
readlink -f "/dev/disk/by-id/<SECOND-NVME>"
doas sgdisk -p "/dev/disk/by-id/<SECOND-NVME>"
```

Before any `wipefs`, `sgdisk`, `cryptsetup luksFormat`, or `mkfs` command,
confirm that this is the second disk, that the old Arch LUKS is expected, and
that no unknown partitions or data are present. `/dev/nvme0n1` is not an
identity; use the selected path from `/dev/disk/by-id/`.

Separately confirm the ESP location and its contents:

```bash
doas bootctl status --no-pager
doas bootctl list --no-pager
doas find /boot/EFI -type f -printf '%p\n'
```

The ESP must remain on the primary NVMe, not on the disk to be erased. Before
erasing, confirm that Gentoo is the default boot entry. The current default
points to the old Arch UKI, so change it to Gentoo separately and test booting
before continuing:

```bash
doas bootctl set-default "<CONFIRMED-GENTOO-UKI-ID>"
doas bootctl status --no-pager
```

If Gentoo does not boot, do not erase the disk; restore the previous default
and resolve the boot issue first. If the ESP, device, or partition layout differs from
expectations, stop and review the plan before making changes.

### 2. Rescue old Arch data

First choose the files to keep from the old system. Examples include `/etc`,
`~/.ssh`, `~/.gnupg`, projects, and other unique data. Store the copy in a
`root-only` directory on the already encrypted system disk:

```bash
doas install -d -m 0700 -o root -g root /root/arch-rescue
doas cryptsetup open --type luks --readonly \
  "/dev/disk/by-id/<SECOND-NVME>-part1" cryptarch-ro
doas mkdir -p /mnt/arch
doas mount -o ro,subvol=@ /dev/mapper/cryptarch-ro /mnt/arch

ls -la /mnt/arch/home
doas cp -a /mnt/arch/etc /root/arch-rescue/
doas cp -a "/mnt/arch/home/<arch-user>/.ssh" /root/arch-rescue/
```

Copy only the data you need. Check that each important file exists, has
acceptable ownership, and can be read. Then unmount the rescue copy and close
the mapping:

```bash
doas umount /mnt/arch
doas cryptsetup close cryptarch-ro
```

**Destructive gate:** do not erase the disk until the rescue copy is checked
and you have separately confirmed that the old Arch installation may be
destroyed.

Do not remove `/root/arch-rescue` after setting up the disk. Delete it
manually only after the new backup scheme passes a restore test and you
separately decide the old data is no longer needed.

### 3. Clean up the ESP separately (optional)

Removing old Arch UKIs is a separate cleanup gate; it is not required to
repartition the second NVMe. First review the boot entries and full file list.
Remove only specific files confirmed to belong to Arch:

```bash
doas bootctl list --no-pager
doas find /boot/EFI -type f -printf '%p\n'
doas rm -v "/boot/EFI/Linux/<CONFIRMED-ARCH-UKI>"
```

Do not use a wildcard to remove UKIs.

### 4. Create GPT and `LUKS2`

Repeat the identity gate from step 1 and confirm the rescue gate has passed.
Then set DISK to the confirmed by-id path:

```bash
DISK="/dev/disk/by-id/<CONFIRMED-SECOND-NVME>"

doas wipefs -a "$DISK"
doas sgdisk --zap-all "$DISK"
doas sgdisk --new=1:0:0 --typecode=1:8309 "$DISK"
doas udevadm settle
doas sgdisk -p "$DISK"
test -b "$DISK-part1"
```

Create `LUKS2`. The passphrase set during `luksFormat` remains an independent
recovery path; store it away from this disk. Then enroll `TPM2` under the
accepted `PCR 7` policy. TPM enrollment depends on the selected PCR policy;
keep the passphrase in case automatic unlock becomes unavailable after a
firmware or Secure Boot state change.

```bash
doas cryptsetup luksFormat --type luks2 --pbkdf argon2id "$DISK-part1"
doas systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 "$DISK-part1"
```

Inspect the LUKS metadata locally without publishing token blobs. Identify the
passphrase keyslot that is not associated with the TPM token and test that
slot specifically:

```bash
doas cryptsetup luksDump "$DISK-part1"
doas cryptsetup open --test-passphrase --key-slot "<PASSPHRASE-SLOT>" \
  "$DISK-part1"
```

The passphrase test must succeed without opening a mapping. Stop if it fails;
the TPM token does not replace the recovery keyslot.

### 5. Create `Btrfs` and subvolumes

Open the container, create `Btrfs` without RAID, and create exactly two
subvolumes:

```bash
doas cryptsetup open --type luks "$DISK-part1" cryptdata
doas mkfs.btrfs -L backup /dev/mapper/cryptdata
doas mkdir -p /mnt/cryptdata-root
doas mount /dev/mapper/cryptdata /mnt/cryptdata-root
doas btrfs subvolume create /mnt/cryptdata-root/@data
doas btrfs subvolume create /mnt/cryptdata-root/@backup
doas blkid -s UUID -o value /dev/mapper/cryptdata
doas umount /mnt/cryptdata-root
```

### 6. Configure `/etc/crypttab` and `/etc/fstab`

File: `/etc/crypttab`

```text
cryptdata UUID=<LUKS-UUID> none luks,tpm2-device=auto,nofail,headless=yes
```

`headless=yes` prevents an interactive passphrase prompt; `nofail` makes unlocking
non-fatal to boot. `PCR 7` is set by `systemd-cryptenroll` and stored in the
`LUKS2` token metadata.

File: `/etc/fstab`

```text
UUID=<BTRFS-UUID> /home/<username>/data btrfs rw,noatime,compress=zstd:3,ssd,space_cache=v2,subvol=@data,nofail 0 0
UUID=<BTRFS-UUID> /mnt/backup btrfs rw,noatime,compress=zstd:3,ssd,space_cache=v2,subvol=@backup,noauto,nofail 0 0
```

`nofail` is also needed on a mount that depends on cryptdata; setting it only
in crypttab is not enough. `@data` mounts during normal boot; `@backup` stays
unmounted until the backup service runs.
TRIM pass-through through LUKS is disabled; adding `discard` to crypttab is a
separate decision with security implications.

Create root-owned mount points. Change ownership of `@data` only after a
successful mount, so a missing disk cannot silently redirect writes to a
directory on the system disk:

```bash
doas install -d -m 0755 -o root -g root "/home/<username>/data" /mnt/backup
doas systemctl daemon-reload
doas systemctl start systemd-cryptsetup@cryptdata
doas mount "/home/<username>/data"
findmnt --mountpoint "/home/<username>/data"
doas chown "<username>:<username>" "/home/<username>/data"
```

### 7. Install the tools and configure `btrbk`

The packages are not installed on Gentoo yet. Install them before configuring
the backups:

```bash
doas emerge -av app-backup/btrbk app-backup/borgbackup
```

File: `/etc/btrbk/btrbk.conf`

```text
snapshot_preserve_min   latest
snapshot_preserve       14d 4w 6m
target_preserve_min     latest
target_preserve         14d 4w 6m
loglevel                info
snapshot_dir            /.snapshots/btrbk

subvolume /
  snapshot_name root
  target send-receive /mnt/backup/gentoo
```

/ is the already mounted Gentoo root subvolume. Create the snapshot directory,
mount `@backup`, and confirm the mount point:

```bash
doas mkdir -p /.snapshots/btrbk
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
```

Confirm that the second disk's Btrfs `@backup` subvolume is mounted. Otherwise
stop; do not create the target in the ordinary `/mnt/backup` directory on the
root filesystem. After that check, create the target directory and validate
the configuration/dry run:

```bash
doas mkdir -p /mnt/backup/gentoo
doas btrbk config print
doas btrbk run -n
doas umount /mnt/backup
```

The backup service below runs `btrbk` run. After the first run, verify that the
received subvolume exists under `@backup/gentoo`, read a selected file from it,
and confirm the restore path.

### 8. Configure `Borg 1.x`

Mount `@backup` and confirm that `findmnt` shows the second disk's Btrfs
`@backup` subvolume. If it does not, stop; do not create repositories in the
ordinary `/mnt/backup` directory on the system disk.

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
```

After that check, create two encrypted repositories. Export their keys off the
second NVMe; store the passphrase in a password manager and in a `root-only`
file for automation:

```bash
doas borg init --encryption=repokey /mnt/backup/home.borg
doas borg init --encryption=repokey /mnt/backup/etc.borg
doas borg key export /mnt/backup/home.borg "<OFF-DEVICE-PATH>/home.borg.key"
doas borg key export /mnt/backup/etc.borg "<OFF-DEVICE-PATH>/etc.borg.key"

doas install -d -m 0700 -o root -g root /etc/borg
doas install -m 0600 -o root -g root /dev/null /etc/borg/passphrase
doas umount /mnt/backup
```

Write the `Borg` passphrase to `/etc/borg/passphrase`; the file must be owned by
root:root and have mode 0600.

File: `/etc/borg/home.exclude`

```text
home/<username>/data/
home/<username>/.cache/
home/<username>/llvm-project/
home/<username>/llvm-for-bolt-perf/
home/<username>/Downloads/
home/<username>/.steam/
home/<username>/.local/share/Trash/
*/.venv
*/__pycache__
*/node_modules
*.pyc
```

These are the accepted /home exclusions. data/ is required because it is on
the same physical disk as the repositories. Keep `--exclude-caches` as a
separate `Borg` option. Before the first backup, test this same exclude file
with `borg create --dry-run --list --filter x` and confirm that
`home/<username>/data/` is listed as excluded.

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
```

Confirm that `findmnt` shows the second disk's Btrfs `@backup` subvolume; if
the mount is not confirmed, stop. Then check the exclusions and unmount it:

```bash
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' borg create --dry-run --list \
  --filter x \
  --exclude-from /etc/borg/home.exclude --exclude-caches \
  /mnt/backup/home.borg::dryrun "/home/<username>"
doas umount /mnt/backup
```

### 9. Configure one backup service and timer

File: `/usr/local/bin/second-disk-backup.sh`

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_TARGET=/mnt/backup
REPO_HOME=$BACKUP_TARGET/home.borg
REPO_ETC=$BACKUP_TARGET/etc.borg
export BORG_PASSCOMMAND='cat /etc/borg/passphrase'
mounted_by_us=0

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if (( mounted_by_us )) && findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
    umount "$BACKUP_TARGET" || rc=1
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
  echo "ERROR: $BACKUP_TARGET is already mounted; investigate first" >&2
  exit 1
fi

mount "$BACKUP_TARGET"
mounted_by_us=1
btrbk run

STAMP=$(date +%Y-%m-%d_%H-%M-%S)
borg create --stats --exclude-from /etc/borg/home.exclude --exclude-caches \
  "$REPO_HOME::home-$STAMP" "/home/<username>"
borg create --stats --exclude-caches \
  "$REPO_ETC::etc-$STAMP" /etc

for repo in "$REPO_HOME" "$REPO_ETC"; do
  borg prune --keep-daily 14 --keep-weekly 4 --keep-monthly 6 "$repo"
  borg compact "$repo"
done
```

set -e preserves a failing `btrbk`/`Borg` status. The EXIT trap attempts to
unmount `@backup` after success, a command failure, or handled SIGINT/SIGTERM.
An unmount failure also returns a non-zero status, which systemd reports as a
failed service. Do not add || true to backup commands.

File: `/etc/systemd/system/second-disk-backup.service`

```ini
[Unit]
Description=Second-disk backup orchestration (btrbk + Borg)

[Service]
Type=oneshot
ExecStart=/usr/local/bin/second-disk-backup.sh
IOSchedulingClass=idle
Nice=10
```

File: `/etc/systemd/system/second-disk-backup.timer`

```ini
[Unit]
Description=Daily second-disk backup (btrbk + Borg)

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

A single `Type=oneshot` service does not start a parallel copy while its
previous run is active; the timer activates the same unit. Enable the timer
only after manually checking the first backup and restore:

```bash
doas chmod 0755 /usr/local/bin/second-disk-backup.sh
doas systemctl daemon-reload
doas systemctl enable --now second-disk-backup.timer
systemctl list-timers second-disk-backup.timer
```

## Acceptance checks

The scheme is ready only after these checks pass:

- the passphrase was tested against its LUKS keyslot separately from `TPM2`;
  `TPM2` unlock also works;
- Gentoo is the default and normal boot succeeds: `@data` is mounted and
  `@backup` is not mounted outside a backup job;
- absence of the disk or TPM unlock failure does not break boot or prompt
  interactively; the unavailable `@data` mount point does not accept writes on
  the system disk;
- `btrbk config print` and `btrbk run -n` succeed; the received snapshot is
  readable and its restore path has been checked;
- `borg list` shows the archives, `borg extract --dry-run` can read a chosen
  archive, exclusions have been checked, and repository keys are stored
  off-device;
- a small real `Borg` restore has been performed into an empty temporary
  directory;
- `@backup` is unmounted after successful and failed backup runs, or the
  service exits with a visible failure.

Do not test disk failure by deleting keys or running other destructive
commands. Validate the boot failure case separately under a safe
implementation plan.

To verify `Borg` after a backup, mount `@backup` and confirm that `findmnt`
shows this subvolume on the second disk:

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' borg list /mnt/backup/etc.borg
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' \
  borg extract --dry-run "/mnt/backup/etc.borg::etc-<STAMP>" etc/fstab
doas install -d -m 0755 -o root -g root /tmp/borg-restore-test
cd /tmp/borg-restore-test
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' \
  borg extract "/mnt/backup/etc.borg::etc-<STAMP>" etc/fstab
doas cat etc/fstab
cd /
doas umount /mnt/backup
```

Inspect the restored file, then remove the temporary directory manually.

## Rollback and recovery

To disable the scheme, stop and disable the timer, remove only the added
cryptdata/`Btrfs` entries from `/etc/crypttab` and `/etc/fstab`, then run
systemctl daemon-reload. Confirm both subvolumes are unmounted before closing
the mapping. The old Arch system cannot be restored from the disk after it is
erased; verify the required data in `/root/arch-rescue` before the destructive
gate.

---

Sources: [systemd crypttab(5)](https://www.freedesktop.org/software/systemd/man/latest/crypttab.html),
[systemd-cryptenroll(1)](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html),
[cryptsetup open(8)](https://man7.org/linux/man-pages/man8/cryptsetup-open.8.html),
[fstab(5)](https://man7.org/linux/man-pages/man5/fstab.5.html),
[systemd.mount(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html),
[systemd.service(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html),
[systemd.timer(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html),
[bootctl(1)](https://www.freedesktop.org/software/systemd/man/latest/bootctl.html),
[Btrfs subvolumes](https://btrfs.readthedocs.io/en/latest/Subvolumes.html),
[btrbk(1)](https://digint.ch/btrbk/doc/btrbk.1.html),
[btrbk.conf(5)](https://digint.ch/btrbk/doc/btrbk.conf.5.html),
[Borg 1.4 create](https://borgbackup.readthedocs.io/en/stable/usage/create.html),
[extract](https://borgbackup.readthedocs.io/en/stable/usage/extract.html) and
[prune](https://borgbackup.readthedocs.io/en/stable/usage/prune.html),
[Gentoo app-backup/btrbk](https://packages.gentoo.org/packages/app-backup/btrbk) and
[app-backup/borgbackup](https://packages.gentoo.org/packages/app-backup/borgbackup).

General Btrfs, boot, and TPM guidance: [Btrfs setup](../../../../filesystem/btrfs-setup/),
[systemd UKI setup](../../../../installation/systemd-uki-setup/), and
[Secure Boot and TPM](../../../../installation/secure-boot-tpm/).
