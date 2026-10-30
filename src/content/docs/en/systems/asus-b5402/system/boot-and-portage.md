---
title: Boot and Portage on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current configuration

- Gentoo uses `default/linux/amd64/23.0/no-multilib/hardened/systemd`.
- Userspace is built with Clang/LLD from LLVM slot 22. The base C/C++ flags are `-march=alderlake -O2 -flto=thin`; the GNU runtime ABI remains primary.
- `sys-kernel/gentoo-kernel` is built on `gentoo-builder-01` as a GPKG with a version-specific `savedconfig` and two local patches. The laptop installs this package only from the binhost; `installkernel` and Dracut then create a UKI for systemd-boot.
- `/etc/portage/make.conf` enables automatic retrieval of suitable GPKGs (`FEATURES=getbinpkg`). If no suitable package is available, ordinary `emerge` builds the ebuild locally. The kernel has a separate procedure that requires a binpkg and fails if one is unavailable.
- Swap uses zram sized to half of RAM; zswap is disabled in the kernel config. C/C++ uses ccache, and Rust uses sccache.

## Toolchain

`make.conf` sets the default toolchain for userspace. Kernel parameters are overridden by a separate package environment and described in the kernel update section.

File: `/etc/portage/make.conf`.

```makefile
LLVM_SLOT="22"
CC="clang"
CXX="clang++"
AR="llvm-ar"
NM="llvm-nm"
RANLIB="llvm-ranlib"

COMMON_FLAGS="-march=alderlake -O2 -flto=thin -pipe -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk"
FORTRAN_FLAGS="-march=alderlake -O2 -pipe -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk"
CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"
FCFLAGS="${FORTRAN_FLAGS}"
FFLAGS="${FORTRAN_FLAGS}"
LDFLAGS="-Wl,-O1 -Wl,--as-needed -fuse-ld=lld"
RUSTFLAGS="-C target-cpu=alderlake"
GOAMD64="v3"
MAKEOPTS="-j14 -l10"
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"
VIDEO_CARDS="intel zink"
```

- `-march=alderlake` sets the userspace CPU target; this explicit target does not depend on which host runs the compiler.
- `-O2` is the selected optimization level. `-flto=thin` enables ThinLTO where the ebuild does not filter it. Fortran has separate flags without LTO because the GNU Fortran compiler in use does not support Clang ThinLTO.
- `-fuse-ld=lld` selects the LLVM linker. `--as-needed` avoids retaining links to unused shared libraries.
- `-mno-kl`, `-mno-pconfig`, `-mno-sgx`, and `-mno-widekl` disable instruction sets not present on the target Alder Lake CPU; `-mshstk` enables Shadow Stack code generation support.
- `RUSTFLAGS` sets the Rust CPU target. `GOAMD64="v3"` sets the minimum Go ISA level for portable builder packages. These are separate settings; `GOAMD64` does not change the C/C++ target.
- `MAKEOPTS` limits parallelism for ordinary laptop builds. Package-specific `p-cores` and `ssd` environments override job count and temporary directory for heavier packages.

Check effective values rather than only the source lines: Portage can add or override parameters through `package.env`.

```bash
portageq envvar CC CXX CFLAGS CXXFLAGS FCFLAGS FFLAGS LDFLAGS RUSTFLAGS GOAMD64 MAKEOPTS
eselect llvm show
```

Ordinary packages should report `clang`, `-march=alderlake -O2 -flto=thin`, `-fuse-ld=lld`, `-C target-cpu=alderlake`, `v3`, `-j14 -l10`, and `llvm-22`. If a specific package differs, check its entry in `/etc/portage/package.env/` and the assigned file in `/etc/portage/env/`; do not change global flags to fix a package-specific override.

`sys-devel/binutils` and `x11-libs/pango` are the two remaining GCC fallbacks. For them, `package.env/30-gcc-fallback` selects GCC and BFD. Binutils uses GCC because of Clang/PGO problems; Pango remains a separate GCC/BFD exception for Clang compatibility. GCC uses `-flto=auto`, so BFD is selected for this environment instead of global LLD. Do not restore removed GCC/no-LTO exceptions without a reproducible failure.

## Gentoo binary build host — production

The laptop gets binary packages only from the private builder binrepo. Builder userspace uses `-march=x86-64-v3`; the laptop retains `-march=alderlake`. These targets are not interchangeable: a binpkg contains already-built files and build environment metadata, but does not change the laptop's `CFLAGS`. The laptop's `CPU_FLAGS_X86` includes `avx_vnni`, `sha`, and `vpclmulqdq`; the builder page describes its common subset without these three flags. If package USE settings differ because of this, Portage skips the GPKG and builds the ebuild locally. Do not disable USE matching to increase the number of binary packages.

