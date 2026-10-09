---
title: Gentoo Builder VM — gentoo-builder-01
kind: system
scope: system
status: current
last_verified: "2026-10-09"
verified_on: [gentoo-builder-01]
---

## Current state

`gentoo-builder-01` — отдельная headless VM на домашнем Proxmox для будущей
сборки portable userspace binpkgs (`.gpkg`) для ASUS B5402. Это replaceable
build appliance: она должна разгружать workstation, сохраняя её независимость
от сервера. VM создана вручную, Terraform/Packer не используются;
desktop/UI не устанавливается, обязательный autostart постоянного сервиса
не предусмотрен.

**Package-policy этап CLOSED / PASS на 2026-10-09; установка VM ещё не завершена.**
По проверкам владельца завершены:

- no-multilib bootstrap — PASS;
- production LLVM/Clang/LLD portable toolchain — PASS;
- repository contract — PASS;
- синхронизация workstation-compatible userspace package policy — PASS;
- initial full policy convergence/rebuild после stage3 — PASS.

Финальный `@world` resolver: `Total: 0 packages, Size of downloads: 0 KiB`.
Временные bootstrap overrides удалены. C/C++ используют LLVM/Clang/LLD
22.1.8, `x86-64-v3`, `-O2` и ThinLTO; Fortran сохраняет `-O2` без ThinLTO.
Rust 1.97.1 использует portable CPU target, Go 1.27.1 — `GOAMD64=v3`.

Builder остаётся в installer/chroot phase. Следующий шаг — продолжить
обычную установку VM до first boot и guest-side validation. Private binhost
не настроен, end-to-end binpkg pilot не начат; server ON/OFF fallback
acceptance остаётся pending. Ядро workstation остаётся local-only.

| Параметр | Подтверждённое состояние |
|----------|--------------------------|
| VM | `gentoo-builder-01`, VMID `5201`, host `pve-01` |
| Ресурсы | 16 cores, 1 socket, 16384 MiB RAM, NUMA отключена |
| CPU | Proxmox `host`; гость видит Intel Xeon E5-2696 v4 (Broadwell-EP) |
| ISA capability | `x86-64-v3` подтверждена внутри VM; `x86-64-v4` не поддерживается |
| Диск | 100 GiB, GPT; 1 MiB BIOS boot, 8 GiB active swap, около 92 GiB ext4 root |
| Install state | Stage3 extracted в `/mnt/gentoo`; chroot operational, DNS работает |
| Release | Gentoo Base System release 2.18 |
| Активный профиль | `default/linux/amd64/23.0/no-multilib/hardened/systemd` |
| Build target / ABI | C/C++ `-march=x86-64-v3 -O2 -flto=thin -pipe`; `ABI_X86=64`; GCC multilib list — только `.;` |
| Rebuild / resolver | Полная пересборка под финальной package/toolchain policy завершена; final resolver — `Total: 0 packages, Size of downloads: 0 KiB` |
| Production toolchain | LLVM/Clang/LLD и `llvm-config` 22.1.8; `llvm-ar`, `llvm-nm`, `llvm-ranlib` проверены |
| Параллельная сборка | `MAKEOPTS="-j16 -l10"` |
| Rust | 1.97.1; `target-cpu=x86-64-v3`, внешний Clang/LLD для linking |
| Go | 1.27.1; `GOAMD64=v3` |
| Private binhost / binpkg pilot | Не настроен / не начат |

> **Важно:** GNU runtime ABI сохраняется; это не миграция libc/libgcc.

## VM baseline

Подтверждённая Proxmox configuration после подготовки:

| Параметр | Значение |
|----------|----------|
| Agent | `agent: 1` — настройка Proxmox, не подтверждение работающего guest agent |
| Boot order | Installation ISO first, затем `scsi0` / `net0` |
| CPU / RAM | `cpu: host`, `cores: 16`, `sockets: 1`, `memory: 16384`, `numa: 0` |
| Диск | Storage `vm-nvme`, 100 GiB, VirtIO SCSI Single |
| Disk options | `discard=on`, `iothread=1`, `ssd=1` |
| Сеть | VirtIO, bridge `vmbr0`, VLAN `20`, `firewall=1` |
| Tags | `build`, `gentoo` |

