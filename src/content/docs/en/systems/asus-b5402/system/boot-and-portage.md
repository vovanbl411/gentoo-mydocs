---
title: Boot and Portage on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Current state

| Item | Value |
|-----|----------|
| Kernel | `7.2.7-bdsm` — `sys-kernel/gentoo-kernel` with `savedconfig` |
| Kernel build | LLVM 23.1.1 (`kernel-llvm` env, pilot) |
| Main toolchain | LLVM/Clang/LLD 22 |
| Optimization | global `-O2` + ThinLTO |
| Runtime ABI | GNU remains the default |
| Boot loader | systemd-boot |
| UKI generator | Dracut — `ukify` is not in the generation path |
| Root | LUKS2 → TPM2 unlock → Btrfs subvolume `@` |
| Portage env | 4 files in `env/`, 3 files in `package.env/` |

## Toolchain

- The production toolchain is LLVM/Clang/LLD 22. The kernel is intentionally
  built with LLVM 23.1.1 (`kernel-llvm` env, pilot): experiment A1–A4 on LLVM
  23 compatibility is complete, and migration of the rest of the system to
  LLVM 23 has not started.
- The CPU target is the explicit `-march=alderlake`: it is reproducible and
  can be checked against the config. `-march=native` adapts to the specific CPU
  instance doing the compilation and was therefore rejected as production
  policy. The explicit `-mno-*` set remains to disable features the processor
  does not have.
- Recorded profile: `MAKEOPTS="-j14 -l10"`, leaving headroom for the hybrid
  cores and memory, and `VIDEO_CARDS="intel zink"` (the invalid `iris` token
  was removed on 2026-09-11).
- `GOFLAGS` was removed on 2026-09-11 because it did not affect builds:
  `go-env.eclass` sets its own `GOFLAGS` and adds `-buildmode=pie` itself.
- Global ccache is used for repeated builds; BOLT is disabled.
- **ccache measurement after an intensive build period (2026-09-25):**
  234,108 of 328,009 calls were cacheable (71.37%); there were 50,581 hits
  (21.61% of cacheable calls), including 23,474 direct and 27,107
  preprocessed hits. There were 93,897 uncacheable calls and 4 errors. The
  cache directory used 47G of its 50G limit (99.90%), with 276 cleanups.
  **Decision:** keep global ccache enabled
  and leave the 50G limit unchanged; the size can be reconsidered after a
  period of ordinary updates.

## Optimization

Global `-O2`; ThinLTO is global where package/ebuild policy allows it; `-O3` is
used only per package after a separate benchmark. No selective `-O3` rules were
created after experiments B1–B4. The decision was made on 2026-09-20; the
evidence is in [experiments/llvm23-toolchain](../../../../experiments/llvm23-toolchain/).

- Fortran uses `-O2` without ThinLTO: GNU Fortran does not understand
  `-flto=thin` (a Clang extension).
- The policy was applied to `/etc/portage` on 2026-09-20: `-O3` → `-O2` in
  `make.conf` and env files (`kernel-llvm` was already `-O2`).
  `portageq envvar CFLAGS CXXFLAGS` confirms `-O2 -flto=thin`; the resolver
  calculates successfully.
- A full `@world` rebuild after the optimization/LTO policy change completed
  on 2026-09-21: the system booted normally and its main services worked; logs
  showed no regressions related to `-O2` + ThinLTO. This does not mean that
  every installed file was built with ThinLTO: ebuilds may filter LTO
  (`filter-lto`), and some packages do not use the C/C++ toolchain at all.

## Package.env and GCC exceptions

Current structure: 4 files in `env/`, 3 files in `package.env`:

```text
/etc/portage/env:          gcc-fallback  kernel-llvm  p-cores  ssd
/etc/portage/package.env:  00-toolchain  10-performance  30-gcc-fallback
```

Current policy:

- C/C++ uses global `-O2` + ThinLTO unless the ebuild filters it itself; the
  local `no-lto-llvm` blacklist has been removed.
- There are only two current GCC fallback exceptions: `sys-devel/binutils`
  (a real Clang + PGO problem) and `x11-libs/pango` (a temporary exception
  before the LLVM 23 transition due to a known Clang 23 issue). Assignments
  are in `30-gcc-fallback`. The BFD policy is in `env/gcc-fallback`: GCC LTO
  (`-flto=auto`) is incompatible with the global `-fuse-ld=lld`.
- Performance policy (`p-cores`, `ssd`) is in `00-toolchain` and
  `10-performance`: clang/lld/llvm (`p-cores ssd`), gentoo-kernel
  (`kernel-llvm p-cores ssd`), firefox and qtbase (`p-cores ssd`), and mesa
  (`ssd` only).

