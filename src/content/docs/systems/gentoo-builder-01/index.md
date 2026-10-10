---
title: Gentoo Builder VM — gentoo-builder-01
kind: system
scope: system
status: current
last_verified: "2026-10-10"
verified_on: [gentoo-builder-01]
---

## Current state

`gentoo-builder-01` — отдельная headless Gentoo VM на Proxmox: VMID `5201`,
host `pve-01`. Она собирает portable `x86-64-v3` userspace GPKG для ASUS B5402
и работает как replaceable build appliance. VM создана вручную;
Terraform/Packer не используются, desktop/UI не устанавливается.

Workstation автоматически использует совместимые private packages через
обычный Portage с `FEATURES=getbinpkg`. При отсутствии или несовместимости
пакета либо недоступности binhost доступна локальная source build
с Alder Lake policy. Workstation не зависит от доступности builder для работы.
Ядро workstation остаётся local-only.

## VM и OS

### Proxmox VM

| Параметр | Состояние |
|----------|-----------|
| Ресурсы | 16 cores, 1 socket, 16384 MiB RAM, `numa: 0` |
| CPU exposure | `cpu: host`; гость видит Intel Xeon E5-2696 v4 (Broadwell-EP) |
| ISA capability | `x86-64-v3` поддерживается внутри VM; `x86-64-v4` не поддерживается |
| Machine / firmware | В `qm config 5201` нет явных `machine:` / `bios:`; фактические defaults в guest — `pc-i440fx-11.0`, SeaBIOS |
| Boot order | `scsi0;ide2;net0` — целевой диск первым |
| Диск | Storage `vm-nvme`, 100 GiB, VirtIO SCSI Single; `discard=on`, `iothread=1`, `ssd=1` |
| Сеть | VirtIO, bridge `vmbr0`, VLAN `20`, `firewall=1` |
| Guest Agent / tags | `agent: 1`; tags `build`, `gentoo` |

Диск `/dev/sda` имеет GPT layout:

| Раздел | Размер | Назначение |
|--------|--------|------------|
| `/dev/sda1` | 1 MiB | BIOS boot, `bios_grub`, без filesystem |
| `/dev/sda2` | 8 GiB | Active swap, LABEL `gentoo-swap` |
| `/dev/sda3` | Около 92 GiB | ext4 root `/`, LABEL `gentoo-root` |

LVM, Btrfs и отдельного `/boot` нет; thin provisioning предоставляет
Proxmox storage layer.

### Guest OS и доступ

| Параметр | Состояние |
|----------|-----------|
| Release | Gentoo Base System release 2.18 |
| Профиль | `default/linux/amd64/23.0/no-multilib/hardened/systemd` |
| Identity / time / locale | Hostname `gentoo-builder-01`; UTC; `C.UTF-8` |
| User / privileges | `vladimir` в `wheel`; doas установлен; `/etc/doas.conf`: `permit persist :wheel` |
| Network | systemd-networkd + systemd-resolved; `ens18`, DHCPv4; `routable (configured)` / `online`, default route, external IPv4 и DNS работают |
| Resolver | `/etc/resolv.conf` — symlink на systemd-resolved stub |
| Builder DNS | `gentoo-builder-01.home.9fans.uk` → `10.1.20.99` |
| SSH | OpenSSH enabled/running; реальный login как `vladimir` подтверждён |
| QEMU Guest Agent | ACTIVE после boot; service `static`, в journal наблюдаются `guest-ping` |

## Build policy

Profile/ABI contract: `CHOST=x86_64-pc-linux-gnu`, `ABI_X86=64`.
GCC multilib list содержит только `.;`.

C/C++ используют LLVM/Clang/LLD и `llvm-config` 22.1.8, `-O2` и ThinLTO;
`llvm-ar`, `llvm-nm`, `llvm-ranlib` установлены и проверены.
Fortran использует отдельные флаги без ThinLTO.

Файл: `/etc/portage/make.conf`. Явно заданные значения production policy:

```makefile
LLVM_SLOT="22"
VIDEO_CARDS="intel zink"
INPUT_DEVICES="libinput"
GRUB_PLATFORMS="pc"

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
исключены. Userspace targets `-march=native`, `-march=broadwell` и
`-march=alderlake` на builder не используются.

Rust `dev-lang/rust-bin` 1.97.1 (`host: x86_64-unknown-linux-gnu`)
использует bundled LLVM 22.1.6 для codegen и system Clang/LLD 22.1.8
для внешнего linking; разница версий не является
конфликтом. Глобальный Rust `opt-level=3` не принят.
Go 1.27.1 (`go1.27.1-X:nodwarf5 linux/amd64`) использует `GOARCH=amd64`,
`GOAMD64=v3`. Отдельный `GOMAXPROCS` не задаётся: Go eclass Gentoo выводит
его из числа Make jobs. Статическая линковка простого pure-Go test binary
не является требованием ко всем Go packages.

Effective Python targets из profile policy, а не явных строк `make.conf`:

```text
PYTHON_SINGLE_TARGET="python3_14"
PYTHON_TARGETS="python3_14"
```

`LLVM_TARGETS="X86"` намеренно не задан: Gentoo profile принудительно
задаёт поддерживаемый набор LLVM targets. Cache/ccache/sccache policy
для builder не принята.

> **Важно:** GNU runtime ABI сохраняется; это не миграция libc/libgcc.

## Repositories и совместимость package policy

Portage использует и успешно синхронизирует `gentoo`, `guru`, `gentoo-zh`,
`noctalia-overlay` и `zed-overlay`. Четыре overlay — git repositories;
для них установлен `dev-vcs/git`.

С workstation согласованы global target USE policy, `VIDEO_CARDS`,
`INPUT_DEVICES`, relevant `/etc/portage/package.use`,
`/etc/portage/package.accept_keywords`, Waydroid mask, license policy,
repositories и userspace package policy. `@world` workstation не копировался.

Intentional GCC/BFD fallback для `sys-devel/binutils` и `x11-libs/pango`
сохранён как текущая package/toolchain policy. Builder variant использует
`-march=x86-64-v3` вместо workstation `-march=alderlake`.

Workstation сохраняет Alder Lake optimization и локальную сборку ядра.
На builder не перенесены P-core/taskset, workstation `MAKEOPTS`,
tmpdir/cache paths, `kernel-llvm`, kernel build policy, Secure Boot private
key/cert paths и Alder Lake CPU flags. Builder имеет собственный
`MAKEOPTS` под ресурсы VM.

Временные bootstrap overrides удалены. История перехода и dependency cycles —
в [troubleshooting stage3 → Clang/ThinLTO](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/).

## Загрузка и runtime

Builder загружается с целевого диска через SeaBIOS + GRUB `pc`, BIOS/GPT,
target `i386-pc`, без Secure Boot. Установлены
`sys-boot/grub-2.14-r5` и stable `sys-kernel/gentoo-kernel-bin-6.18.54`;
running kernel — `6.18.54-gentoo-dist-bin`. Dracut initramfs существует
и успешно загружается; переход к workstation kernel `7.2.9` не требуется.

Постоянные builder-specific overrides адаптируют global USE policy,
содержащую `secureboot`, к этому boot path.
Файл: `/etc/portage/package.use`:

```text
sys-boot/grub -secureboot
sys-kernel/installkernel dracut grub
```

Файл: `/usr/lib/kernel/install.conf` (конфигурация установленного installkernel):

```ini
layout=grub
initrd_generator=dracut
uki_generator=none
```

Для helper preparation `gentoo-kernel-bin` действует package-specific
no-LTO/BFD path; userspace сохраняет Clang + ThinLTO + LLD.
Причина исключения — в
[troubleshooting kernel helpers](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/#6-gentoo-kernel-bin-thinlto-объекты-и-прямой-вызов-ldbfd).

`findmnt --verify --verbose` показал 0 errors/warnings.
Gateway не отвечает на прямой ICMP ping, при этом routing через него,
external IPv4 и DNS работают; home-server firewall policy ведётся отдельно.
`static` state QEMU Guest Agent при ACTIVE runtime и наблюдаемых `guest-ping`
является штатным состоянием.
Диагностика DHCP при невалидном machine-id — в
[networkd troubleshooting](../../troubleshooting/systemd-networkd-dhcp-machine-id/).

## Путь binary packages

Builder `/var/cache/binpkgs` → internal HTTP `10.1.20.99:8080` →
`proxy-01` / Caddy → `https://binhost.apps.home.9fans.uk` → workstation Portage.

| Параметр | Текущее состояние |
|----------|-------------------|
| Portage binpkg policy | `FEATURES` содержит `buildpkg`; `BINPKG_FORMAT=gpkg`; `PKGDIR=/var/cache/binpkgs` |
| HTTP service | `/etc/systemd/system/gentoo-binhost.service`, enabled/active; Python 3 HTTP server раздаёт `/var/cache/binpkgs` и слушает `10.1.20.99:8080` |
| Internal endpoints | `http://10.1.20.99:8080`, `http://gentoo-builder-01.home.9fans.uk:8080` |
| Canonical endpoint | `https://binhost.apps.home.9fans.uk`; Caddy upstream — `http://gentoo-builder-01.home.9fans.uk:8080` |
| TLS | Termination на `proxy-01` / Caddy; TLS на builder не поднимается |
| Signing | Private repo unsigned; `verify-signature = false` — принятое текущее состояние |