Установочный образ — Gentoo amd64 Minimal Installation CD; локальное имя
в Proxmox — `gentoo-hardened-systemd-minimal.iso`. ISO использован только
как installer/live environment. Загрузка live environment — BIOS / SeaBIOS,
не UEFI.

## Выполненная подготовка до точки остановки

Stage3/chroot bootstrap повторно пройден 2026-10-08. Общая процедура — в
[руководстве по ручной установке Gentoo](../../installation/gentoo-installation/);
ниже остаются результаты для этой VM.

1. VM загружена с Minimal ISO. В госте подтверждена physical CPU model
   Intel Xeon E5-2696 v4; glibc loader показал поддержку `x86-64-v3` и
   `x86-64-v2`, но не `x86-64-v4`.
2. На `/dev/sda` (100 GiB, QEMU HARDDISK) создан GPT layout:

   | Раздел | Размер | Назначение / filesystem |
   |--------|--------|-------------------------|
   | `/dev/sda1` | 1 MiB | BIOS boot, `bios_grub`; filesystem отсутствует и не нужен |
   | `/dev/sda2` | 8 GiB | swap, label `gentoo-swap` |
   | `/dev/sda3` | Около 92 GiB | ext4, label `gentoo-root`, будущий `/` |

   Swap активирован; `/dev/sda3` смонтирован в `/mnt/gentoo`.
   LVM, Btrfs, отдельный `/boot` и дополнительные filesystem layers
   не вводились: builder остаётся простым и replaceable, thin provisioning
   уже предоставляет Proxmox storage layer.
3. Проверен checksum официального
   `stage3-amd64-hardened-systemd-20261004T164559Z.tar.xz`, затем stage3
   распакован в `/mnt/gentoo`. Исходный профиль stage3 —
   `default/linux/amd64/23.0/hardened/systemd`; активный профиль теперь no-multilib.
4. Для chroot подготовлены `/proc`, `/sys`, `/dev`, `/run`; `/etc/resolv.conf`
   передан в новую систему. После входа проверены release, profile,
   mountpoints и DNS.
5. Исходный `/etc/portage/make.conf` сохранён как `make.conf.stage3`;
   применён минимальный `-march=x86-64-v3 -O2 -pipe`, Gentoo repository
   синхронизирован, news просмотрены.
6. Выбран `default/linux/amd64/23.0/no-multilib/hardened/systemd`.
   Пересборка после смены профиля завершилась успешно; подтверждены
   `ABI_X86=64`, единственная строка `.;` в GCC multilib list и
   `Total: 0 packages` в final resolver.

## Текущая Portage policy

Profile/ABI contract: `CHOST=x86_64-pc-linux-gnu`, `ABI_X86=64`.
Effective profile/environment, подтверждённый через `portageq envvar`:

```text
PYTHON_SINGLE_TARGET="python3_14"
PYTHON_TARGETS="python3_14"
```

Эти Python targets пришли из effective profile policy; в `make.conf`
они явно не записывались.

Файл внутри chroot: `/etc/portage/make.conf`.
Явно заданные значения production policy:

```makefile
LLVM_SLOT="22"
VIDEO_CARDS="intel zink"
INPUT_DEVICES="libinput"

CC="clang"
CXX="clang++"
AR="llvm-ar"
NM="llvm-nm"
RANLIB="llvm-ranlib"

COMMON_FLAGS="-march=x86-64-v3 -O2 -flto=thin -pipe"
CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"

FORTRAN_FLAGS="-march=x86-64-v3 -O2 -pipe"
FCFLAGS="${FORTRAN_FLAGS}"
FFLAGS="${FORTRAN_FLAGS}"

LDFLAGS="-Wl,-O1 -Wl,--as-needed -fuse-ld=lld"
CGO_CFLAGS="${CFLAGS}"
CGO_CXXFLAGS="${CXXFLAGS}"
CGO_LDFLAGS="${LDFLAGS}"
MAKEOPTS="-j16 -l10"
CPU_FLAGS_X86="aes avx avx2 bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sse sse2 sse3 sse4_1 sse4_2 ssse3"
RUSTFLAGS="-C target-cpu=x86-64-v3 -C linker=/usr/lib/llvm/22/bin/clang -C link-arg=-fuse-ld=lld"
GOAMD64="v3"

LC_MESSAGES=C.UTF-8
```

