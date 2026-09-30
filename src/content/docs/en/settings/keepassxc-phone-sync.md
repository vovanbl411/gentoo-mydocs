---
title: KeePassXC phone sync with Android via Syncthing
kind: guide
scope: mixed
status: current
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

Normal bidirectional sync of the live KeePassXC database between Gentoo and
Android was accepted on the ASUS ExpertBook B5402 on 2026-09-30 (PASS).
Syncthing runs on Gentoo; Android uses Syncthing-Fork and KeePassDX. Sync is
not a backup: Google Drive and local backups remain a separate layer.

Recovery from a real conflict between two concurrently modified copies,
followed by a KeePassXC merge, has not passed acceptance. Its status remains
PENDING.

## Current architecture

```text
KeePassXC (Gentoo)
~/Documents/KeePassSync/
          ↕
      Syncthing
          ↕
Documents/KeePassSync
KeePassDX (Android)

Independent backup:
live KDBX → daily verified snapshot → ~/Backups/KeePassXC/
          → rclone copy → Google Drive → local rotation after successful delivery
```

Syncthing transports only the live database in `~/Documents/KeePassSync/`.
The `~/Backups/KeePassXC/` directory is not synced through Syncthing. Google
Drive is only the destination for backup copies, not a live filesystem.

## Requirements

- A Gentoo workstation with `net-p2p/syncthing-2.0.16`, a systemd --user
  service, and KeePassXC.
- Android with Syncthing-Fork and KeePassDX.
- A dedicated live database directory on each side.
- The same Folder ID, `keepassxc-live`, on Gentoo and Android.

## Gentoo: Syncthing and the live directory

On Gentoo, Syncthing runs as a user service; `Linger=no`. Its GUI/API is
available locally on loopback at port `8384`. The devices use the standard
TCP/QUIC listeners; a secure connection between Gentoo and Android and data
transfer over LAN have been verified.

In the Syncthing GUI, create the live database folder and share it with
Android. Use these settings for that folder:

| Setting | Value |
|---------|-------|
| Folder Label | `KeePassXC Live` |
| Folder ID | `keepassxc-live` |
| Folder Path | `~/Documents/KeePassSync/` |
| Folder Type | `Send & Receive` |
| Watch for Changes | enabled |
| File Versioning | `No File Versioning` |
| Ignore Permissions | disabled |

There is exactly one working top-level KDBX in `~/Documents/KeePassSync/`;
the file mode on Gentoo is `0600`. Folder ID identifies the shared folder; it
is not its display label.

## Android: Syncthing-Fork and KeePassDX

In Syncthing-Fork, accept the folder shared from Gentoo and set its local path
to `Documents/KeePassSync`. Verify the Folder ID is `keepassxc-live`, the type
is `Send & Receive`, File Versioning is `No File Versioning`, and Ignore
Permissions is enabled.

The Android Folder Label may differ from `KeePassXC Live`; the Folder ID must
match. After sync, open the existing live database in KeePassDX from
`Documents/KeePassSync/` and save changes to that database. Do not open a
Google Drive backup copy as the live database.

## Accepted bidirectional verification

The following checks passed on the ASUS B5402 on 2026-09-30:

| Check | Result |
|-------|--------|
| Initial Gentoo → Android transfer; the database appeared in `Documents/KeePassSync/` and opened in KeePassDX | PASS |
| An edit in Gentoo KeePassXC appeared in KeePassDX after sync | PASS |
| A subsequent KeePassDX edit synced back to Gentoo and appeared in KeePassXC | PASS |
| Normal bidirectional workflow | CLOSED / PASS |

A controlled test entry was used for these checks. Its contents and production
database data are not included in this guide.

## Relationship to the backup pipeline

Live sync and backup are separate layers:

- Syncthing syncs only the live `~/Documents/KeePassSync/` directory.
- The backup wrapper independently snapshots the current live KDBX, delivers
  top-level `*.kdbx` files from `~/Backups/KeePassXC/` with `rclone copy` to
  Google Drive, and runs local rotation only after successful delivery.
- KeePassXC also keeps its built-in timestamped backup on a local save.

An Android-originated edit does not have to pass through a local KeePassXC
save, so the daily snapshot remains necessary regardless of which editor made
the change. On 2026-09-30, local backup files were confirmed to remain present
after moving the live database and enabling phone sync. The repeated check did
not record a file count, names, or hashes.

## Conflicts and recovery

The accepted policy for an additional `*.kdbx` conflict copy is:

1. Do not delete a conflict copy by guesswork.
2. Merge the needed entries from the conflicting copies with KeePassXC.
3. Verify the resulting database, then remove the conflict copy.

The backup wrapper requires exactly one top-level regular, non-symlink
`*.kdbx` in the live directory. If it finds zero or multiple files, it stops
before snapshot, delivery, and rotation. This is a startup conflict gate, not
a lock on Syncthing while it is syncing.

Recovery status is **PENDING / NOT YET ACCEPTED**: an end-to-end conflict
between two concurrently modified versions and the subsequent merge have not
been tested.

## If sync does not transfer the database

- Compare the Folder ID on both sides. It must be exactly `keepassxc-live`;
  the Folder Label may differ.
- If Android has a different generated Folder ID, Syncthing treats the folders
  as separate entities and does not transfer the KDBX. In the accepted setup,
  initial sync started after the Android Folder ID was corrected to
  `keepassxc-live`.
- Separate NAT-PMP errors do not by themselves mean sync is broken. In the
  accepted setup, the secure LAN connection and data transfer worked despite
  those messages.
- If the connection is established and files transfer, a NAT-PMP warning is
  not a blocker for this local setup.

## Related documents

- [KeePassXC backups to Google Drive](../keepassxc-backup/) — the separate
  backup pipeline and local rotation.
- [ASUS ExpertBook B5402 applications](../../systems/asus-b5402/applications/)
  — current workstation state.
