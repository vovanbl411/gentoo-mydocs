---
title: Manual Gentoo amd64 installation
kind: guide
scope: general
status: current
last_verified: "2026-10-08"
verified_on: [gentoo-builder-01]
---

## Result and scope

This path takes you from a LiveCD to Gentoo userspace on the target disk:
partitioning, filesystems, a verified stage3, a working chroot, and initial
Portage configuration with a rebuild after changing profiles. **At this point,
the system is not yet ready to boot from disk.** Only the repeated, verified
part of the manual installation is documented here; later stages will be
added after verification.

The guide is for installing Gentoo amd64 from scratch, including on another
laptop. The verified example uses BIOS + GPT, ext4, hardened/systemd, and a
switch to no-multilib. Choose the boot mode, disk, CPU target, and profile for
your own machine. The UEFI branch has not yet been verified here.

Before starting, you need a booted Gentoo LiveCD, working networking and DNS,
correct date/time for HTTPS, enough disk space, and a backup of any data you
need to keep. Run commands **as root** in the LiveCD and, after entering the
chroot in section 6, inside it: `doas` is not installed yet, so commands here do
not use it. If a command fails, stop and investigate before continuing to
the next stage.

Verification dated 2026-10-08 was provided by the owner: this path was
completed twice on `gentoo-builder-01`. This is an example of procedure
verification; [the state of that system](../../systems/gentoo-builder-01/)
is maintained separately. [Base system configuration](../base-system/)
describes later Portage/toolchain policy and is not the configuration for
this bootstrap.

## 1. Live environment: identify the disk and boot mode

First establish where you are working and which disk will hold the installed
system. This prevents partitioning the wrong disk or choosing an unsuitable
boot layout. `lscpu` and `free -h` help assess the CPU and RAM if those
parameters are unknown.

```bash
lscpu
free -h
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINTS,MODEL
findmnt /
if [ -d /sys/firmware/efi ]; then
    echo UEFI
else
    echo BIOS
fi
fdisk -l
```

`findmnt /` shows the **LiveCD** root, not the future Gentoo root. The new
root will appear at `/mnt/gentoo` after mounting. Checking
`/sys/firmware/efi` identifies how the installation medium was booted; it
does not identify every boot mode the machine's firmware supports.

**PASS:** the target disk is unambiguously identified by size, model, and
existing partitions; the boot mode is known; the current `/` is recognized
as the Live environment. The verified example has BIOS, a 100 GiB `/dev/sda`,
and approximately 16 GiB RAM. These values are not installation requirements.

> **Important:** in every example below, `/dev/sda` is the chosen target
> disk. Replace it and the partition paths for your machine; for example,
> partitions on `/dev/nvme0n1` are named `/dev/nvme0n1p1`, not `/dev/nvme0n11`.

## 2. Partitioning: the verified BIOS + GPT layout

The boot mode determines the reserved boot partition. This BIOS + GPT example
reserves a BIOS Boot Partition for a future BIOS bootloader, followed by swap
and root. The bootloader itself is not installed at this stage.

| Example partition | Size | Purpose |
|-------------------|------|---------|
| `/dev/sda1` | 1 MiB | BIOS Boot Partition, no filesystem |
| `/dev/sda2` | 8 GiB | Linux swap |
| `/dev/sda3` | Remaining disk space | Linux filesystem / future root |

8 GiB swap is the example's chosen size, not a universal formula based on RAM.
`fdisk`, `parted`, and GParted are alternative tools: the resulting layout is
what matters. Here, `sfdisk` provides a reproducible CLI example.

> ⚠️ **Important detail:** the next command overwrites the selected disk's
> partition table. Treat its existing contents as destroyed; subsequent
> formatting overwrites partition data. Before running it, check `/dev/sda`
> again and back up required data to another medium. Recovery after
> overwriting and formatting means restoring a backup; there is no automatic
> safe undo. The target disk must not contain mountpoints used by the LiveCD
> or active swap.