### Private binrepo on the workstation

File: `/etc/portage/make.conf` on the laptop.

```makefile
FEATURES="${FEATURES} getbinpkg"
EMERGE_DEFAULT_OPTS="${EMERGE_DEFAULT_OPTS} --usepkg-exclude 'app-admin/keepassxc sys-auth/fprintd sys-auth/libfprint app-crypt/sbctl app-crypt/sbsigntools sys-boot/efibootmgr sys-kernel/installkernel sys-kernel/dracut sys-kernel/gentoo-kernel dev-util/perf sys-firmware/intel-microcode sys-kernel/linux-firmware sys-firmware/sof-firmware'"
```

File: `/etc/portage/binrepos.conf/gentoo-builder.conf`. This is the only active remote binrepo:

```ini
[gentoo-builder]
priority = 9999
sync-uri = https://binhost.apps.home.9fans.uk
location = /var/cache/binhost/gentoo-builder
verify-signature = false
```

The official Gentoo binary repository is not enabled in the active `binrepos.conf`. The Gentoo ebuild repository remains available for source ebuilds and distfiles. The private binrepo is currently unsigned; `verify-signature = false` concerns binpkg signature verification and does not disable Secure Boot or UKI signing.

For ordinary `emerge`, Portage requests the builder index and uses a package if its version, ABI, USE flags, and other resolver conditions match. If a GPKG is missing, incompatible with the current package policy, or the binhost is unavailable, Portage leaves the ebuild in the plan and builds it from source. This source fallback keeps the laptop maintainable without the builder, but can take much longer.

Check the selection without installing:

```bash
doas emerge --pretend --verbose app-arch/zstd
```

In the plan, `[binary ...]` means a GPKG and `[ebuild ...]` means a source build. If an expected package appears as an ebuild, first check that `getbinpkg` appears in `portageq envvar FEATURES`, the binhost is available, and USE/ABI settings match. Do not disable `--binpkg-respect-use`: an incompatible GPKG may install the wrong feature set.

On the laptop, `--usepkg-exclude` specifies which GPKGs cannot be installed automatically. The builder uses a different setting, `--buildpkg-exclude`, to exclude packages from automatic GPKG creation during ordinary merges. The lists currently mirror each other.

The builder stores binary packages in GPKG format under `/var/cache/binpkgs`. `pkgdir-index-trusted` trusts the local `Packages` index to be current, while `compress-index` also writes a compressed copy for the binhost to serve.

File: `/etc/portage/make.conf` on the builder.

```makefile
FEATURES="${FEATURES} buildpkg binpkg-logs compress-index pkgdir-index-trusted"
BINPKG_FORMAT="gpkg"
PKGDIR="/var/cache/binpkgs"
EMERGE_DEFAULT_OPTS="${EMERGE_DEFAULT_OPTS} --buildpkg-exclude 'app-admin/keepassxc sys-auth/fprintd sys-auth/libfprint app-crypt/sbctl app-crypt/sbsigntools sys-boot/efibootmgr sys-kernel/installkernel sys-kernel/dracut sys-kernel/gentoo-kernel dev-util/perf sys-firmware/intel-microcode sys-kernel/linux-firmware sys-firmware/sof-firmware'"
```

Check the effective values after changing Portage configuration:

```bash
portageq envvar FEATURES BINPKG_FORMAT PKGDIR
```

Expect `buildpkg`, `gpkg`, and `/var/cache/binpkgs` among the reported values. If any differ, check `/etc/portage/make.conf` and overriding Portage settings before updating the builder.

An ordinary builder update does not create GPKGs for excluded packages; an ordinary laptop update does not install them from the binrepo. These are separate controls on the two systems, not binpkg compatibility settings. The kernel is a special case: the helper passes `--ignore-default-opts --buildpkgonly` when building and `--ignore-default-opts --usepkgonly` when installing. This keeps the exclusion in effect for routine operations while allowing the separate controlled kernel build.

The packages are grouped by role:

| Packages | Why they stay outside the ordinary binpkg flow |
|----------|-------------------------------------------------|
| `app-admin/keepassxc` | A local Portage patch is used for the installed version; a normal source merge ensures the patch is applied. |
| `sys-auth/fprintd`, `sys-auth/libfprint` | `libfprint` uses a local patch set for the laptop's ELAN fingerprint reader; `fprintd` remains in the same hardware-specific stack. |
| `app-crypt/sbctl`, `app-crypt/sbsigntools`, `sys-boot/efibootmgr` | These tools manage Secure Boot and UEFI on the laptop; the builder uses a different boot path (SeaBIOS/GRUB). Configuration and UEFI state stay on the laptop. |
| `sys-kernel/installkernel`, `sys-kernel/dracut` | On the laptop, they are built for the `systemd-boot` and Dracut UKI path. The builder uses GRUB and does not generate the workstation UKI. Their package USE policy differs. |
| `sys-kernel/gentoo-kernel` | A separate version-specific workflow uses `savedconfig` and local patches. It is built manually on the builder, bypassing the normal buildpkg exclusion. |
| `dev-util/perf` | Its update is tied to the target system's kernel headers and configuration, so it is outside the portable userspace binpkg set. |
| `sys-firmware/intel-microcode`, `sys-kernel/linux-firmware`, `sys-firmware/sof-firmware` | This is the laptop's firmware stack. Intel microcode also has `hostonly` enabled, which selects microcode for the processor available during the build. |

An exclusion does not mean the binary format itself is incompatible; the local build follows the accepted package, patch, and boot policy. If an exclusion is no longer needed, change both `--buildpkg-exclude` and `--usepkg-exclude` after a separate compatibility check.

## Ordinary Portage update

The routine workflow updates the builder first and the laptop second. The builder creates GPKGs during package merges through `FEATURES=buildpkg`; its userspace target and package policy are intended for compatible binaries. Do not proceed with the ordinary laptop update if the builder update failed.

1. On `gentoo-builder-01`, sync repositories/overlays, check the resolver, and update `@world` with `--newuse`:

   ```bash
   doas emaint sync -a
   doas emerge --pretend --verbose --update --deep --newuse --complete-graph @world
   doas emerge --ask --verbose --update --deep --newuse --complete-graph @world
   ```

   Pretend should finish without resolver conflicts. After the confirmed update, the builder creates GPKGs for updated packages except those in `--buildpkg-exclude`; the `Packages` index must reflect the packages available through the binhost. If sync or merge fails, fix the builder issue first; do not start the laptop update.
2. On the laptop, sync repositories/overlays and check the resolver:

   ```bash
   doas emaint sync -a
   doas emerge --pretend --verbose --update --deep --newuse --complete-graph @world
   ```

   The expected result is a complete update plan without dependency conflicts. If sync ends with rsync status `23` or `RepoStorageException`, first check Gentoo repository ownership using the [usersync instructions](../../../troubleshooting/portage-usersync-repository-ownership/).

3. Review the package list, USE changes, and planned source builds. If the plan is acceptable, run the update:

   ```bash
   doas emerge --ask --verbose --update --deep --newuse --complete-graph @world
   ```

   Suitable GPKGs are selected automatically; the rest are built from source. Confirm at the Portage prompt only after reviewing the list. If the private binhost is unavailable and the plan switches to expensive local builds, defer the update and restore builder access; an urgent source fallback is possible when intentional and there is enough disk space and capacity.

Builder and laptop syncs are not pinned to the same Gentoo repository snapshot. Builder-first reduces the risk of incompatible GPKGs, but does not replace checking the resolver on the laptop.

## Kernel update: build a GPKG on the builder

Prepare these on the builder for the new version:

- version-specific `/etc/portage/savedconfig/sys-kernel/gentoo-kernel-<version>`;
- both patches in `/etc/portage/patches/sys-kernel/gentoo-kernel-<version>/`: `10-asus-wmi-user-status-led.patch` and `20-asus-b5402-headset-mic.patch`;
- the same ebuild version that the laptop will install.

The laptop also stores the corresponding version-specific `savedconfig` and both patches. Keep the working UKI before installing a new version. Current local patches are under `/etc/portage/patches/sys-kernel/`; patch directories are tied to the ebuild version and must be copied to the new version directory after checking that they still apply.

Run two buildpkg-only steps on the builder. The first builds the kernel with the prepared config and patches without installing it into the builder runtime. The second creates the `virtual/dist-kernel` binpkg so the dependency closure is available to the laptop:

```bash
version=7.2.13

doas env ACCEPT_KEYWORDS="amd64 ~amd64" \
    emerge --ignore-default-opts \
    --ask --verbose --oneshot --buildpkgonly --usepkg=n \
    "=sys-kernel/gentoo-kernel-${version}"

doas env ACCEPT_KEYWORDS="amd64 ~amd64" \
    emerge --ignore-default-opts \
    --ask --verbose --oneshot --buildpkgonly --usepkg=n --nodeps \
    "=virtual/dist-kernel-${version}"
```