### How this policy developed

- The main audit and `make.conf` cleanup were done on 2026-09-11; the
  optimization policy was applied on 2026-09-20.
- No-LTO exception cleanup completed on 2026-09-21: all 102 local
  `no-lto-llvm` overrides were rechecked and removed in controlled batches
  (checked with `emerge --buildpkgonly -1`); `env/no-lto-llvm`, `env/no-ccache`
  (after its last consumer disappeared), and `package.env/20-compatibility`
  were removed. None of the overrides were still needed: some ebuilds manage
  LTO themselves (`filter-lto`), and some Go/Rust packages do not use these
  C/C++ flags directly.
- Rechecked on 2026-09-20 and no longer documented as GCC exceptions:
  `app-shells/bash` (including `USE=pgo`), `app-containers/lxc-7.0.0-r1`,
  `app-editors/nano`, `dev-cpp/highway`, `net-analyzer/nmap`,
  `media-libs/libjxl`, and modern OpenJDK all build successfully with the
  production Clang toolchain.

## Boot

Boot path:

```text
systemd-boot → UKI (Dracut) → LUKS2 (TPM2) → Btrfs (@)
```

- Current kernel (2026-09-22) is `7.2.7-bdsm`: `sys-kernel/gentoo-kernel-7.2.7`
  and `-7.2.6`, plus `installkernel-68-r1`, are installed. The system booted
  successfully on kernel 7.2.7 after the update; no full regression test of
  all subsystems was performed separately.
- `kernel-install` uses `layout=uki`, `initrd_generator=dracut`, and
  `uki_generator=dracut` (`/etc/kernel/install.conf`, checked on 2026-09-22).
  Dracut is the production UKI generator: it creates the UKI, and systemd-boot
  loads it from the ESP. `ukify` is only a USE capability of
  `sys-kernel/installkernel` (see package policy below) and is not in the
  generation path.
- Dracut signs UKIs with sbctl keys; after installation, the sbctl plugin
  checks the signature of the resulting EFI file.
- `bootctl list` (2026-09-22): the current boot is `gentoo-7.2.7-bdsm.efi`
  (selected); the ESP also contains `gentoo-7.2.6-bdsm.efi`,
  `gentoo-7.2.2-bdsm.efi`, and Arch UKIs (`arch-linux-cachyos.efi` — default,
  `arch-linux.efi`).
- Secure Boot and the presence of correctly signed boot artifacts were
  checked on 2026-09-22.
- Automatic TPM2 LUKS unlock was last confirmed by a successful real boot on
  2026-09-14; it was not tested again on 2026-09-22.
- AppArmor: the cmdline uses `apparmor=1` and
  `lsm=landlock,lockdown,yama,integrity,apparmor,bpf`; the obsolete
  `security=apparmor` was removed. AppArmor is present in the active runtime
  LSM set.

## Package policy

Confirmed by checking the live system on 2026-09-12 (files in
`/etc/portage/package.use/`).

```makefile
# /etc/portage/package.use/20-kernel-boot
sys-kernel/gentoo-kernel      initramfs savedconfig modules-sign modules-compress -debug
sys-kernel/installkernel      systemd-boot ukify dracut uki -grub -efistub -ugrd -refind
sys-kernel/linux-firmware     compress-zstd deduplicate -savedconfig
sys-firmware/intel-microcode  dist-kernel initramfs split-ucode hostonly -vanilla
```

- Kernel `savedconfig` is stored in `/etc/portage/savedconfig/sys-kernel/`
  (checked on 2026-09-22): a rolling `gentoo-kernel` file and versioned
  `gentoo-kernel-7.2.6`, `gentoo-kernel-7.2.7` files (PF > PN priority under
  the eclass rule); there are no `*.bak` files.
- The old `-generic` flag for gentoo-kernel is obsolete: it is absent from
  current ebuilds (the scheme changed to `generic-uki`), so it was removed
  from the live configuration.
- With `savedconfig` disabled for linux-firmware, the saved list
  `linux-firmware-20260916` is not applied; what to do with the file remains
  undecided (it was updated from the former `20260810`, checked on 2026-09-22).
- The specific `llvm_slot_*` rules were removed on 2026-09-12: with LLVM slots
  22 and 23 installed, all consumers (mesa, mesa_clc, niri, bpftool, perf,
  firefox, xwayland-satellite) resolve to 22 because their ebuilds do not yet
  support slot 23. When `llvm_slot_23` becomes available, defaults will switch
  to it automatically; decide about migration then.
