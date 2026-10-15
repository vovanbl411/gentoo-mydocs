---
title: "Portage usersync: Permission denied and inconsistent repository ownership"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-10-15"
verified_on: [gentoo-builder-01]
---

If rsync synchronization of the Gentoo tree with `FEATURES=usersync` cannot
remove `.tmp-unverified-download-quarantine` or fails with
`RepoStorageException` and `rsync` status `23`, check ownership throughout
the repository. On [gentoo-builder-01](../../systems/gentoo-builder-01/),
the top-level directory belonged to `portage:portage`, while tens of thousands
of subdirectories belonged to `root:root`. After this mismatch was confirmed,
restoring consistent ownership throughout the tree allowed sync to complete.
Status `23` alone does not prove an ownership problem: run the checks below first.

## What happened, in plain terms

For rsync synchronization in the verified configuration, Portage first prepares
a separate temporary tree, `.tmp-unverified-download-quarantine`. It downloads
the update there, verifies it, and only then transfers its contents to the
working repository. Finally, it removes the temporary tree.

```text
Working Gentoo repository
        ↓
Portage prepares quarantine
        ↓
Downloads the updated tree into quarantine
        ↓
Verifies the download
        ↓
rsync quarantine → working repository
        ↓
Removes quarantine
```

With `FEATURES=usersync`, Portage drops privileges to the repository owner.
If that is `portage:portage`, the `portage` user must be able to modify the
entire tree. Running `emaint` through `doas` does not remove this requirement.

On the builder, ownership and permissions looked like this:

```text
/var/db/repos/gentoo                         portage:portage 755
├── .tmp-unverified-download-quarantine      root:root       755
└── part of the working tree                 root:root       755
```

Mode `755` lets other users read and traverse a directory, but only its owner
can modify its contents. This prevented `portage` from cleaning up the old
quarantine. After it was removed, the new quarantine was created with the
correct owner, but applying the update to the working tree still ran into
directories owned by `root:root`: the final `rsync -a --delete` could not
replace their contents.

Removing quarantine cleared only the first obstacle. Consistent ownership
throughout the repository cleared the second.

## Safe diagnosis

This procedure applies to an rsync repository using `usersync` with a confirmed
ownership mismatch. The examples use `/var/db/repos/gentoo` and
`portage:portage`; for a different configuration, first establish the actual
path and intended owner. Inspect the tree while no sync is running.

### 1. Confirm the sync mode, path, and owner

```bash
portageq envvar FEATURES
portageq get_repo_path / gentoo
doas stat -c '%U:%G %a %n' \
    /var/db/repos/gentoo \
    /var/db/repos/gentoo/.tmp-unverified-download-quarantine
```

The effective `FEATURES` must include `usersync`. In the `[gentoo]` entry
under `/etc/portage/repos.conf` (a file or a configuration directory), check
`location`, `sync-type = rsync`, and any explicit `sync-user` setting.
Determine the intended owner from your repository configuration;
`portage:portage` is not a universal value for every installation.
It is normal for quarantine to be absent between synchronizations:
`stat` will then report that the path does not exist.

For a specific path from the error, inspect the entire directory chain.
Replace `<path>` with the relative path inside quarantine; do not enter
the placeholder literally:

```bash
doas namei -l \
    '/var/db/repos/gentoo/.tmp-unverified-download-quarantine/<path>'
```

### 2. Check the working tree's subdirectories

Checking `/var/db/repos/gentoo` alone is insufficient: correct ownership
of the top-level directory does not fix ownership of its subdirectories.

```bash
doas find /var/db/repos/gentoo \
    -xdev \
    ! -path '/var/db/repos/gentoo/.tmp-unverified-download-quarantine*' \
    -type d \
    \( ! -user portage -o ! -group portage \) \
    -printf '%u:%g %m %p\n' \
    | head -100
```

To count all such directories, without limiting the result to the first hundred:

```bash
doas find /var/db/repos/gentoo \
    -xdev \
    ! -path '/var/db/repos/gentoo/.tmp-unverified-download-quarantine*' \
    -type d \
    \( ! -user portage -o ! -group portage \) \
    -printf '.\n' \
    | wc -l
```

The builder had **27,896 directories** whose owner or group differed
from `portage:portage`, including:

```text
root:root 755 /var/db/repos/gentoo/games-arcade
root:root 755 /var/db/repos/gentoo/games-arcade/orthorobot
```

## Fix after confirming the cause

Before making changes, ensure that sync has finished, the path points to the
intended repository, and it contains no unrelated mountpoints or local data
with intentionally different ownership. The diagnostic commands using `-xdev`
do not inspect other filesystems, whereas `chown -R` below can cross into them.

### Remove leftover quarantine

If an old quarantine owned by root prevents a new sync from starting, you can
remove just this unverified temporary tree:

```bash
doas rm -rf /var/db/repos/gentoo/.tmp-unverified-download-quarantine
```

> **Important:** this command permanently deletes the contents of the specified
> directory. Check the exact path and ensure no sync is running. The next sync
> will prepare and download the temporary tree again; deleting it does not fix
> ownership of the working repository.

On the builder, the new quarantine had `portage:portage 755` after this cleanup,
but the final update step still failed with:

```text
portage.repository.storage.interface.RepoStorageException:
command exited with status 23:
rsync -a --delete ...
```

### Restore ownership throughout the repository

Only if you have confirmed that **the entire tree should belong to
`portage:portage`** and that the mismatch is widespread:

```bash
doas chown -R portage:portage /var/db/repos/gentoo
doas emaint sync -a
```

Changing ownership recursively affects every file and directory under this path.
If you need a rollback, first save a snapshot or backup of the tree that
preserves its original owners and permissions; restore from it while sync is
stopped. Running `chown -R root:root` does not restore the original distribution
of owners. After a sync has completed, returning to the previous contents
also requires a saved copy.

Correct the confirmed ownership mismatch throughout the tree. `chmod 777`,
disabling `usersync`, and fixing category directories one at a time do not
resolve this case; no change to Portage's operating model was needed.

## Verify the result

After `doas emaint sync -a` completes successfully, check the entire tree,
including files:

```bash
doas find /var/db/repos/gentoo \
    -xdev \
    \( ! -user portage -o ! -group portage \) \
    -print
```

Expect no output and no traversal errors. Then check quarantine cleanup
and the repository state:

```bash
test ! -e /var/db/repos/gentoo/.tmp-unverified-download-quarantine \
    && echo 'quarantine cleanup: OK'

emerge --info | grep -E \
    'Timestamp of repository gentoo|Head commit of repository gentoo'
```

Expect `quarantine cleanup: OK` and information about the synchronized repository.
The timestamp and commit change with subsequent updates; they do not replace
a successful sync exit status. If the error persists with consistent ownership,
investigate the specific `rsync` messages: status `23` alone does not identify
a single cause.

## How this affected gentoo-builder-01

The problem was reproduced and fixed on `gentoo-builder-01` with
Portage `3.0.82.2` and an rsync Gentoo repository.

The root of `/var/db/repos/gentoo` already belonged to `portage:portage`, so
the configuration looked correct at first glance. Checking the entire tree
revealed otherwise: a large share of its subdirectories belonged to
`root:root` — **27,896 directories** in total had an owner or group
that differed from `portage:portage`.

With `FEATURES=usersync` enabled, synchronization ran as `portage`, which
could not modify part of the existing repository. This first appeared during
cleanup of the old quarantine owned by `root:root`. After it was removed,
the new quarantine was created correctly, owned by `portage:portage`, but
the final `rsync` into the working tree still exited with status `23`.

After consistent ownership was restored:

```bash
doas chown -R portage:portage /var/db/repos/gentoo
```

running `doas emaint sync -a` again succeeded, and the temporary quarantine
was removed normally.

The exact reason the old tree ended up owned by `root:root` has not been
established. An earlier bootstrap or sync as root remains a possible
explanation, but it is not a confirmed fact.

## References

- [Portage 3.0.82.2: `make.conf(5)`, FEATURES usersync](https://github.com/gentoo/portage/blob/portage-3.0.82.2/man/make.conf.5) — dropping privileges to the repository owner and requiring matching ownership of subdirectories.
- [Portage 3.0.82.2: quarantine implementation](https://github.com/gentoo/portage/blob/portage-3.0.82.2/lib/portage/repository/storage/hardlink_quarantine.py) — temporary tree preparation, the final `rsync -a --delete`, and cleanup. Preparation can use hardlinks; this is not an independent backup of the working tree.