`--ignore-default-opts` removes workstation-style binpkg exclusions from the ordinary options; `--usepkg=n` prevents the builder from accidentally reusing an older binary package instead of rebuilding. The second step uses `--nodeps` to create only the virtual binpkg without installing its runtime kernel dependency on the builder. The expected result is that both emerge operations finish successfully and the kernel and virtual GPKGs are available in the binrepo. If patch application fails, check the patch directory version and whether the patch matches the source; if `savedconfig` is missing, check that the version-specific file exists.

On the laptop, install only the built version from the binrepo:

```bash
version=7.2.13

doas emerge --ignore-default-opts --getbinpkg --usepkgonly \
    --ask --verbose --oneshot "=sys-kernel/gentoo-kernel-${version}"
```

`--usepkgonly` forbids a source fallback. If the kernel GPKG or `virtual/dist-kernel` is missing, installation stops before the merge: return to the builder, check both buildpkg-only steps and publication of the `Packages` index. Do not remove `--usepkgonly` to bypass the error; that could build the kernel locally outside the prepared kernel flow.

The local patches add User-status LED support and the headset microphone quirk. Before moving to a new kernel version, check whether these changes have reached upstream and whether the patches still apply to the new sources; then build the GPKG. Their purpose is described in [User-status indicator](../../hardware/user-status-indicator/) and [Headset microphone](../../hardware/headset-microphone/).

## From kernel package to systemd-boot

Portage enables `savedconfig`, `modules-sign`, and `modules-compress` for `sys-kernel/gentoo-kernel`; for `sys-kernel/installkernel`, it enables `systemd-boot`, `dracut`, `uki`, and the `ukify` USE capability. This does not mean ukify generates the UKI: the actual path is set by `/etc/kernel/install.conf`.

File: `/etc/portage/package.use/20-kernel-boot`.

```text
sys-kernel/gentoo-kernel      initramfs savedconfig modules-sign modules-compress -debug
sys-kernel/installkernel     systemd-boot ukify dracut uki -grub -efistub -ugrd -refind
```

On the builder, the kernel package receives the `workstation-kernel` environment through a separate mapping. This is the builder's kernel build environment, distinct from the userspace toolchain and the laptop's `make.conf`.

File: `/etc/portage/package.env/61-workstation-kernel` on the builder.

```text
sys-kernel/gentoo-kernel workstation-kernel
```

File: `/etc/portage/env/workstation-kernel` on the builder.

```makefile
LLVM=1
LLVM_IAS=1

CC="/usr/lib/llvm/23/bin/clang"
CXX="/usr/lib/llvm/23/bin/clang++"
HOSTCC="/usr/lib/llvm/23/bin/clang"
HOSTCXX="/usr/lib/llvm/23/bin/clang++"
LD="/usr/lib/llvm/23/bin/ld.lld"
AR="/usr/lib/llvm/23/bin/llvm-ar"
NM="/usr/lib/llvm/23/bin/llvm-nm"
RANLIB="/usr/lib/llvm/23/bin/llvm-ranlib"

OBJCOPY="/usr/bin/objcopy"
READELF="/usr/bin/readelf"
STRIP="/usr/bin/strip"
OBJDUMP="/usr/bin/objdump"

CFLAGS="-O2 -pipe"
CXXFLAGS="-O2 -pipe"
LDFLAGS="-Wl,-O1 -Wl,--as-needed"

KCFLAGS="-march=alderlake -mtune=alderlake"
KRUSTFLAGS="-C target-cpu=alderlake"
```

`LLVM=1` and the explicit paths select LLVM 23 for the kernel and host tools; `LLVM_IAS=1` selects the integrated assembler. `KCFLAGS` and `KRUSTFLAGS` set the Alder Lake target for kernel C and Rust code. This environment uses `-O2 -pipe` without the global userspace ThinLTO and `-fuse-ld=lld` flags. Kernel `savedconfig` stores the kernel configuration and Linux module-signature settings; its exact version is kept separately for each ebuild.

File: `/etc/kernel/install.conf`.

```ini
layout=uki
initrd_generator=dracut
uki_generator=dracut
```

When the kernel package is merged, `installkernel` passes the new kernel image to `kernel-install`. The Dracut hook creates the initramfs and UKI; this configuration runs `dracut --uefi --no-ukify`. `/etc/dracut.conf.d/20-modules.conf` includes `systemd tpm2-tss crypt btrfs` and omits the unnecessary `network nfs`. `/etc/dracut.conf.d/90-uki.conf` configures UEFI output, Secure Boot signing, and the command line for LUKS2/TPM2 and the root Btrfs subvolume `@`. Do not copy disk UUIDs into the documentation.

