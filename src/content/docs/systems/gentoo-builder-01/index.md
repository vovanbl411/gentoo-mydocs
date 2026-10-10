---
title: Gentoo Builder VM — gentoo-builder-01
kind: system
scope: system
status: current
last_verified: "2026-10-10"
verified_on: [gentoo-builder-01]
---

## Current state

**Base VM installation и first boot — CLOSED / PASS на 2026-10-09.**
VM загружается с целевого диска и работает как Gentoo hardened/systemd guest.
Package/toolchain/package-policy этапы также остаются CLOSED / PASS.

`gentoo-builder-01` — отдельная headless VM на домашнем Proxmox для
сборки portable userspace binpkgs (`.gpkg`) для ASUS B5402. Это replaceable
build appliance: она должна разгружать workstation, сохраняя её независимость
от сервера. VM создана вручную, Terraform/Packer не используются;
desktop/UI не устанавливается. SSH и network services включены для работы
guest; internal HTTP binhost service enabled/active.

**Internal HTTP binhost backend — PASS по evidence владельца 2026-10-10.**
Builder раздаёт `/var/cache/binpkgs` на `10.1.20.99:8080`; запросы к
`Packages` с workstation по IP и FQDN возвращают HTTP 200. Это backend
для существующего `proxy-01` / Caddy: TLS и canonical client-facing endpoint
остаются на `proxy-01`.

По проверкам владельца завершены:

- no-multilib bootstrap — PASS;
- production LLVM/Clang/LLD portable toolchain — PASS;
- repository contract — PASS;
- синхронизация workstation-compatible userspace package policy — PASS;
- initial full policy convergence/rebuild после stage3 — PASS;
- base installation, kernel/GRUB и first boot — PASS;
- persistent networking/DNS, реальный SSH login и QEMU Guest Agent — PASS;
- local binpkg production — PASS: успешно собраны GPKG для
  `app-arch/zstd-1.5.7-r1`, `dev-libs/openssl-3.5.8` и
  `media-libs/mesa-26.2.4`; индекс `Packages` создан при первом zstd pilot;