`CPU_FLAGS_X86` — пересечение live-выводов `cpuid2cpuflags` Broadwell VM
и Alder Lake workstation. Workstation-only `avx_vnni`, `sha` и `vpclmulqdq`
исключены. После изменения Portage запросил ожидаемые пересборки
`dev-libs/nettle`, `dev-libs/libgcrypt` и `dev-libs/json-c`; они завершены.

`LLVM_TARGETS="X86"` намеренно не сохранён: Gentoo profile принудительно
задаёт поддерживаемый набор LLVM targets. Глобальный Rust `opt-level=3`
не принят. Отдельный `GOMAXPROCS` не задаётся: если переменная не задана, Go eclass Gentoo
выводит её из числа Make jobs. Cache/ccache/sccache policy для builder
не принята.

## Repositories и совместимость package policy

Portage видит и успешно синхронизирует `gentoo`, `guru`, `gentoo-zh`,
`noctalia-overlay` и `zed-overlay`. Все repository directories присутствуют;
четыре overlay — git repositories. `dev-vcs/git` установлен как необходимая
bootstrap dependency для git-based overlays.

На builder перенесены и проверены global target USE policy,
`VIDEO_CARDS="intel zink"`, `INPUT_DEVICES="libinput"`, relevant
`/etc/portage/package.use`, `/etc/portage/package.accept_keywords`, Waydroid
mask, license policy, repositories и userspace package policy.
`@world` workstation не копировался.

Сохранён intentional GCC/BFD fallback для `sys-devel/binutils` и
`x11-libs/pango`. Builder variant использует `-march=x86-64-v3` вместо
workstation `-march=alderlake`: это принятая package/toolchain policy,
а не временное bootstrap-исключение.