After generation, systemd `kernel-install` puts the UKI in `/boot/EFI/Linux/`; the `91-sbctl.install` hook signs the resulting EFI file. systemd-boot discovers the UKI as a Type #2 entry and shows it as a separate boot option. Before rebooting, check that the new UKI and boot entry exist:

```bash
doas ls -lh /boot/EFI/Linux/
bootctl list
doas sbctl verify
```

Expect a UKI for the new version under `/boot/EFI/Linux/`, a `gentoo-<version>-bdsm.efi` entry in `bootctl list`, and no signature verification errors. If the UKI is missing, check `emerge` output, `journalctl`/`kernel-install` logs, and that the ESP is mounted at `/boot`; do not reboot into the new version until the image exists and its signature verifies. Keep the previous working UKI as a fallback.

`modules-sign` and Secure Boot have different jobs. The versioned kernel `savedconfig` enables module signatures and automatic signing, but does not require signatures:

```makefile
CONFIG_MODULE_SIG=y
CONFIG_MODULE_SIG_ALL=y
# CONFIG_MODULE_SIG_FORCE is not set
```

This signature applies to `.ko` files and is checked by the kernel when it loads a module. Dracut/sbctl separately sign the UKI as an EFI PE image verified by Secure Boot firmware. Module signing does not replace UKI signing, and UKI signing does not sign individual external modules. Kernel runtime can additionally enable enforcement with `module.sig_enforce=1`; the UKI signature does not do that.

After the planned reboot, check `uname -r`, `bootctl status`, and LUKS unlock availability. Expect the new version with the `-bdsm` suffix, the selected UKI, and a normal system startup. If boot fails, select the previous working entry in systemd-boot and inspect the new kernel config/UKI before trying again.

## Memory and build caches

File: `/etc/systemd/zram-generator.conf`.

```ini
[zram0]
zram-size =ram / 2
compression-algorithm = zstd
swap-priority = 100
fs-type = swap
```

This creates zram swap sized to half of RAM, using `zstd` and priority `100`. The kernel `savedconfig` contains `# CONFIG_ZSWAP is not set`, so there is no separate zswap backend.

File: `/etc/sysctl.d/99-memory.conf`.

```ini
vm.swappiness = 100
```

`swappiness=100` is a relative reclaim policy for swap in RAM, not a percentage of used memory or a threshold for starting swap.

C/C++ builds use ccache configured in `/etc/portage/make.conf`, with directory `/var/tmp/ccache` and a `20G` limit. Rust uses `RUSTC_WRAPPER=/usr/bin/sccache`, cache `/var/tmp/sccache` with a `20G` limit, and Unix socket `/var/tmp/sccache/sccache.sock`, managed by `sccache-portage.service`. These are local build caches; they do not send source to the builder or distribute compilation.

For heavier builds, `package.env/10-performance` assigns `ssd`, which moves `PORTAGE_TMPDIR` to `/var/tmp/portage-disk`. Other packages use Portage's default `PORTAGE_TMPDIR`. If a build runs out of space, check `df -h /var/tmp /var/tmp/portage-disk /var/tmp/ccache /var/tmp/sccache` and confirm that the package received the `ssd` environment.

## Related documents

- [gentoo-builder-01](../../../gentoo-builder-01/) — builder target and GPKG publication.
- [UKI with Dracut](../../../../installation/systemd-uki-setup/) — general UKI generation configuration.
- [CPU optimization](../../hardware/cpu-optimization/) — workstation Alder Lake and portable builder target.
- [Portage usersync troubleshooting](../../../troubleshooting/portage-usersync-repository-ownership/) — rsync status `23` and Gentoo repository ownership.
- [Gentoo Binary Package Guide](https://wiki.gentoo.org/wiki/Binary_package_guide) and [Portage emerge manual](https://dev.gentoo.org/~zmedico/portage/doc/man/emerge.1.html) — GPKG selection and installation.
- [Gentoo `hostonly` USE flag](https://packages.gentoo.org/useflags/hostonly) — processor-specific Intel microcode selection.
- [Linux kernel module signing](https://docs.kernel.org/admin-guide/module-signing.html) — `.ko` signatures and enforcement.
- [systemd kernel-install](https://freedesktop.org/software/systemd/man/latest/kernel-install.html), [systemd-boot](https://www.freedesktop.org/software/systemd/man/latest/systemd-boot.html), and [Dracut](https://man7.org/linux/man-pages/man8/dracut.8.html) — hooks, UKIs, and boot entries.