- empirical comparison portable V3 vs Alder Lake завершён 2026-10-10:
  практически значимой регрессии V3 в протестированных workload не обнаружено.
  Методика, результаты и ограничения — в
  [CPU optimization workstation](../asus-b5402/hardware/cpu-optimization/#empirical-validation--marchalderlake-vs--marchx86-64-v3).

Финальный `@world` resolver: `Total: 0 packages, Size of downloads: 0 KiB`.
Временные bootstrap overrides удалены. C/C++ используют LLVM/Clang/LLD
22.1.8, `x86-64-v3`, `-O2` и ThinLTO; Fortran сохраняет `-O2` без ThinLTO.
Rust 1.97.1 использует portable CPU target, Go 1.27.1 — `GOAMD64=v3`.

Следующий шаг — настроить и проверить SSH public-key login и key-only
access. HTTPS ingress через `binhost.apps.home.9fans.uk`, Portage
`binrepos.conf` на workstation, end-to-end установка из private binhost
и server ON/OFF fallback acceptance остаются pending. Ядро workstation
остаётся local-only.

| Параметр | Подтверждённое состояние |
|----------|--------------------------|
| VM | `gentoo-builder-01`, VMID `5201`, host `pve-01` |
| Ресурсы | 16 cores, 1 socket, 16384 MiB RAM, NUMA отключена |
| CPU | Proxmox `host`; гость видит Intel Xeon E5-2696 v4 (Broadwell-EP) |
| ISA capability | `x86-64-v3` подтверждена внутри VM; `x86-64-v4` не поддерживается |
| Диск | 100 GiB, GPT; 1 MiB BIOS boot, 8 GiB active swap, около 92 GiB ext4 root |
| Install state | Установка завершена; first boot с целевого диска — PASS; работающий Gentoo guest |
| Release | Gentoo Base System release 2.18 |
| Активный профиль | `default/linux/amd64/23.0/no-multilib/hardened/systemd` |
| Build target / ABI | C/C++ `-march=x86-64-v3 -O2 -flto=thin -pipe`; `ABI_X86=64`; GCC multilib list — только `.;` |
| Rebuild / resolver | Полная пересборка под финальной package/toolchain policy завершена; final resolver — `Total: 0 packages, Size of downloads: 0 KiB` |
| Production toolchain | LLVM/Clang/LLD и `llvm-config` 22.1.8; `llvm-ar`, `llvm-nm`, `llvm-ranlib` проверены |
| Параллельная сборка | `MAKEOPTS="-j16 -l10"` |
| Rust | 1.97.1; `target-cpu=x86-64-v3`, внешний Clang/LLD для linking |
| Go | 1.27.1; `GOAMD64=v3` |
| Kernel / GRUB | `6.18.54-gentoo-dist-bin` (`sys-kernel/gentoo-kernel-bin-6.18.54`); `sys-boot/grub-2.14-r5`, BIOS/GPT, target `i386-pc` |
| Initramfs | Dracut initramfs существует и успешно загружается |
| Root / swap / fstab | `/dev/sda3`, ext4, LABEL `gentoo-root`; `/dev/sda2`, 8 GiB, LABEL `gentoo-swap`, active; `findmnt --verify --verbose` — 0 errors/warnings |
| Identity / time / locale | Hostname `gentoo-builder-01`; UTC; `C.UTF-8` |
| User / privileges | `vladimir` в `wheel`; doas установлен, `/etc/doas.conf`: `permit persist :wheel` |
| Persistent network | systemd-networkd + systemd-resolved; VirtIO `ens18`, DHCPv4; `routable (configured)` / `online`; default route, external IPv4 и DNS — PASS |
| Resolver | `/etc/resolv.conf` — symlink на systemd-resolved stub |
| SSH | OpenSSH enabled/running; реальный login как `vladimir` после first boot — PASS; key-only access — pending |
| QEMU Guest Agent | ACTIVE после boot; service `static`, в journal наблюдаются реальные `guest-ping` |
| Local binpkg production | PASS: GPKG для `app-arch/zstd-1.5.7-r1`, `dev-libs/openssl-3.5.8`, `media-libs/mesa-26.2.4`; индекс `Packages` создан при первом zstd pilot |
| Binpkg policy | `FEATURES` содержит `buildpkg`; `BINPKG_FORMAT=gpkg`; `PKGDIR=/var/cache/binpkgs` |
| Builder DNS | `gentoo-builder-01.home.9fans.uk` → `10.1.20.99` |
| Internal HTTP binhost backend | PASS: `gentoo-binhost.service` enabled/active; слушает `10.1.20.99:8080`, раздаёт `/var/cache/binpkgs` |
| HTTP с workstation | `Packages` по IP и FQDN — HTTP 200; Server: `SimpleHTTP/0.6 Python/3.14.7` |
| HTTPS ingress / workstation consumption | `binhost.apps.home.9fans.uk`, `binrepos.conf`, end-to-end installation и server ON/OFF fallback — pending |

> **Важно:** GNU runtime ABI сохраняется; это не миграция libc/libgcc.

## VM baseline

Подтверждённая Proxmox configuration после подготовки:

| Параметр | Значение |
|----------|----------|
| Agent | `agent: 1`; guest agent ACTIVE, реальные `guest-ping` наблюдаются |
| Boot order | `scsi0;ide2;net0` — целевой диск первым |
| Machine / firmware | В `qm config 5201` нет явных `machine:` / `bios:`; guest runtime: `pc-i440fx-11.0`, SeaBIOS (фактические defaults) |
| CPU / RAM | `cpu: host`, `cores: 16`, `sockets: 1`, `memory: 16384`, `numa: 0` |
| Диск | Storage `vm-nvme`, 100 GiB, VirtIO SCSI Single |
| Disk options | `discard=on`, `iothread=1`, `ssd=1` |
| Сеть | VirtIO, bridge `vmbr0`, VLAN `20`, `firewall=1` |
| Tags | `build`, `gentoo` |

Установочный образ — Gentoo amd64 Minimal Installation CD; локальное имя
в Proxmox — `gentoo-hardened-systemd-minimal.iso`. ISO использован только
как installer/live environment. Загрузка live environment — BIOS / SeaBIOS,
не UEFI.

## Подготовка stage3 и bootstrap (2026-10-08)

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

Файл: `/etc/portage/make.conf`.
Явно заданные значения production policy:

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

## Загрузка и runtime

Постоянные builder-specific boot overrides в `/etc/portage/package.use`:

```text
sys-boot/grub -secureboot
sys-kernel/installkernel dracut grub
```

Они адаптируют workstation-compatible global USE policy, содержащую
`secureboot`, к принятому builder path: SeaBIOS + GRUB `pc`, без Secure Boot.
Это постоянная boot policy, а не temporary bootstrap exceptions.

Файл: `/usr/lib/kernel/install.conf` (конфигурация установленного installkernel):

```ini
layout=grub
initrd_generator=dracut
uki_generator=none
```

Builder использует выбранное stable-ядро `6.18.54`; переход к workstation
`7.2.9` не требуется. Для helper preparation `gentoo-kernel-bin` действует
package-specific no-LTO/BFD path. Userspace production policy остаётся
Clang + ThinLTO + LLD. Причина исключения — в
[troubleshooting kernel helpers](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/#6-gentoo-kernel-bin-thinlto-объекты-и-прямой-вызов-ldbfd).

При отсутствии DHCP после первого запуска причиной в этой установке оказался
невалидный `/etc/machine-id`. После его инициализации и restart networkd
появились lease, default route и DNS. Диагностика и границы решения — в
[networkd troubleshooting](../../troubleshooting/systemd-networkd-dhcp-machine-id/).

Gateway не отвечает на прямой ICMP ping, но routing через него, external
IPv4 и DNS работают. Это не failure builder network; home-server firewall
policy ведётся отдельно. QEMU Guest Agent service имеет `static` state:
при ACTIVE runtime и наблюдаемых `guest-ping` это штатное состояние.

## Internal HTTP binhost backend

Файл unit: `/etc/systemd/system/gentoo-binhost.service`.
По подтверждению владельца 2026-10-10 сервис enabled/active; штатный Python 3
HTTP server раздаёт `/var/cache/binpkgs` и слушает `10.1.20.99:8080`.
На builder `FEATURES` Portage содержит `buildpkg`; используются
`BINPKG_FORMAT=gpkg` и `PKGDIR=/var/cache/binpkgs`.

С workstation подтверждён HTTP 200 для обоих адресов `Packages`:

```bash
curl -I http://10.1.20.99:8080/Packages
curl -I http://gentoo-builder-01.home.9fans.uk:8080/Packages
```

Фактически наблюдавшийся Server header: `SimpleHTTP/0.6 Python/3.14.7`.
Эти проверки подтверждают доступность internal HTTP backend и индекса;
HTTPS ingress, настройка Portage клиента и установка binpkg ими не проверены.
TLS и canonical client-facing endpoint `binhost.apps.home.9fans.uk` должны
оставаться на существующем `proxy-01` / Caddy. Builder обслуживает backend;
HTTPS ingress через этот endpoint пока pending.

## Следующий шаг: SSH public-key / key-only access

Настроить SSH public-key login, проверить реальный вход и затем key-only
access. Текущий успешный SSH login не подтверждает key-only configuration.
Internal HTTP backend уже PASS. Остаются HTTPS ingress через
`binhost.apps.home.9fans.uk`, Portage `binrepos.conf` на workstation
и end-to-end установка из private binhost; server ON/OFF fallback acceptance
остаётся последующей проверкой.

## Verification

Stage3/no-multilib и отдельные toolchain проверки выполнены владельцем
2026-10-08; repository/package policy и full convergence подтверждены
2026-10-09. Base installation, first boot и runtime acceptance также
подтверждены владельцем 2026-10-09. Local binpkg production для zstd,
OpenSSL и Mesa и empirical comparison portable V3 vs Alder Lake подтверждены
владельцем 2026-10-10; методика и ограничения — по ссылке выше.
Internal HTTP backend, binpkg policy и HTTP 200 с workstation подтверждены
владельцем 2026-10-10 в разделе Internal HTTP binhost backend.
Ниже — команды для сверки состояния;
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
Сам по себе чистый resolver не подтверждает boot/runtime или работающий
binhost. Установка и first boot приняты отдельно по проверкам ниже.

### First boot и guest runtime — PASS

В загруженном guest:

```bash
uname -r
findmnt /
findmnt --verify --verbose
swapon --show
hostnamectl
timedatectl
locale
id vladimir
networkctl status ens18
ip -4 route
resolvectl status ens18
getent ahostsv4 gentoo.org
ping -4 -c 3 1.1.1.1
readlink /etc/resolv.conf
systemctl is-active systemd-networkd systemd-resolved sshd qemu-guest-agent
systemctl is-enabled sshd qemu-guest-agent
doas journalctl -b -u qemu-guest-agent --no-pager
```

Получены kernel `6.18.54-gentoo-dist-bin`, root ext4 на `/dev/sda3`,
active swap 8 GiB и fstab без ошибок/предупреждений. Networkd —
`routable (configured)` / `online`; DHCP default route, external IPv4
и DNS через resolved — PASS. OpenSSH enabled/running; владелец подтвердил
реальный SSH login как `vladimir`. Guest Agent ACTIVE, journal содержит
реальные `guest-ping`. Key-only SSH и end-to-end установка binpkg
на workstation этими first-boot проверками не приняты. Internal HTTP backend
подтверждён отдельно 2026-10-10, как указано выше. Local binpkg
production подтверждена отдельно, как указано в Current state.
Machine-id, MAC и root UUID в документ не включены.
