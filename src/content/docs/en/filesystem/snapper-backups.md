---
title: Configuring Snapper
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Snapper creates Btrfs snapshots and manages them: it lets you compare
snapshots, roll back changes and restore individual files. It does not
replace a separate data backup, and it does not create snapshots around
`emerge` without additional Portage integration.

This guide uses the `root` configuration for the root subvolume `@`.
Automatic timeline, cleanup and boot operations are handled by systemd
timers. The Portage pre/post hook is described separately as an optional
variant; on the ASUS B5402 it is currently not active.

The expected result is a user-accessible snapshot history, automatic creation
and deletion under a defined policy, and a clear way to check timers and
space usage. The confirmed ASUS B5402 state and its verification date are
recorded in [the system section](../../systems/asus-b5402/filesystem/layout-and-snapshots/).

## Prerequisites

Before setup you need:

- a Btrfs root filesystem;
- a separate location for snapshots, for example the `@snapshots` subvolume
  mounted at `/.snapshots`;
- a Snapper `root` configuration for the `/` mount point;
- a chosen retention policy that accounts for free space.

A Btrfs snapshot stays on the same filesystem. Independent recovery after
losing the drive requires a separate backup.

## Configuration and permissions

File: `/etc/snapper/configs/root`

To let users of the `wheel` group manage snapshots without root, set:

```conf
ALLOW_GROUPS="wheel"
SYNC_ACL="yes"
```

After changing the configuration, apply the permissions:

```bash
doas snapper -c root setup-acl
```

## Automatic snapshots and systemd timers

The following timers are used for automatic management:

- `snapper-timeline.timer` creates hourly snapshots;
- `snapper-cleanup.timer` runs hourly cleanup of old snapshots according to
  the limits in the configuration;
- `snapper-boot.timer` optionally creates a snapshot on every boot.

Check activity and the next run time:

```bash
systemctl status "snapper-*.timer"
systemctl list-timers "snapper-*"
```

Forcing a cleanup run is for maintenance or policy checks, not for routine
snapshot creation:

```bash
doas systemctl start snapper-cleanup.service
```

## Portage integration

Pre/post snapshots around `emerge` are not a built-in part of the basic
Snapper setup. They need a separate hook, for example in
`/etc/portage/bashrc`: before an operation it creates a Pre snapshot, after
it — a linked Post snapshot.

On the reference ASUS B5402 the Portage pre/post hook is currently not used.
The current confirmed state is in
[the system section](../../systems/asus-b5402/filesystem/layout-and-snapshots/).

If snapshots around `emerge` are needed again, the hook must be restored as
a separate, deliberate change. It is not required for timeline or boot
snapshots.

## Cleanup policy

Limits keep snapshots from taking up space uncontrollably. Tune them to the
filesystem size and the history depth you need.

The ASUS B5402 values below are an example, not a universal norm:

- the timeline keeps the last 2 hours and the last 3 days; the weekly, monthly,
  and yearly limits are 0. Reduced from 5 hours / 7 days / weekly 1 following
  the disk audit on 2026-10-02;
- `NUMBER_LIMIT="10"` bounds the numbered snapshots processed by the
  `number` cleanup, regardless of how they were created;
- `SPACE_LIMIT="0.8"` and `FREE_LIMIT="0.2"` are effectively not in use:
  space-aware cleanup requires btrfs quota to be enabled and range-style
  limit values, while quota is disabled on the reference system
  (`btrfs qgroup show /` → quotas not enabled, verified 2026-10-02).
  Snapshot retention is purely count-based.

`NUMBER_LIMIT="10"` does not mean "10 pairs of Portage snapshots". Such pairs
are only created by a separate hook, which does not exist in the described
ASUS B5402 state.

> **Note**: `snapper set-config` in snapper 0.13.1 takes each `KEY=VALUE`
> pair as a separate argument, contrary to the single-string example in
> `man snapper`. The form `set-config "A=1 B=2"` writes `1 B=2` as the value
> of `A`; the correct form is `snapper -c root set-config "A=1" "B=2"`.

## Everyday usage and recovery

### Viewing the history

```bash
snapper list
```

### Analyzing changes

```bash
# Show the file-level difference between snapshots 15 and 16
snapper status 15..16

# Show the specific changes in a file
snapper diff 15..16 /etc/conf.d/net
```

### Rolling back changes

Before rolling back, check the snapshot numbers you selected and the list of
changes. The commands below modify current files.

```bash
# Undo changes between linked pre and post snapshots
snapper undochange 15..16

# Restore one accidentally deleted file from snapshot 10
snapper restore -s 10 /etc/fstab
```

## Verification and monitoring

Check the snapshot list and the timers:

```bash
snapper list
systemctl status "snapper-*.timer"
systemctl list-timers "snapper-*"
```

Plain `df` does not show how Btrfs distributes data across subvolumes. The
size of the snapshot directory can be checked separately:

```bash
doas btrfs filesystem du -s /.snapshots
```

`snapperd` sleeps and is started on demand over D-Bus. A `static/inactive`
state by itself does not mean the service is broken.

After setup, make sure that:

- the `root` configuration is accessible to the expected group;
- the timers you need are active and have a next run time;
- new snapshots appear in `snapper list`;
- cleanup follows the configured limits;
- space usage in `/.snapshots` stays within expectations.

## Related docs

- [Btrfs and Snapper on ASUS B5402](../../systems/asus-b5402/filesystem/layout-and-snapshots/) — the actual configuration and the confirmed state of the machine.
- [Btrfs structure and subvolumes](../btrfs-setup/) — layout, mount options, tmpfs and CoW.