- `video_cards_i915` was removed from mesa on 2026-09-12: it is a legacy
  Gen2–Gen5 driver; Iris serves Alder Lake graphics (`intel` in
  `VIDEO_CARDS`).
- Java: source `dev-java/openjdk:17` is no longer needed; the system moved to
  `dev-java/openjdk-bin:25` as the system VM through `eselect java-vm`, checked
  with `java -version` (Temurin 25.0.4 LTS) and `javac -version`.

## USE policy details

This section records individual USE flag decisions; the main text above can be
read without it.

Global `make.conf` changes (audit on 2026-09-12):

- Seven flags with no installed consumers were removed from global `USE`
  (`mapi`, `vpp`, `zink`, `networkmanager`, `udisks2`, `libnotify`, `acpi`).
  The Zink driver is unaffected: it is controlled by `video_cards_zink` from
  `VIDEO_CARDS`.
- Four more flags were moved into `package.use`: `sound-server` (pipewire),
  `screencast` (niri), `lto` (gcc), and `gles2` (gst-plugins-base,
  mesa-progs). `egl`, `ffmpeg`, `v4l`, `pgo`, `custom-cflags`, and `btrfs`
  remain global policy.
- `verify-provenance` was enabled globally in `make.conf`: supporting
  `dev-python/*` ebuilds use it to check PyPI provenance/attestations. It
  supplements `verify-sig`, does not replace it, and does not apply to every
  Python package.

### Review 2026-09-22: base and system packages

Partial USE flag review; only decisions accepted and applied by the owner are
recorded:

- `app-alternatives/gzip` — `pigz` (parallel gzip) was selected instead of
  reference GNU gzip.
- `dev-libs/libpcre2` — `jit`: PCRE2 JIT capability and JIT in `pcre2grep`;
  this does not make every PCRE2 consumer use JIT automatically.
- `dev-libs/openssl` — `ktls`: kernel support is already present; the USE flag
  only compiles kTLS support into OpenSSL, and its actual use requires an
  application/runtime opt-in (`SSL_OP_ENABLE_KTLS` or equivalent).
- `sys-process/audit` — `io-uring`: support for kernel Audit `io_uring`
  filters/rules and interpretation of io_uring operations; this does not move
  `auditd` itself to io_uring.
- `sys-apps/util-linux` — `caps` (adds `setpriv` for capability/hardening
  diagnostics), `-cramfs` (legacy filesystem tools are not needed).
- `app-misc/pax-utils` — `caps`: `pspax` displays process capability sets.
- `sys-devel/gettext` — `git`: `autopoint` uses a Git backend for internal
  infrastructure data.
- `sys-apps/coreutils` — `caps` (capability-aware file utilities) and `gmp`
  (multiprecision arithmetic in `factor`, `expr`, `basenc`).

Architectural decisions from the same review:

- **TPM policy**: `app-crypt/tpm2-tss -fapi -policy`,
  `app-crypt/tpm2-tools -fapi`, `app-crypt/gnupg -tpm`. TPM is used for
  LUKS2/`systemd-cryptenroll`; TSS FAPI is not used, and GnuPG keys are not
  stored on the TPM.
- **Containers**: `app-containers/lxc landlock` in addition to the retained
  `apparmor caps seccomp`; `app-containers/containerd -cri` because Kubernetes/
  CRI is not used. Runtime storage drivers were checked: Docker uses
  `overlay2`, Podman uses `overlay`, so `app-containers/docker -btrfs` and
  `app-containers/podman -btrfs` are deliberate despite the Btrfs host
  filesystem. The same reasoning applies to `containerd`: `-btrfs` after a
  resolver check that nothing requires `containerd[btrfs]` anymore.
- **Privilege hardening**: `sys-process/htop caps -filecaps` — regular htop is
  not given persistent `CAP_SYS_PTRACE`; elevated access is through
  `doas htop`. `sys-apps/smartmontools caps` — smartd drops extra privileges
  through libcap-ng.
- **Chrony**: `net-misc/chrony -phc -refclock -rtc`, checked against
  `/etc/chrony/chrony.conf`; the corresponding directives are absent. Regular
  `rtcsync` does not depend on USE=`rtc`.
- **Graphics**: `media-libs/mesa -vaapi -lm-sensors` with
  `VIDEO_CARDS="intel zink"` — Gallium VA-API is not used for this Intel
  setup (VA-API is provided by a separate Intel/libva stack), and Mesa needs
  `lm-sensors` only for the unused Gallium HUD.
