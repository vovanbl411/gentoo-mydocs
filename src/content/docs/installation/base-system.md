---
title: Базовая настройка системы (Base System)
kind: guide
scope: general
status: current
last_verified: "2026-09-25"
verified_on: [asus-b5402]
---

## Goal / Result

Пример базовой Portage-конфигурации Gentoo:

- тулчейн LLVM/Clang/LLD;
- `-O2` + ThinLTO как optimization baseline;
- явный CPU target (`-march=<microarchitecture>`);
- ccache для C/C++ и sccache для Rust;
- USE-policy в сторону Wayland, systemd и security (tpm, secureboot,
  apparmor, hardened).

Вторая часть базовой системы — повышение привилегий: вместо громоздкого
sudo используется легковесный doas.

Конфигурация проверена на эталонной машине ASUS B5402; её фактическое
состояние записано в
[системном разделе](../../systems/asus-b5402/system/boot-and-portage/).

## Prerequisites / Before you copy

Конфигурация ниже — проверенный пример с ASUS B5402 (Alder Lake, LLVM 22),
а не универсальный baseline. Перед копированием обязательно адаптируйте под
своё железо и набор ПО:

- `-march=alderlake` — микроархитектура вашего процессора;
- `CPU_FLAGS_X86` — набор инструкций вашего CPU;
- `MAKEOPTS="-j14 -l10"` — число ядер и объём памяти;
- `LLVM_SLOT="22"` и путь `/usr/lib/llvm/22/bin/clang` в `RUSTFLAGS` —
  фактически установленный слот LLVM;
- `SECUREBOOT_SIGN_KEY` / `SECUREBOOT_SIGN_CERT` — пути ваших ключей sbctl;
- отдельные USE-флаги и `VIDEO_CARDS="intel zink"` — ваше железо, GPU и
  задачи системы.

## 1. Настройка тулчейна (`/etc/portage/make.conf`)

Ниже приведён профиль со стеком LLVM, глобальным линкером LLD и кэшами
компиляции: ccache для C/C++ и sccache для Rust.

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

# C/C++ compiler cache (сжатие включено по умолчанию)
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

### Rust cache (sccache)

Для Rust sccache подключается через `RUSTC_WRAPPER` и требует работающий
sccache server. Способ запуска и transport зависят от конфигурации хоста.
Значения ниже — фактическая policy ASUS B5402: сервер работает под systemd,
а Portage подключается к нему через Unix domain socket. Это проверенная
реализация для этой машины, а не обязательная конфигурация для любого
Gentoo-хоста.

Файл: `/etc/portage/make.conf`

```makefile
RUSTC_WRAPPER="/usr/bin/sccache"
SCCACHE_DIR="/var/tmp/sccache"
SCCACHE_CACHE_SIZE="20G"
SCCACHE_SERVER_UDS="/var/tmp/sccache/sccache.sock"
```

На ASUS B5402 постоянный сервер — `sccache-portage.service`, запущенный от
`portage:portage`; подробности и результаты cold/warm acceptance приведены в
[системном разделе](../../systems/asus-b5402/system/boot-and-portage/).

> **Примечание**: optimization baseline — глобальный `-O2`; ThinLTO остаётся
> там, где package/ebuild policy его допускает. `-O3` допускается только
> package-specific и только после отдельного benchmark. Решение (2026-09-20)
> принято по итогам сравнения `-O2`/`-O3` на четырёх классах workload —
> методика и данные:
> [experiments/llvm23-toolchain](../../experiments/llvm23-toolchain/).

> **Примечание**: для конкретной системы рекомендуется явный
> `-march=<microarchitecture>`: такая policy воспроизводима и проверяема по
> конфигу. `-march=native` удобен для локальной одноразовой сборки, но
> подбирает флаги под конкретный экземпляр CPU, на котором идёт компиляция, и
> хуже подходит как документированная reproducible policy. Пример ASUS
> использует `-march=alderlake`.

> **Примечание**: при нескольких слотах LLVM линкер для Rust фиксируют
> абсолютным путём (`-C linker=/usr/lib/llvm/22/bin/clang`), чтобы сборка не
> зависела от того, какой слот оказывается первым в `PATH`.

> **Примечание**: вики Gentoo не рекомендует включать ccache глобально: кэш
> насыщается, и доля попаданий падает; для отдельных пакетов его включают
> через `/etc/portage/package.env`.

## 2. Повышение привилегий (doas)

Doas — отдельная часть базовой системы, к toolchain отношения не имеет.

Файл: `/etc/doas.conf`

```conf
# Разрешить пользователю выполнять команды от root с сохранением пароля на время сессии
permit persist :wheel

# Сохранять переменные окружения для конкретного пользователя
permit keepenv <username>

# Разрешить выполнение snapper без ввода пароля (для снапшотов)
permit persist :wheel as root cmd snapper
```

Это общий пример, а не фактическая policy конкретной машины: систему
привилегий эталонного ASUS B5402 описывает
[systems/asus-b5402/security/doas.md](../../systems/asus-b5402/security/doas/).

## Verification

Итоговую конфигурацию, которую видит Portage, сверяют read-only запросом
(система при этом не меняется):

```bash
portageq envvar CFLAGS CXXFLAGS
portageq envvar USE VIDEO_CARDS MAKEOPTS
```

## History

- Ранее в качестве глобального линкера использовался `mold`. Сейчас системная
  сборка идёт через `lld`; `mold` остаётся в качестве линкера для Rust-флагов
  в `env/p-cores`.
- Раньше в `make.conf` задавался `GOFLAGS="-buildmode=pie"`. Он не нужен:
  ebuild'ы Go собираются с `GOFLAGS` из `go-env.eclass`, который на amd64 уже
  включает `-buildmode=pie`.
