---
title: "Portage: Gentoo package management"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

How to install packages, update the system, and keep it in good shape with
Portage (`emerge`). Toolchain configuration and `make.conf` are covered in
[the base system guide](../../installation/base-system/); the recorded package
policy for the reference machine is in
[its system section](../../systems/asus-b5402/system/boot-and-portage/).

## Quick workflow

The regular maintenance cycle:

```text
Sync repositories
→ read Gentoo news
→ preview/update @world
→ merge config updates
→ preview depclean
→ depclean if expected
→ preserved rebuild if Portage requires it
```

```bash
doas emerge --sync                  # synchronize repositories
eselect news list                   # list Gentoo news
eselect news read                   # read new items

doas emerge --ask --verbose --update --deep --changed-use @world

doas dispatch-conf                  # merge configuration updates

doas emerge --pretend --depclean    # review removal candidates
doas emerge --ask --depclean        # remove them if the list is expected
```

If Portage reports `@preserved-rebuild` after an update:

```bash
doas emerge --ask @preserved-rebuild
```

Read news regularly, and always do so before major profile or toolchain
migrations: it contains planned changes and required actions.

## Installing and searching packages

The main installation command is:

```bash
doas emerge --ask --verbose category/package
```

- `--ask` — show the plan and ask for confirmation before taking action;
- `--verbose` — show a detailed plan, including USE flags, repository, and sizes;
- `--pretend` — show the plan only; do not perform any actions.

Use `--oneshot` (`-1`) to build a package once without adding it to `@world`.

Portage includes package search commands:

```bash
emerge --search keyword     # search by package name (supports regex via %)
emerge --searchdesc keyword # also search descriptions
```

`eix` (`app-portage/eix`) is an optional, fast indexed search of the tree. It
is useful when searching frequently:

```bash
eix keyword                 # fast search by name
eix -S keyword              # search descriptions
eix -I                      # installed packages only
doas eix-update             # rebuild the index after sync
```

`eix-test-obsolete` can also find packages that are no longer in the tree.

## Updating the system

### What is `@world`?

- `@selected` — explicitly selected packages and sets (`selected-packages` +
  `selected-sets`); it includes everything installed without `--oneshot`;
- `@system` and `@profile` — sets defined by the profile;
- `@world` — includes `@selected`, `@system`, and `@profile`.

Sets do not, by themselves, "include all dependencies": the resolver builds
the full dependency graph for an operation, including packages needed by its
targets.

### Update command

```bash
doas emerge --ask --verbose --update --deep --changed-use @world
```

- `--update` — update installed packages to available versions;
- `--deep` — have the resolver consider dependencies throughout the chain,
  rather than only the first level below the target packages;
- `@world` — the update target.