- **LLVM runtime policy**: `clang-runtime:22` and `clang-runtime:23` use
  `compiler-rt openmp sanitize` with `-default-compiler-rt -default-libcxx
  -default-lld -libcxx -llvm-libunwind`. The GNU runtime ABI remains the
  default; the presence of compiler-rt/sanitizer runtimes does not switch the
  system to LLVM runtimes — that is a separate [Experiment
  C](../../../../experiments/llvm23-toolchain/) (NOT STARTED).
- **OpenVPN**: `net-vpn/openvpn dco kernel-ovpn` (decision on 2026-09-22
  after the `ovpn-dco` incident): DCO is enabled through the in-kernel mainline
  `ovpn` module (`CONFIG_OVPN=m`, built with the kernel). The out-of-tree
  `net-vpn/ovpn-dco` is not used: it requires removing
  `CONFIG_TRIM_UNUSED_KSYMS` and duplicates the in-kernel module; with `dco`
  enabled but without `kernel-ovpn`, the `ovpn-dco` package fails its kernel
  config check in setup phase.

### Review 2026-09-22: desktop and application stack

**Desktop / document stack**

- `app-text/poppler cairo` — Cairo/GLib backend enabled; the meaningless
  `introspection -cairo` combination was removed.
- `dev-java/openjdk-bin -source` — the runtime/JDK remains, source
  installation is not needed.
- `media-gfx/imagemagick lcms tiff` — ICC color management and TIFF support
  are part of the general-purpose image tool's capabilities.

**Multimedia**

- `media-libs/gst-plugins-base orc`, `gst-plugins-good orc`,
  `gst-plugins-bad orc` — one ORC/JIT policy for the main GStreamer stack.
- `media-video/ffmpeg pulseaudio` — libpulse backend over the PipeWire
  compatibility layer.
- `app-emulation/spice opus` — Opus audio support.
- `media-libs/libheif -kvazaar` — HEVC encoding remains with x265; a second
  encoder is not needed.

**Firmware / platform**

- `sys-apps/fwupd uefi gnutls` — UEFI capsule/update functionality for the
  laptop; this configuration requires `gnutls`.

**Secrets / TPM**

- `app-crypt/libsecret -pam -tpm` — libsecret TPM integration is not used,
  consistent with the TPM policy above (TPM only for LUKS2/
  `systemd-cryptenroll`); PAM integration remains through
  `gnome-base/gnome-keyring[pam]`.

**Qt / desktop performance**

- `dev-qt/qtdeclarative jit` — the QML JIT runtime path remains available to
  Qt Quick/QML consumers.
- `dev-qt/qtbase io-uring` — Qt's io_uring backend is enabled; this is a
  deliberate performance/capability choice, not a claim of guaranteed speedup.
- `media-gfx/qimgv video exif` — video/animated media through libmpv and EXIF
  metadata support.
- `gui-apps/noctalia jemalloc` — jemalloc remains the selected runtime memory
  allocation policy for the long-running shell (see the
  [system desktop section](../../desktop/noctalia/)).

**Network analysis**

- `net-analyzer/wireshark http2 http3 sshdump` — full modern HTTP/2 and HTTP/3
  support; remote capture over SSH.

**Firefox cleanup**

- The local `www-client/firefox -jumbo-build` override was removed and no
  explicit `jumbo-build` was added: the current Gentoo profile forces
  `jumbo-build` for Firefox, and `USE=pgo` also requires it. The negative
  local override was a no-op and is no longer policy; `jumbo-build` is
  inherited from the profile.

Smaller confirmed decisions: `app-misc/fastfetch drm pulseaudio`,
`dev-lang/ruby gmp`.

The 2026-09-22 review is complete. It closed only the decisions listed here
and does not replace the full `/etc/portage` audit from 2026-09-14.

## State verification

Sections are checked against the live system in stages:

| Section | Checked |
|--------|-----------|
| Secure Boot and boot artifact signatures | 2026-09-22 |
| TPM2 auto-unlock of LUKS (real boot) | 2026-09-14 |
| Toolchain and package.env | 2026-09-20…21 |
| Package policy (`package.use/`) | 2026-09-12 |
| USE policy review | 2026-09-22 |
| Current kernel, UKI generator, savedconfig | 2026-09-22 |

Main verification commands:

```bash
portageq envvar CFLAGS CXXFLAGS   # -O2 -flto=thin
bootctl list                      # current boot — gentoo-7.2.7-bdsm.efi
java -version                     # openjdk-bin:25, Temurin 25.0.4 LTS
```

## Related docs

- [Base system](../../../../installation/base-system/)
- [UKI with Dracut](../../../../installation/systemd-uki-setup/)
- [Portage](../../../../managed/portage/)
- [LLVM 23 toolchain experiment](../../../../experiments/llvm23-toolchain/)