This example assumes **512-byte logical sectors**, as shown by
`fdisk -l /dev/sda`. With a different sector size, do not copy these numeric
offsets and sizes: recalculate the layout before writing. `unit: sectors`
sets the unit for `start` and `size`; 2048 such sectors are 1 MiB, and
16777216 are 8 GiB. The final partition uses the remaining available space.

```bash
sfdisk /dev/sda <<'EOF'
label: gpt
unit: sectors

start=2048,     size=2048,     type=21686148-6449-6E6F-744E-656564454649
start=4096,     size=16777216, type=0657FD6D-A4AB-43C4-84E5-0933C84B4F4F
start=16781312,                type=0FC63DAF-8483-4772-8E79-3D69D8477DE4
EOF
```

The GUIDs in `type=` identify **GPT partition types**, not filesystem
identifiers: the first is BIOS Boot, the second is Linux swap, and the third
is Linux filesystem. Do not format or mount the BIOS Boot Partition.

For **UEFI**, an EFI System Partition (ESP) is required instead of a BIOS
Boot Partition, along with the corresponding UEFI bootloader branch. This
BIOS layout cannot be used unchanged for a UEFI installation. ESP size,
formatting, and UEFI bootloader installation will be documented and verified
separately.

Verify after writing:

```bash
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,PARTTYPENAME,PARTTYPE
fdisk -l /dev/sda
```

**PASS:** a GPT table, three partitions in the specified order, sizes and
GUID types matching the chosen layout, and no overlapping partitions.
FSTYPE and LABEL are checked after formatting; a GPT type does not create
a filesystem by itself.

## 3. Filesystem and swap

Create ext4 for the Gentoo root and swap for paging, then attach them to the
LiveCD. `/mnt/gentoo` will be the destination for stage3 extraction.

> **Important:** `mkswap` and `mkfs.ext4` overwrite the contents of their
> respective partitions. Check `/dev/sda2` and `/dev/sda3` against the
> partitioning results before running them. Restoring previous data requires
> a backup.

```bash
mkswap -L gentoo-swap /dev/sda2
mkfs.ext4 -L gentoo-root /dev/sda3

swapon /dev/sda2
mkdir -p /mnt/gentoo
mount /dev/sda3 /mnt/gentoo
```

`-L` sets the **filesystem / swap LABEL**. The GPT partition type specifies
a partition's purpose, while the optional `PARTLABEL` is its name in the GPT
table. These are different fields: an absent PARTLABEL does not prevent
installation.

Verification:

```bash
lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
blkid /dev/sda2 /dev/sda3
swapon --show
findmnt /mnt/gentoo
```

**PASS:** `/dev/sda2` has TYPE `swap`, LABEL `gentoo-swap`, and appears in
`swapon --show`; `/dev/sda3` has TYPE `ext4`, LABEL `gentoo-root`, and is
mounted at `/mnt/gentoo`. The reserved `/dev/sda1` remains without a filesystem.

## 4. Stage3: download and verify the system foundation

Stage3 is minimal Gentoo userspace: programs, libraries, and initial
configuration files that will form the installed system's foundation. The
verified path uses **amd64 / hardened / systemd**. This is a deliberate choice
of init system and profile, not a requirement for every Gentoo installation.