Useful additions: `--keep-going` continues after an individual package fails;
`--jobs N` / `--load-average` build multiple packages in parallel (see also
[out-of-memory errors during builds](#oom-during-a-build)).

Portage itself is updated as a regular package (`sys-apps/portage`); during
major updates the resolver may propose building it first.

### `--changed-use` vs `--newuse`

- `--changed-use` (`-U`) rebuilds packages when the effective value of a USE
  flag they use has changed;
- `--newuse` (`-N`) is broader: it also reacts to changes in IUSE, including
  flags being added or removed even when disabled, including changes from the
  profile.

For regular updates, `--changed-use` is usually less noisy because it causes
fewer rebuilds for flags that remain disabled. It is not the only valid choice:
use `--newuse` when changes to the flag set itself matter.

### Configuration file updates

Updates do not overwrite protected configuration files; they place `._cfg0000_*`
files alongside them. Merging those changes is a separate step after updating
packages:

```bash
doas dispatch-conf
```

- `dispatch-conf` — interactive merge;
- `etc-update` — a simpler interface;
- `conf-update` (`app-portage/conf-update`) — an alternative, if available.

Choose whichever tool you prefer; the important thing is to review `._cfg` files
after major updates instead of leaving them unattended.

### Preserved rebuild

Portage preserves old library versions (`preserve-libs`) until packages that
depend on them have been rebuilt. This prevents a library update from
immediately breaking its ELF consumers. If Portage reports that
`@preserved-rebuild` is needed:

```bash
doas emerge --ask @preserved-rebuild
```

`revdep-rebuild` (`app-portage/gentoolkit`) is an additional diagnostic for
broken ELF/shared-library dependencies, not a required step after every update.

## USE policy

USE flags determine which features are built into a package.

A small global policy belongs in `/etc/portage/make.conf`:

```bash
USE="ssl -telemetry"
```

Package-specific settings belong in `/etc/portage/package.use/`:

```text
# /etc/portage/package.use/10-desktop
category/package flag -otherflag
```

Package-specific entries override global `USE`: specific policy takes
precedence over general policy.

Inspect a package's effective flags and the current global set with:

```bash
emerge --pretend --verbose category/package
equery uses category/package
portageq envvar USE
```

Accept a testing version of one package with `package.accept_keywords`, rather
than setting global `ACCEPT_KEYWORDS="~amd64"` in `make.conf`:

```text
# /etc/portage/package.accept_keywords/testing
category/package ~amd64
```

## USE changes and resolver messages

These are two different situations.

### USE has already changed in the configuration

`--changed-use` / `--newuse` ask the resolver to recalculate the graph and
rebuild packages whose effective flags have changed:

```bash
doas emerge --ask --verbose --changed-use @world
```

### The resolver reports required USE changes

“The following USE changes are necessary” is not a request to “rerun with
`-N`”: the resolver lists specific changes required for the dependency graph
to resolve. To proceed:

1. Read which flags are proposed for which packages.
2. Understand the reason: a new version, changed dependencies, or the profile.
3. Deliberately update `package.use` or the related policy.

Autounmask is a separate mechanism: Portage proposes changes and, after
confirmation, writes them to policy files. Review proposals before accepting
them; they become part of your configuration.

## Removing packages and depclean

```bash
doas emerge --deselect category/package   # remove the explicit selection
doas emerge --pretend --depclean          # review what will be removed
doas emerge --ask --depclean              # perform the cleanup
```

- `--deselect` removes a package from `@selected`; the package and its
  dependencies become candidates for cleanup;
- `--depclean` performs dependency-aware cleanup: it removes only packages no
  longer reachable from `@world`;
- `emerge --depclean category/package` (`-c`) removes a specific package with
  dependency awareness: this is not “absolutely safe”, but Portage will not
  remove a package that others depend on;
- `--unmerge` (`-C`) forcibly removes packages without dependency checks. It is
  an emergency option and can leave the system unusable.

Before depclean, bring `@world` into a consistent state (without accidental
packages in `@selected`) and review the entire removal list.

## Dependency problems

A quick reference to ebuild dependency variables:

- `BDEPEND` — build dependencies on the host;
- `DEPEND` — build dependencies of the target;
- `RDEPEND` — runtime dependencies;
- `PDEPEND` — installed after the main package;
- `IDEPEND` — installed while the package is being installed.

The resolver handles these automatically; users mainly need them when
investigating conflicts.

### Blockers

A blocker means two packages cannot coexist. Before taking action, understand
the conflict:

- which pair conflicts: SLOT/version, files, or a USE/dependency requirement;
- whether it is a package move/replacement — the package was renamed or
  replaced, and the update should switch to its replacement;
- whether the repository and profile are current (`emerge --sync`, news).

Often, updating both sides of the conflict or switching to a replacement
resolves the blocker. `package.mask` is a deliberate policy choice, not a
general-purpose way to clear a blocker. If the resolver gives up searching, a
deeper `--backtrack=N` may help (the default is 20).

### Circular dependencies

A circular dependency means the resolver cannot determine a build order.

1. Read the circular dependency report to see which packages form the cycle.
2. Review the Portage USE changes it proposes; a flag often breaks the cycle.
3. Check `package.use`: local constraints often create the cycle themselves.
4. Increase `--backtrack` for a deeper search.
5. Change USE temporarily only when you understand which dependency edge it
   breaks, then revert the change afterward.

> ⚠️ `--nodeps` is not a way to resolve a cycle: it skips the dependency graph,
> the build may fail, and the system may be left inconsistent. It is an
> emergency option for exceptional cases, not part of the regular workflow.

## Repositories / overlays

Overlays are additional ebuild repositories. Manage entries in
`/etc/portage/repos.conf` with `eselect repository`
(`app-eselect/eselect-repository`; `layman` is the historical tool):

```bash
eselect repository list              # list available overlays
doas eselect repository enable guru  # enable one
doas emerge --sync guru              # sync a specific repository
doas emerge --sync                   # or sync all repositories
```

Add your own Git repository with:

```bash
doas eselect repository add <name> git <url>
```

After syncing, overlay packages are available like any others.

## Inspecting packages

```bash
emerge --pretend --verbose category/package   # installation plan + USE
portageq envvar USE                            # global USE
```

`equery` (`app-portage/gentoolkit`) provides a concise set of useful commands:

| Command | What it does |
|---------|--------------|
| `equery list <pkg>` | Installed package versions |
| `equery files <pkg>` | Files installed by a package |
| `equery belongs <file>` | Which package owns a file |
| `equery depends <pkg>` | Packages that depend on this one |
| `equery depgraph <pkg>` | Dependency graph |
| `equery uses <pkg>` | USE flags and their state |
| `equery check <pkg>` | Check installation integrity |

`eix` is a fast indexed search tool (see Installing and searching packages).

## Cleaning caches

Downloaded sources are stored in `/var/cache/distfiles` (`/usr/portage/distfiles`
is the historical path); local binary packages are in `/var/cache/binpkgs`
(`PKGDIR`).

Clean outdated files with `app-portage/gentoolkit`, previewing first:

```bash
eclean --pretend distfiles    # show what will be removed
eclean distfiles              # remove outdated source archives
eclean --pretend packages
eclean packages               # remove outdated binary packages
```

Do not clear the package cache blindly: older binpkgs may be needed for rollback.

## Security: GLSA

Gentoo publishes security advisories (GLSA). Check them with `glsa-check`
(`app-portage/gentoolkit`):

```bash
glsa-check --test all          # which GLSAs affect the system
glsa-check --list affected     # list the affected advisories
glsa-check --pretend affected  # steps required for remediation
```

Applying changes is a separate operation (`--fix`, an experimental option):
only do it after reviewing `--pretend`. Check the current flags with
`glsa-check --help` and its man page.

## Advanced features

### binpkgs / binhost

Portage can build and reuse binary packages with `FEATURES="buildpkg"`,
`--usepkg`, and a binhost configured through `PORTAGE_BINHOST`. See the
[Gentoo Wiki: Binary package guide](https://wiki.gentoo.org/wiki/Binary_package_guide).

### ccache

ccache speeds up repeated builds by caching compilation results. Enable it
with `FEATURES="ccache"` in `make.conf`; detailed setup is covered in
[the base system guide](../../installation/base-system/).

### distcc

Distributed builds use `sys-devel/distcc`, `FEATURES="distcc"`, and `MAKEOPTS`
set for the combined number of workers. Configure `distccd` on helper machines;
see [Gentoo Wiki: Distcc](https://wiki.gentoo.org/wiki/Distcc).

### Build-time dependencies: `--with-bdeps`

Portage handles build-time dependencies automatically: for ordinary installs,
`--with-bdeps` is enabled by default, and `--depclean` does not remove build
dependencies by default. Binary package workflows (`--usepkg`) have separate
details and can behave differently; see `emerge(1)`. There is no need to pass
`--with-bdeps=y` manually on every installation.

## Kernel packages

In Gentoo, the kernel is managed as a regular Portage package:

- `sys-kernel/gentoo-kernel` — a dist-kernel built by its ebuild; its
  configuration can be customized, including with `savedconfig`;
- `sys-kernel/gentoo-sources` — source code only; build and install it manually.

USE flags and kernel package configuration use standard Portage mechanisms
(`package.use`, `savedconfig`). Image, initramfs, and bootloader installation
are handled by `sys-kernel/installkernel` + Dracut: the UKI layout, signing,
and systemd-boot are covered in
[systemd-uki-setup](../../installation/systemd-uki-setup/). Kernel build
instructions are not repeated here.

With systemd, load kernel modules from `/etc/modules-load.d/*.conf`. OpenRC
uses its own mechanism (`/etc/conf.d/modules`), which does not apply to systemd.

## Troubleshooting

### “blocked packages”

See [Blockers](#blockers): first identify the package pair and the cause, then
update packages or change the policy. A deeper `--backtrack` search can help if
the resolver gives up.

### OOM during a build

There are separate levels of parallelism:

- emerge `--jobs N` — how many packages are built concurrently;
- `MAKEOPTS="-jN"` — build-system parallelism within one package.

If memory runs out while one large package is building, reduce its `MAKEOPTS`
through `package.env` / an env file (an example policy is in
[the reference machine's system section](../../systems/asus-b5402/system/boot-and-portage/)).
If several packages are building in parallel, also reduce Portage `--jobs`.

### The system broke after an update

Boot from live media, mount the partitions, and enter the chroot. What to do
next depends on the failure: resume an unfinished merge list with
`emerge --resume`, reinstall the affected package separately, or recalculate
a regular `@world` update. There is no single repair command; first determine
what actually broke.

## Related docs

- [Base system configuration: make.conf, USE, ccache](../../installation/base-system/)
- [Kernel and boot: UKI with Dracut](../../installation/systemd-uki-setup/)
- [Reference ASUS B5402 package policy](../../systems/asus-b5402/system/boot-and-portage/)
- [Gentoo Wiki: Portage](https://wiki.gentoo.org/wiki/Portage)
- [`emerge(1)`](https://dev.gentoo.org/~zmedico/portage/doc/man/emerge.1.html)