На builder успешно собраны GPKG для `app-arch/zstd-1.5.7-r1`,
`dev-libs/openssl-3.5.8` и `media-libs/mesa-26.2.4`; индекс `Packages` существует.
С workstation internal `Packages` по IP и FQDN возвращал HTTP 200
(`SimpleHTTP/0.6 Python/3.14.7`), canonical endpoint — HTTP/2 200
с `via: 1.0 Caddy`.

Workstation использует единственный active remote binrepo `gentoo-builder`;
official Gentoo binary repo inactive, Gentoo ebuild repository остаётся
source repository. Private zstd установлен как binary merge без локальной
компиляции, обычный pretend без `-g` выбирает private binary package.
Конфигурация и подробности automatic consumption, pretend/fetch/install —
в [workstation Portage](../asus-b5402/system/boot-and-portage/#private-binrepo-на-workstation).

При недоступном binhost и отсутствии cached GPKG Portage после HTTP 502
действительно перешёл в source build path: проверены manifests и подпись
source archive, source распакован в `PORTAGE_TMPDIR`. Тест остановлен Ctrl+C
после доказательства fallback path; **полный source rebuild/merge не подтверждён**.
Подробности — на странице workstation Portage выше.

## Routine operation

Обновление выполняется вручную: sync Gentoo repositories / overlays,
resolve и update `@world` на builder; `buildpkg` создаёт новые GPKG.
Только после успешного update builder выполняются sync и обычный update
`@world` на workstation. Подходящие private GPKG используются автоматически,
остальное собирается локально из source.

Если update builder завершился с ошибкой, routine update workstation
не продолжается до разбора причины. Scheduled update не используется; exact repository snapshot pinning
не реализован. Срочное независимое обновление workstation возможно через
local source build. Подробная operational policy — в
[workstation Portage](../asus-b5402/system/boot-and-portage/#ручной-update-builder-first--pass--workstation).

## Known limitations

SSH public-key login и key-only access остаются pending verification.
Успешный обычный SSH login не доказывает key-only configuration.

## Verification

Даты уже выполненных владельцем проверок:

- 2026-10-08 — stage3/no-multilib и отдельные toolchain проверки;
- 2026-10-09 — repository/package policy, полная пересборка и чистый resolver,
  installation/first boot/runtime;
- 2026-10-10 — local GPKG production, binhost и workstation integration,
  automatic consumption и вход в source fallback path.

Ниже — команды для сверки работающего guest. При этой правке документа
они не запускались на живой VM; даты относятся к ранее выполненным проверкам.

### Profile, ABI и effective flags

```bash
eselect profile show
portageq envvar ABI_X86
portageq envvar COMMON_FLAGS CFLAGS CXXFLAGS FCFLAGS FFLAGS
emerge --pretend --verbose --update --deep --newuse --complete-graph @world
```

Флаги должны соответствовать Build policy выше; C/C++ и Fortran различаются.
Записанный итог resolver после полной пересборки — `Total: 0 packages, Size of downloads: 0 KiB`.
Он сам по себе не подтверждает boot/runtime или binhost.

### Kernel, storage и runtime

```bash
uname -r
findmnt /
swapon --show
networkctl status ens18
resolvectl status ens18
systemctl is-active systemd-networkd systemd-resolved sshd qemu-guest-agent
```

Ожидаются kernel/root/swap из разделов выше, networkd `routable (configured)` /
`online`, работающие DNS и services. Эти проверки не подтверждают SSH key-only.

### Binhost

На builder:

```bash
systemctl is-active gentoo-binhost.service
systemctl is-enabled gentoo-binhost.service
portageq envvar FEATURES BINPKG_FORMAT PKGDIR
```

Ожидаются active/enabled и binpkg policy из таблицы выше. С workstation:

```bash
curl -I http://10.1.20.99:8080/Packages
curl -I https://binhost.apps.home.9fans.uk/Packages
```

Ожидается HTTP 200. Проверка binary resolution и поведения Portage на workstation —
в [private binrepo workflow](../asus-b5402/system/boot-and-portage/#private-binrepo-на-workstation).

## Related docs

- [Ручная установка Gentoo](../../installation/gentoo-installation/).
- [Stage3 → Clang/ThinLTO troubleshooting](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/).
- [systemd-networkd и machine-id](../../troubleshooting/systemd-networkd-dhcp-machine-id/).
- [ASUS B5402 CPU optimization / V3 comparison](../asus-b5402/hardware/cpu-optimization/#empirical-validation--marchalderlake-vs--marchx86-64-v3): сравнение 2026-10-10 не выявило практически значимой регрессии V3 в протестированных workload; методика и ограничения — по ссылке.
- [Workstation boot/Portage и production workflow](../asus-b5402/system/boot-and-portage/#gentoo-binary-build-host--production).
