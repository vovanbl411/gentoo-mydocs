---
title: Btrfs and Snapper on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Current state

- The root filesystem uses Btrfs with a flat subvolume layout. Compression uses
  `compress=zstd:3`; `noatime` and `discard=async` are also set.
- `/var/tmp/portage` is a 16 GiB tmpfs.
- The Portage tree, distfiles, ccache, sccache, Docker data, and libvirt data use separate subvolumes.
- Snapper creates hourly and boot snapshots; the cleanup timer removes old
  snapshots according to the configured limits. Btrfs quotas are disabled.
- Portage pre/post snapshots around `emerge` are not configured.

## Btrfs layout

| Subvolume | Mount point | Purpose |
|---|---|---|
| `@` | `/` | system root |
| `@home` | `/home` | home directories |
| `@snapshots` | `/.snapshots` | Snapper snapshots |
| `@var_log` | `/var/log` | system logs |
| `@var_cache` | `/var/cache` | system caches |
| `@distfiles` | `/var/cache/distfiles` | Portage source archives |
| `@ccache` | `/var/tmp/ccache` | ccache data |
| `@sccache` | `/var/tmp/sccache` | sccache data |
| `@portage_tree` | `/var/db/repos/gentoo` | Gentoo repository tree |
| `@docker` | `/var/lib/docker` | Docker data |
| `@libvirt` | `/var/lib/libvirt` | libvirt data and virtual machine images |
| `@portage_tmp` | `/var/tmp/portage-disk` | disk-backed temporary files for large builds |

## Build and cache storage

`/var/tmp/portage` is a 16 GiB tmpfs with `uid=portage`, `gid=portage`,
`mode=775`, `nosuid`, `nodev`, and `noatime`. It keeps working build files
outside Btrfs snapshots.

`/etc/portage/make.conf` sets the cache directories and limits:

- ccache: `/var/tmp/ccache`, `CCACHE_SIZE="20G"`;
- sccache: `/var/tmp/sccache`, `SCCACHE_CACHE_SIZE="20G"`.

The `+C` attribute is set on `/var/tmp/ccache`, `/var/tmp/sccache`,
`/var/tmp/portage-disk`, `/var/lib/docker`, and `/var/lib/libvirt`. See the
[general Btrfs guide](../../../../filesystem/btrfs-setup/) for NoCoW inheritance
details.

## Snapper

The `root` configuration in `/etc/snapper/configs/root` applies to `/`. Access
to snapshots is granted to the `wheel` group (`ALLOW_GROUPS="wheel"`,
`SYNC_ACL="yes"`).

The enabled timers are `snapper-timeline.timer` for hourly snapshots,
`snapper-cleanup.timer` to remove old snapshots, and `snapper-boot.timer` for
boot snapshots. Retention policy:

- 2 hourly and 3 daily snapshots; weekly, monthly, quarterly, and yearly
  limits are 0;
- count-based cleanup: `NUMBER_LIMIT="10"`, `NUMBER_LIMIT_IMPORTANT="5"`.

`SPACE_LIMIT="0.8"` and `FREE_LIMIT="0.2"` are set in the configuration.
Btrfs quotas are disabled, so these values do not affect space-aware cleanup.
Snapshot retention follows the count limits above.

`/etc/portage/bashrc` has no Snapper pre/post hook. It only invokes
`PORTAGE_SCHEDULING_COMMAND`.

## Related docs

- [Btrfs layout](../../../../filesystem/btrfs-setup/)
- [Snapper](../../../../filesystem/snapper-backups/)
