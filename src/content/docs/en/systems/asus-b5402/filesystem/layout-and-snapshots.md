---
title: Btrfs and Snapper on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Current state

- The root filesystem is Btrfs, with a flat set of subvolumes:
  `@`, `@home`, `@snapshots`, and separate subvolumes for builds and caches.
- Compression is `zstd:3`.
- Portage's working directory, `/var/tmp/portage`, is a 16 GiB tmpfs.
- Snapper creates timeline and boot snapshots through systemd timers.
- Automatic pre/post snapshots around `emerge` are currently not configured.

## Btrfs layout

Subvolumes:

```text
@               — system root
@home
@snapshots
@var_log
@var_cache
@distfiles
@ccache
@portage_tree
@docker
@libvirt
@portage_tmp
```

NVMe mount options: `compress=zstd:3`, `noatime`, `discard=async`,
`space_cache=v2`.

## Build and cache storage

Portage's build storage is kept outside the snapshotted root:

| Subvolume | Mount point | Purpose |
|---|---|---|
| `@ccache` | `/var/tmp/ccache` | compiler cache; `nodatacow` on the directory is confirmed |
| `@portage_tmp` | `/var/tmp/portage-disk` | temporary files for large builds |
| `@distfiles` | `/var/cache/distfiles` | package source archives |
| `@var_cache` | `/var/cache` | other system cache |
| `@portage_tree` | `/var/db/repos/gentoo` | Gentoo tree |

The working directory `/var/tmp/portage` is a 16 GiB tmpfs
(`uid=portage`, `nosuid`, `nodev`, `noatime`).

## Snapper

Snapper creates timeline and boot snapshots. Automatic pre/post snapshots
around `emerge` are currently not configured.

The `root` configuration:

```text
ALLOW_GROUPS="wheel"
SYNC_ACL="yes"
TIMELINE_LIMIT_HOURLY=5
TIMELINE_LIMIT_DAILY=7
TIMELINE_LIMIT_WEEKLY=1
TIMELINE_LIMIT_MONTHLY=0
NUMBER_LIMIT=10
NUMBER_LIMIT_IMPORTANT=5
SPACE_LIMIT=0.8
```

`TIMELINE_LIMIT_*` controls how many timeline snapshots are retained;
`NUMBER_LIMIT` is the number-cleanup limit, not a separate limit for `emerge`
snapshots.

Automation uses systemd timers (timeline, cleanup, boot).

There is no Portage hook in `/etc/portage/bashrc`: bashrc contains only
`PORTAGE_SCHEDULING_COMMAND` for p-cores and does not create pre/post snapshots
for `emerge`.

## Verification

- Btrfs was rechecked against live `findmnt` output on 2026-09-22; subvolumes
  were confirmed by their mounts on 2026-09-12.
- `/var/tmp/portage` (16 GiB tmpfs) was confirmed on 2026-09-12.
- Snapper was checked against `/etc/snapper/configs/root` on 2026-09-22.
- The absence of a Portage hook was checked in `/etc/portage/bashrc` on
  2026-09-22.

## Related docs

- [Btrfs layout](../../../../filesystem/btrfs-setup/)
- [Snapper](../../../../filesystem/snapper-backups/)
