---
title: Base system configuration
kind: guide
scope: general
status: current
last_verified: "2026-09-20"
verified_on: [asus-b5402]
---

## Goal / Result

An example of a base Portage configuration for Gentoo:

- an LLVM/Clang/LLD toolchain;
- `-O2` + ThinLTO as the optimization baseline;
- an explicit CPU target (`-march=<microarchitecture>`);
- ccache for repeated builds;
- a USE policy leaning towards Wayland, systemd and security (tpm,
  secureboot, apparmor, hardened).

The second part of the base system is privilege escalation: instead of
the heavyweight sudo, the lightweight doas is used.

The configuration was verified on the reference machine, an ASUS B5402;
its actual state is recorded in
[the system section](../../systems/asus-b5402/system/boot-and-portage/).

## Prerequisites / Before you copy

The configuration below is a verified example from an ASUS B5402
(Alder Lake, LLVM 22), not a universal baseline. Before copying it, make
sure to adapt it to your hardware and software set:

- `-march=alderlake` — your CPU's microarchitecture;
- `CPU_FLAGS_X86` — your CPU's instruction set;
- `MAKEOPTS="-j14 -l10"` — core count and memory size;
- `LLVM_SLOT="22"` and the `/usr/lib/llvm/22/bin/clang` path in
  `RUSTFLAGS` — the LLVM slot actually installed;
- `SECUREBOOT_SIGN_KEY` / `SECUREBOOT_SIGN_CERT` — paths to your sbctl
  keys;
- individual USE flags and `VIDEO_CARDS="intel zink"` — your hardware,
  GPU, and the system's workload.

## 1. Toolchain setup (`/etc/portage/make.conf`)

Below is a profile with the LLVM stack, the global LLD linker and
ccache.

```makefile
# Глобальный тулчейн LLVM
LLVM_SLOT="22"
CC="clang"
CXX="clang++"
AR="llvm-ar"
NM="llvm-nm"
RANLIB="llvm-ranlib"

# CPU и общие флаги (Alder Lake + O2 + ThinLTO)
COMMON_FLAGS="-march=alderlake -O2 -flto=thin -pipe -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk"
CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"
# GNU Fortran не понимает `-flto=thin` (расширение Clang) — отдельный набор без LTO
FORTRAN_FLAGS="-march=alderlake -O2 -pipe -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk"
FCFLAGS="${FORTRAN_FLAGS}"
FFLAGS="${FORTRAN_FLAGS}"
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"

# Параллельная сборка
MAKEOPTS="-j14 -l10"

# Флаги компиляторов
RUSTFLAGS="-C target-cpu=alderlake -C opt-level=3 -C linker=/usr/lib/llvm/22/bin/clang -C link-arg=-fuse-ld=lld"
LDFLAGS="-Wl,-O1 -Wl,--as-needed -fuse-ld=lld"
GOAMD64="v3"
CGO_CFLAGS="${CFLAGS}"
CGO_CXXFLAGS="${CXXFLAGS}"
CGO_LDFLAGS="${LDFLAGS}"

# ccache настройки (сжатие включено по умолчанию)
FEATURES="${FEATURES} ccache"
CCACHE_DIR="/var/tmp/ccache"
CCACHE_SIZE="50G"
CCACHE_COMPRESSLEVEL="3"
CCACHE_SLOPPINESS="include_file_mtime,include_file_ctime,time_macros,pch_defines"

# Комментарии — только вне строки USE: внутри кавычек они попадают в переменную.
# Точечные флаги (sound-server, screencast, lto, gles2) заданы в package.use.
USE="
  wayland egl opencl vaapi vulkan
  pgo custom-cflags asm
  alsa ffmpeg gstreamer pipewire v4l icu
  bluetooth dist-kernel
  btrfs zstd
  systemd dbus policykit
  libinput
  tpm cryptsetup openssl secureboot apparmor audit bpf nftables verify-sig hardened
  -X -xwayland -elogind -consolekit -pulseaudio -telemetry
"

# Видео и графика: значение intel уже включает драйверы iris и crocus
VIDEO_CARDS="intel zink"
INPUT_DEVICES="libinput"

ABI_X86="64"
LC_MESSAGES="C.UTF-8"

GENTOO_MIRRORS="https://mirror.yandex.ru/gentoo-distfiles/ \
    https://distfiles.gentoo.org/"

SECUREBOOT_SIGN_KEY="/var/lib/sbctl/keys/db/db.key"
SECUREBOOT_SIGN_CERT="/var/lib/sbctl/keys/db/db.pem"
```

> **Note**: the optimization baseline is global `-O2`; ThinLTO remains
> where the package/ebuild policy allows it. `-O3` is allowed only
> per-package and only after a separate benchmark. The decision
> (2026-09-20) was made after comparing `-O2`/`-O3` on four classes of
> workloads — methodology and data:
> [experiments/llvm23-toolchain](../../experiments/llvm23-toolchain/).

> **Note**: for a specific system an explicit
> `-march=<microarchitecture>` is recommended: such a policy is
> reproducible and can be verified against the config. `-march=native`
> is convenient for a one-off local build, but it picks flags for the
> particular CPU instance doing the compiling, which makes it a poor
> fit for a documented, reproducible policy. The ASUS example uses
> `-march=alderlake`.

> **Note**: with several LLVM slots installed, the linker for Rust is
> pinned by absolute path (`-C linker=/usr/lib/llvm/22/bin/clang`) so
> that the build does not depend on which slot happens to come first in
> `PATH`.

> **Note**: the Gentoo wiki does not recommend enabling ccache globally:
> the cache saturates and the hit rate drops; for individual packages it
> is enabled via `/etc/portage/package.env`.

## 2. Privilege escalation (doas)

Doas is a separate part of the base system and has nothing to do with
the toolchain.

File: `/etc/doas.conf`

```conf
# Разрешить пользователю выполнять команды от root с сохранением пароля на время сессии
permit persist :wheel

# Сохранять переменные окружения для конкретного пользователя
permit keepenv <username>

# Разрешить выполнение snapper без ввода пароля (для снапшотов)
permit persist :wheel as root cmd snapper
```

This is a generic example, not the actual policy of a particular
machine: the privilege setup of the reference ASUS B5402 is described in
[systems/asus-b5402/security/doas.md](../../systems/asus-b5402/security/doas/).

## Verification

The final configuration as seen by Portage is checked with a read-only
query (the system is not modified):

```bash
portageq envvar CFLAGS CXXFLAGS
portageq envvar USE VIDEO_CARDS MAKEOPTS
```

## History

- `mold` was previously used as the global linker. The system is now
  built with `lld`; `mold` remains the linker for the Rust flags in
  `env/p-cores`.
- `make.conf` used to set `GOFLAGS="-buildmode=pie"`. It is not needed:
  Go ebuilds are built with the `GOFLAGS` from `go-env.eclass`, which on
  amd64 already includes `-buildmode=pie`.