Архитектурные границы — в
[плане binary build host](../asus-b5402/system/boot-and-portage/#gentoo-binary-build-host--план).
Workstation сохраняет Alder Lake optimization и локальную сборку ядра.
Builder использует portable `x86-64-v3`; userspace targets `-march=native`,
`-march=broadwell` и `-march=alderlake` не используются.

Не переносились workstation execution-only/local settings: P-core/taskset,
workstation `MAKEOPTS`, tmpdir/cache paths, `kernel-llvm`, kernel build
policy, Secure Boot private key/cert paths и Alder Lake CPU flags.
Builder имеет собственный `MAKEOPTS="-j16 -l10"` под ресурсы VM.

При первичной конвергенции потребовались временные разрывы USE dependency
cycles, переустановка `net-dns/libidn2` и пересборка Perl со свежей Clang
metadata. Все bootstrap overrides удалены; решения и проверки вынесены в
[troubleshooting перехода stage3 → Clang/ThinLTO](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/).

## Следующий шаг: установка VM до first boot

Продолжить base VM installation/configuration: `/etc/fstab`, hostname,
networking, users/SSH, kernel и bootloader. Затем выполнить first boot
и guest-side validation. Эти этапы ещё не завершены.

Private binhost, end-to-end binpkg pilot и проверка fallback при server
ON/OFF следуют после получения нормально загружающейся и проверенной VM.

## Verification

Stage3/no-multilib и отдельные toolchain проверки выполнены владельцем
2026-10-08; repository/package policy и full convergence подтверждены
2026-10-09. Ниже — команды для сверки состояния;
при обновлении документации они не запускались на живой VM.

В installer/live environment:

```bash
lscpu
lsblk -o NAME,SIZE,MODEL,FSTYPE,LABEL,MOUNTPOINTS
swapon --show
findmnt /mnt/gentoo
free -h
```

Подтверждены CPU model Broadwell-EP, доступная ext4 root, active swap 8 GiB
и примерно 16 GiB RAM. Вывод glibc loader внутри VM:

```text
x86-64-v4
x86-64-v3 (supported, searched)
x86-64-v2 (supported, searched)
```

В chroot:

```bash
cat /etc/gentoo-release
readlink -f /etc/portage/make.profile
mountpoint /proc
mountpoint /sys
mountpoint /dev
mountpoint /run
getent hosts distfiles.gentoo.org
cat /etc/portage/make.conf
portageq envvar COMMON_FLAGS CFLAGS CXXFLAGS FCFLAGS FFLAGS
eselect profile show
portageq envvar ABI_X86
gcc -print-multi-lib
emerge --pretend --verbose --update --deep --newuse --complete-graph @world
```

Release — `Gentoo Base System release 2.18`; активный профиль —
`default/linux/amd64/23.0/no-multilib/hardened/systemd`.
Все четыре mountpoint checks и DNS lookup — PASS. При no-multilib bootstrap
Portage показывал `-march=x86-64-v3 -O2 -pipe` для пяти переменных;
текущие C/C++ и Fortran flags разделены, как указано выше. `ABI_X86=64`,
`gcc -print-multi-lib` выводит только `.;`.

### Production C/C++

LLVM, Clang, LLD и `llvm-config` — 22.1.8; `llvm-ar`, `llvm-nm` и
`llvm-ranlib` установлены и функционально проверены. Реальная C-программа
скомпилирована и успешно запущена с `/usr/lib/llvm/22/bin/clang`,
`-march=x86-64-v3 -O2 -fuse-ld=lld`. Проверка `clang -###` подтвердила
фактический linker `/usr/lib/llvm/22/bin/ld.lld`. Затем ThinLTO принят
в production policy; реальная Portage-пересборка с новой compiler policy
завершилась успешно.

### CPU flags

Live `cpuid2cpuflags`:

Builder Broadwell VM:

```text
aes avx avx2 bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sse sse2 sse3 sse4_1 sse4_2 ssse3
```

Workstation Alder Lake:

```text
aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq
```

### Rust

```text
rustc 1.97.1 (8bab26f4f 2026-07-14)
host: x86_64-unknown-linux-gnu
embedded LLVM: 22.1.6
```

`rustc -C target-cpu=help` подтвердил `x86-64`, `x86-64-v2`, `x86-64-v3`
и `x86-64-v4`. Реальный Rust binary с принятой `RUSTFLAGS` policy
скомпилирован и успешно запущен. `rustc --print cfg -C target-cpu=x86-64-v3`
подтвердил v3 feature baseline: AVX, AVX2, BMI1/2, F16C, FMA, POPCNT,
SSE4.1/4.2 и связанные features.

Bundled LLVM 22.1.6 в `dev-lang/rust-bin` используется для Rust codegen;
system LLVM/Clang/LLD 22.1.8 — для внешнего linking. Разница версий
не является конфликтом.

### Go

```text
go version go1.27.1-X:nodwarf5 linux/amd64
```

Go environment подтвердил `GOARCH=amd64`, `GOAMD64=v3`. Реальный Go binary
скомпилирован и успешно запущен; `go version -m` записал в нём
`GOARCH=amd64` и `GOAMD64=v3`. Простой pure-Go test binary статически
слинкован; это ожидаемый результат теста, а не требование ко всем Go packages.

### Итоговый resolver

После bootstrap fixes успешно завершилась полная пересборка:

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

Команда приведена для root внутри installer chroot, где `doas`
не требуется. Повторный resolver:

```text
Calculating dependencies ... done!
Dependency resolution took 7.27 s (backtrack: 0/20).

Total: 0 packages, Size of downloads: 0 KiB

Nothing to merge; quitting.
```

Это acceptance gate текущего этапа: repository contract, синхронизация
package policy и initial full convergence/rebuild — CLOSED / PASS.
Чистый resolver не подтверждает завершённую установку VM, guest-side
runtime validation или работающий binhost.
