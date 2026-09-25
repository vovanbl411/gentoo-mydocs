---
title: Btrfs structure and subvolumes
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Splitting Btrfs into subvolumes lets you manage parts of the filesystem
separately: include the data you need in snapshots, keep logs and caches out
of them, and apply separate VFS options or attributes for special workloads
where applicable. Most Btrfs-specific mount options apply to the whole
filesystem, not to an individual subvolume.

This guide uses a flat layout: subvolumes are created at a single level and
mounted into the directories you need. As a result, the root, home data,
snapshots and mutable service directories do not depend on a nested subvolume
hierarchy.

The layout below is an example, not a mandatory configuration for every
system. Choose subvolumes based on which data should end up in snapshots and
which directories need separate VFS options or attributes. The actual ASUS
B5402 layout is recorded in
[the system section](../../systems/asus-b5402/filesystem/layout-and-snapshots/).

## When to apply this layout

The approach fits a Btrfs root filesystem when you want to manage snapshots,
persistent data, caches and temporary files separately. Before creating the
layout, decide:

- what should be included in a snapshot of the root;
- which data needs its own subvolume;
- which Btrfs-specific options will apply to the whole filesystem;
- which mount points will use tmpfs or separate VFS options, and which
  workloads need file or directory attributes;
- how much memory you can give to Portage builds.

The expected result is a clear set of independently mounted subvolumes where
snapshots do not capture unneeded logs, caches and temporary data.

## General design

The flat layout separates the logical structure of subvolumes from the
directories they are mounted into. The name itself — `@`, `@home` or
`@snapshots` — does not define a mount point: the mapping is determined by
the system's mount configuration.

Create a separate subvolume only where you need a separate snapshot boundary
or a separate mount point. A subvolume by itself does not create an
independent set of Btrfs-specific mount options: most of those parameters
apply to the entire filesystem and are usually set by its first mount.
Having many subvolumes is not a goal in itself.

## Example layout

One possible variant:

| Subvolume | Mount point | Purpose |
|-----------|-------------|---------|
| `@` | `/` | system root |
| `@home` | `/home` | user data |
| `@snapshots` | `/.snapshots` | Snapper snapshots |
| `@var_log` | `/var/log` | logs kept out of root snapshots |
| `@var_cache` | `/var/cache` | system cache |
| `@distfiles` | `/var/cache/distfiles` | package source files |
| `@ccache` | `/var/tmp/ccache` | C/C++ compiler cache |
| `@portage_tree` | `/var/db/repos/gentoo` | Gentoo tree |
| `@docker` | `/var/lib/docker` | Docker container data |
| `@libvirt` | `/var/lib/libvirt` | KVM/QEMU virtual machine images |
| `@portage_tmp` | `/var/tmp/portage-disk` | temporary files of heavy builds |

Do not copy this list wholesale unless you need it. For example, separate
Docker, libvirt or ccache subvolumes are only needed when the corresponding
workload is actually used.

## Mount options

For NVMe in `/etc/fstab` you can use the following parameters:

- `ssd` — optimizations for solid-state drives;
- `compress=zstd:3` — transparent compression balancing speed and space
  savings;
- `discard=async` — background discarding of unused blocks (TRIM).

These are Btrfs-specific options. Like `nodatacow`, they apply to the
filesystem as a whole and are usually set by its first mount; repeating
different values for subvolumes does not create independent operating modes.

Regular VFS options can be applied to an individual mount point if the
specific option supports it. For example:

- `noatime` — disabling access-time updates for the selected mount.

For special workloads, use per-file or per-directory attributes and
properties where they apply. For example, `chattr +C` sets NOCOW for newly
created data via a directory attribute rather than a separate subvolume mode.

## tmpfs for Portage

The Portage working directory can be moved into RAM to reduce temporary
writes to the SSD and speed up package compilation:

- `/var/tmp/portage` — an example tmpfs mount point;
- the size is chosen based on RAM capacity and build requirements.

Before such a change, account for peak memory consumption when building
large packages. The on-disk `/var/tmp/portage-disk` from the layout example
remains a separate option for heavy builds.

## CoW and NOCOW

Btrfs uses copy-on-write (CoW) by default. This is useful for snapshots and
corruption protection, but files that are constantly rewritten in small
blocks can fragment badly and lose performance, especially in IOPS. In this
example such data includes:

1. virtual machine images in `/var/lib/libvirt/images`;
2. Docker images and database volumes;
3. compilation temporary files in `/var/tmp/portage-disk`;
4. constantly rewritten ccache objects in `/var/tmp/ccache`.

This is a list of workloads from the example, not a requirement to disable
CoW on every subvolume with the same name.

### Applying `chattr +C`

> **Important Btrfs rule**: files newly created in a directory with the `C`
> attribute inherit it. Existing files do not automatically become NOCOW, so
> the attribute must be set before creating new files or copying existing
> data into the prepared directory.

For empty directories:

```bash
# For virtual machines
doas chattr +C /var/lib/libvirt/images

# For the on-disk Portage temporary directory
doas chattr +C /var/tmp/portage-disk

# For ccache
doas chattr +C /var/tmp/ccache

# For an existing empty Docker database volume, if there is one
doas chattr +C /var/lib/docker/volumes/my_db_volume/_data
```

> **Note**: NOCOW data does not use data checksums or compression. The `C`
> attribute on a directory sets this behavior for new files that inherit it;
> it does not change existing files automatically.

### Moving existing files

If `/var/lib/libvirt/images` already contains images, first stop the
processes that can modify them and make sure you have a current backup.
Create a new directory with the `+C` attribute and copy the data without
reflinks:

```bash
doas mkdir /var/lib/libvirt/images_new
doas chattr +C /var/lib/libvirt/images_new
doas cp -a --reflink=never /var/lib/libvirt/images/* /var/lib/libvirt/images_new/
```

Verify the copy is complete before deleting the original directory. The
command below irreversibly deletes the original images; run it only after
verification and with the virtual machines stopped:

```bash
doas rm -rf /var/lib/libvirt/images
doas mv /var/lib/libvirt/images_new /var/lib/libvirt/images
```

If the copy check failed, do not delete the original directory: fix the
transfer, or delete only the new `images_new` and repeat the procedure.

## Maintenance

Use scrub to monitor Btrfs health; in this example the integrity check runs
once a month. Balance redistributes data and is relevant when the disk is
more than 80% full; it is not part of every routine check.

```bash
# View device error statistics
doas btrfs device stats /

# Start a background integrity check
doas btrfs scrub start /

# Check the status of a running scrub
doas btrfs scrub status
```

A scrub can be a long operation on a live filesystem. Plan it with the
current load in mind and track its state with a separate command.

## Verification

After setup, check:

- the mount points and the subvolumes mapped to them;
- the expected mount options;
- that tmpfs is mounted at the chosen Portage working directory;
- the `+C` attribute on directories where it was set before writing data;
- error statistics and the state of the latest scrub.

## Related docs

- [Btrfs and Snapper on ASUS B5402](../../systems/asus-b5402/filesystem/layout-and-snapshots/) — the confirmed state of the reference machine.
- [Snapper](../snapper-backups/) — configuring and working with snapshots.