Use the official
[current-stage3-amd64-hardened-systemd directory](https://distfiles.gentoo.org/releases/amd64/autobuilds/current-stage3-amd64-hardened-systemd/).
The tarball name is extracted from `latest-…txt`, so the instructions are not
tied to one build's timestamp. Keep the downloaded files for your own checks.

In the LiveCD, before entering the chroot:

```bash
cd /mnt/gentoo
STAGE_BASE="https://distfiles.gentoo.org/releases/amd64/autobuilds/current-stage3-amd64-hardened-systemd"
wget -O latest-stage3-amd64-hardened-systemd.txt \
  "$STAGE_BASE/latest-stage3-amd64-hardened-systemd.txt"
STAGE_PATH=$(awk '$1 ~ /\.tar\.xz$/ {print $1; exit}' \
  latest-stage3-amd64-hardened-systemd.txt)
STAGE3=${STAGE_PATH##*/}
printf '%s\n' "$STAGE3"
```

`awk` takes the archive path from the line containing `.tar.xz`;
`${STAGE_PATH##*/}` keeps the filename without the date directory. Before
continuing, check that the output is a nonempty filename matching
`stage3-amd64-hardened-systemd-…tar.xz`.

```bash
wget "$STAGE_BASE/$STAGE3"
wget "$STAGE_BASE/$STAGE3.sha256"
wget "$STAGE_BASE/$STAGE3.asc"
gpg --import /usr/share/openpgp-keys/gentoo-release.asc
```

Import the release key from a trusted Gentoo LiveCD; this is a public key,
not a user's private keys. If the LiveCD does not contain this file, stop
and check the key source in the Gentoo Handbook. Do not import an arbitrary
key merely to make a verification error disappear.

The `.sha256` file contains a signed SHA256 checksum. Extract it while
verifying its signature, then compare it with the archive:

```bash
gpg --output "$STAGE3.sha256.verified" \
  --decrypt "$STAGE3.sha256"
sha256sum --check "$STAGE3.sha256.verified"
gpg --verify "$STAGE3.asc" "$STAGE3"
```

Here, `--decrypt` reads clear-signed text and verifies its signature; it is
not decrypting secret data. Use `.verified` only after GPG completes
successfully. The final command separately verifies the tarball's detached
signature. File formats and signature verification are described in
[Gentoo Handbook: Stage](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Stage).

- **SHA256** checks integrity: the archive matches the checksum. A matching
  hash alone does not prove that Gentoo released the file.
- An **OpenPGP signature** checks authenticity against the Gentoo release
  key. The main cryptographic check result is `Good signature` from the
  expected release key and a successful GPG exit status.
- A local GPG trust warning that the key is not certified with a trusted
  signature concerns the local trust database. It does not mean an invalid
  signature and is not equivalent to `BAD signature`.

**PASS:** all downloads completed successfully; GPG confirmed the checksum
and archive signatures with the expected release key; `sha256sum` printed
`OK` for `$STAGE3`. With a checksum mismatch, `BAD signature`, or an unknown
or unexpected key, do not extract the archive: check the source and repeat
the download/verification.

## 5. Extract stage3

Extract the verified archive into the mounted root. The `STAGE3` variable
from the previous stage remains available in the same LiveCD shell.

```bash
tar xpvf "$STAGE3" \
  --xattrs-include='*.*' \
  --numeric-owner \
  -C /mnt/gentoo
```

`x` extracts files, `p` preserves permissions, `v` displays extraction
progress, and `f` specifies the archive. `--xattrs-include='*.*'` selects
extended attributes for restoration; `--numeric-owner` preserves numeric
UIDs/GIDs from the archive without mapping them to LiveCD user names. `-C`
sets the destination directory. Extracting as root is necessary to preserve
system file ownership and permissions.

Verification:

```bash
ls -ld \
  /mnt/gentoo/etc \
  /mnt/gentoo/usr \
  /mnt/gentoo/var \
  /mnt/gentoo/bin

cat /mnt/gentoo/etc/gentoo-release
ls -l /mnt/gentoo/etc/portage/make.conf
```

**PASS:** extraction completed without errors; the listed paths exist;
`gentoo-release` identifies Gentoo, and the stage3 `make.conf` is available.
This checks the userspace structure; it does not confirm an installed kernel.

## 6. Prepare the chroot and enter the new system

Chroot changes a process's userspace root. It is **not a VM**: processes use
the same LiveCD kernel. Mount `/proc`, `/sys`, `/dev`, and `/run` so tools
in the new system can access processes, devices, and runtime data.

In the LiveCD:

```bash
mount --types proc /proc /mnt/gentoo/proc

mount --rbind /sys /mnt/gentoo/sys
mount --make-rslave /mnt/gentoo/sys

mount --rbind /dev /mnt/gentoo/dev
mount --make-rslave /mnt/gentoo/dev

mount --bind /run /mnt/gentoo/run
mount --make-slave /mnt/gentoo/run

cp --dereference /etc/resolv.conf /mnt/gentoo/etc/resolv.conf
```

`proc` is mounted as a separate virtual filesystem. `--rbind` also includes
nested mountpoints, while `--bind` binds the mount itself. Slave propagation
allows mount events to arrive from the source side but prevents changes
inside the chroot from propagating back to the LiveCD. `--make-rslave`
applies this recursively to nested mounts. This matters particularly when
unmounting later.

Copying `resolv.conf` supplies the LiveCD's working resolver configuration.
`--dereference` copies the file contents through a symlink, avoiding a link
to an unavailable path in the new system. This is initial DNS configuration
for bootstrap, not completed networking configuration for the installed system.

Enter the chroot:

```bash
chroot /mnt/gentoo /bin/bash
source /etc/profile
export PS1="(chroot) ${PS1}"
```

`source /etc/profile` loads the Gentoo environment, and PS1 adds a visible
context marker. Run all subsequent commands inside the chroot.

```bash
cat /etc/gentoo-release
mountpoint /proc
mountpoint /sys
mountpoint /dev
mountpoint /run
getent hosts distfiles.gentoo.org
uname -r
```

**PASS:** the release output identifies Gentoo; all four `mountpoint` checks pass;
`getent` returns addresses. `uname -r` still shows the LiveCD kernel:
chroot has not booted the new system's kernel or started its systemd as PID 1.

## 7. Initial Portage bootstrap

First preserve the original stage3 configuration for comparison and to
allow restoring the settings before rebuilding:

```bash
cp -a /etc/portage/make.conf /etc/portage/make.conf.stage3
emerge --sync
eselect news list
```

`cp -a` preserves file attributes. `emerge --sync` obtains the current Gentoo
repository, and `eselect news list` shows notices about important changes.
Read applicable unread notices and follow their requirements before
changing profiles or building.

Now choose a CPU policy. The verified example had an already confirmed
common ISA contract of **x86-64-v3**, so it used the following minimal
configuration. On another machine, choose the CPU target deliberately:
the CPU must support the chosen instructions, or compiled programs may not
run. Until making that choice, you can retain the stage3's original `-O2 -pipe`.

File inside the chroot: `/etc/portage/make.conf`.
**Example for a confirmed x86-64-v3 target:**

```makefile
COMMON_FLAGS="-march=x86-64-v3 -O2 -pipe"

CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"
FCFLAGS="${COMMON_FLAGS}"
FFLAGS="${COMMON_FLAGS}"

LC_MESSAGES=C.UTF-8
```

`-march` sets the allowed ISA target, `-O2` sets the optimization level,
and `-pipe` passes intermediate compilation data through pipes. The four
variables supply the common flags to C, C++, and Fortran; `LC_MESSAGES`
sets the language of messages.

LLVM/Clang, ThinLTO, LLD, Rust flags, Go flags, `CPU_FLAGS_X86`, global USE
policy, compiler caches, and binpkg configuration were not added at this
stage. They require separate decisions and verification after bootstrap.

Verification:

```bash
portageq envvar COMMON_FLAGS CFLAGS CXXFLAGS FCFLAGS FFLAGS
```

**PASS:** sync completed without errors, news was reviewed, the backup exists,
and Portage shows the chosen flags on all five lines. In the verified
example, each line is `-march=x86-64-v3 -O2 -pipe`. This checks configuration,
not whether the userspace has already been rebuilt.

## 8. Choose a profile

A profile defines base Portage settings, including ABI and USE defaults.
The verified stage3 started with:

```text
default/linux/amd64/23.0/hardened/systemd
```

The example's target profile is a pure 64-bit system without multilib:

```text
default/linux/amd64/23.0/no-multilib/hardened/systemd
```

Choose no-multilib only if you do not need 32-bit libraries and applications.
Switching back after rebuilding is not just a matter of restoring the profile
symlink; it is a separate, complex migration. If you need multilib, keep an
appropriate profile — no-multilib is not a general requirement of this guide.

Find the target path in the current list:

```bash
eselect profile list
```

Record the previous path/number for restoring it **before rebuilding**, then
replace `<number>` with the chosen profile's number from this list:

```bash
eselect profile set <number>
```

The number is not fixed: even if one installation showed `12`, on another
you must check the path rather than copy the index. Verify the result:

```bash
eselect profile show
readlink -f /etc/portage/make.profile
portageq envvar ABI_X86
```

**PASS for the no-multilib example:** the exact target path is selected,
the symlink points to its directory in the Gentoo repository, and `ABI_X86`
is `64`. Changing profiles changes policy but does not yet rebuild packages.

## 9. Rebuild the system after changing profiles

Portage needs to bring installed packages into line with the new profile.
First inspect the resolver preview to identify conflicts before modifying
the system:

```bash
emerge \
  --pretend \
  --verbose \
  --update \
  --deep \
  --newuse \
  --complete-graph \
  @world
```

`--pretend` only displays the plan; `--verbose` shows details.
`--update --deep` consider updates and dependencies, `--newuse` accounts for
changed USE policy, and `--complete-graph` checks the full dependency graph.
`@world` includes selected packages and the system set.

**PASS for the preview:** the resolver completed successfully, with no
unresolved blockers or conflicts, and the plan matches the chosen profile.
Only then start the real build and confirm the proposed plan:

```bash
emerge \
  --ask \
  --verbose \
  --update \
  --deep \
  --newuse \
  --complete-graph \
  @world
```

`--ask` requires confirmation before applying changes. This may be a long
toolchain and library rebuild; a successful preview does not guarantee
successful compilation. On failure, keep the error output and fix the cause
before continuing.

After a successful build:

```bash
eselect profile show
portageq envvar ABI_X86
gcc -print-multi-lib
emerge --info | head -n 15

emerge \
  --pretend \
  --verbose \
  --update \
  --deep \
  --newuse \
  --complete-graph \
  @world
```

**PASS for the verified no-multilib example:**

- the build completed without errors;
- the profile remains `default/linux/amd64/23.0/no-multilib/hardened/systemd`;
- `ABI_X86=64`;
- `gcc -print-multi-lib` prints only `.;`;
- `emerge --info` matches the chosen environment;
- the final resolver shows `Total: 0 packages`.

An empty plan confirms completion of updates under the current policy and
repository state. It does not mean future syncs will require no updates.

## Stopping and recovery

If the preview fails, do not start the build. Before rebuilding, you can
restore the previous profile through `eselect profile` and the original
`make.conf` from `/etc/portage/make.conf.stage3`, then repeat the preview.
After a partial rebuild, restoring a configuration file does not restore
old packages; investigate the error first and, if necessary, restore the
root from a copy made beforehand or restart installation from a verified stage3.

On a partitioning/formatting mistake, stop writing to the disk. Data recovery
requires a backup; repeating commands is not a rollback. If the chroot lacks
mounts or DNS, return to the LiveCD shell and check the preparation in
section 6. Do not reboot from the target disk at this point: installation
is not yet complete.

## Next steps

Post-bootstrap toolchain configuration has been verified separately on the
example system. See [base system configuration](../base-system/) for the
general Portage/toolchain example; adapt it to your hardware and purpose.
This guide still ends at prepared Gentoo userspace in a chroot.

Kernel installation, `/etc/fstab`, hostname/networking, users, SSH,
GRUB/UEFI bootloader and first boot have not yet been completed in the rebuilt
VM. Their commands will be added only after those stages have been completed
and verified.

## References

- [Gentoo AMD64 Handbook](https://wiki.gentoo.org/wiki/Handbook:AMD64).
- [Preparing disks](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Disks).
- [Stage3 and download verification](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Stage).
- [Chroot and profile selection](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Base).
- [sfdisk: script format and GPT types](https://man7.org/linux/man-pages/man8/sfdisk.8.html).
