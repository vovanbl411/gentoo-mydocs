---
title: Gentoo Builder VM — gentoo-builder-01
kind: system
scope: system
status: current
last_verified: "2026-10-10"
verified_on: [gentoo-builder-01]
---

## Назначение

`gentoo-builder-01` — виртуальная машина Gentoo на Proxmox (`5201`, хост
`pve-01`). Она собирает бинарные пакеты для ASUS B5402, чтобы тяжёлая
компиляция не занимала ноутбук. Графическое окружение в VM не устанавливается;
машина создана вручную, без Terraform и Packer.

Пакеты собираются для `x86-64-v3`: этот набор инструкций поддерживают
и процессор сервера, и Alder Lake в ноутбуке. Portage на ноутбуке скачивает
подходящие пакеты с включённым `FEATURES=getbinpkg`. Если подходящего пакета
нет или сервер недоступен, пакет можно собрать из исходников на ноутбуке.
Самому ноутбуку доступ к builder для повседневной работы не нужен.

## Виртуальная машина и ОС

### Параметры Proxmox

| Параметр | Состояние |
|----------|-----------|
| Ресурсы | 16 ядер, 1 сокет, 16384 MiB RAM, `numa: 0` |
| Процессор | `cpu: host`; гость видит Intel Xeon E5-2696 v4 (Broadwell-EP) |
| Наборы инструкций | `x86-64-v3` поддерживается внутри VM; `x86-64-v4` не поддерживается |
| Машина и прошивка | `pc-i440fx-11.0`, SeaBIOS; параметры `machine:` и `bios:` в `qm config 5201` не заданы явно |
| Порядок загрузки | `scsi0;ide2;net0` — целевой диск первым |
| Диск | Storage `vm-nvme`, 100 GiB, VirtIO SCSI Single; `discard=on`, `iothread=1`, `ssd=1` |
| Сеть | VirtIO, bridge `vmbr0`, VLAN `20`, `firewall=1` |
| Guest Agent и метки | `agent: 1`; метки `build`, `gentoo` |

Разметка диска `/dev/sda` — GPT:

| Раздел | Размер | Назначение |
|--------|--------|------------|
| `/dev/sda1` | 1 MiB | Загрузка BIOS, `bios_grub`, без файловой системы |
| `/dev/sda2` | 8 GiB | Swap, метка `gentoo-swap` |
| `/dev/sda3` | Около 92 GiB | Корень `/`, ext4, метка `gentoo-root` |

LVM, Btrfs и отдельного `/boot` нет. Тонкое выделение места обеспечивает
хранилище Proxmox.

### Система и доступ

| Параметр | Состояние |
|----------|-----------|
| Профиль | `default/linux/amd64/23.0/no-multilib/hardened/systemd` |
| Имя, время и локаль | `gentoo-builder-01`; UTC; `C.UTF-8` |
| Пользователь и права | `vladimir` в `wheel`; doas установлен; `/etc/doas.conf`: `permit persist :wheel` |
| Сеть | systemd-networkd + systemd-resolved; интерфейс `ens18`, DHCPv4 |
| DNS resolver | `/etc/resolv.conf` — символическая ссылка на stub resolver systemd-resolved |
| DNS-имя builder | `gentoo-builder-01.home.9fans.uk` → `10.1.20.99` |
| SSH | OpenSSH, вход под пользователем `vladimir` |
| QEMU Guest Agent | `qemu-guest-agent`; служба запускается при появлении устройства guest agent |

## Настройки сборки

Профиль no-multilib собирает только 64-битные пакеты:
`CHOST=x86_64-pc-linux-gnu`, `ABI_X86=64`.

Для C/C++ используются Clang, линкер LLD, оптимизация `-O2` и ThinLTO.
`llvm-ar`, `llvm-nm` и `llvm-ranlib` нужны для работы с объектными файлами LLVM.
Fortran использует отдельные флаги без ThinLTO.

Файл: `/etc/portage/make.conf`. Путь к Clang в `RUSTFLAGS` и `LLVM_SLOT`
должны указывать на один установленный слот LLVM:

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

`CPU_FLAGS_X86` содержит только инструкции, поддерживаемые и Broadwell
в VM, и Alder Lake в ноутбуке. Дополнительные инструкции ноутбука
`avx_vnni`, `sha` и `vpclmulqdq` исключены. Не используй `-march=native`
или `-march=broadwell` для этих пакетов: целью сборки является общий
`x86-64-v3`, а не процессор builder.

Rust устанавливается пакетом `dev-lang/rust-bin`. Он использует встроенный
LLVM для генерации кода, а системный Clang/LLD — для линковки. Их версии могут
различаться. Глобальный `opt-level=3` для Rust не задан.

Go использует `GOARCH=amd64`, `GOAMD64=v3`. Отдельный `GOMAXPROCS` не нужен:
Gentoo eclass выводит его из числа заданий Make. Способ линковки зависит
от конкретного Go-пакета.

Python targets выбирает профиль. Посмотреть их значения можно командой:

```bash
portageq envvar PYTHON_SINGLE_TARGET PYTHON_TARGETS
```

`LLVM_TARGETS="X86"` не задаётся: поддерживаемый набор LLVM targets определяет
профиль Gentoo. Сборка не требует ccache или sccache.

> **Важно:** Clang и LLD используются как инструменты сборки. Системные
> библиотеки и GNU runtime при этом не заменяются.

## Репозитории и совместимость пакетов

Репозиторий Gentoo синхронизируется через rsync. Дополнительные репозитории
`guru`, `gentoo-zh`, `noctalia-overlay` и `zed-overlay` используют Git,
поэтому на builder установлен `dev-vcs/git`. Список подключённых репозиториев
хранится в `/etc/portage/repos.conf/`; при добавлении нового overlay на
ноутбуке подключи его и на builder, если пакет должен собираться там.

Для совместимости бинарных пакетов на двух машинах согласуются USE-флаги,
`VIDEO_CARDS`, `INPUT_DEVICES`, правила `/etc/portage/package.use/`,
`package.accept_keywords/`, маски пакетов и разрешённые лицензии.
Список `@world` ноутбука целиком не копируется: builder имеет собственный
набор установленных пакетов.

Для `sys-devel/binutils` и `x11-libs/pango` сохранены отдельные настройки
сборки через GCC/BFD. Основная сборка использует Clang/LLD, а целевая
архитектура builder — `x86-64-v3`.

Параллелизм, временные каталоги и кэши подбираются под ресурсы VM. Настройки
ноутбука с привязкой к P-ядрам и `taskset` на builder не переносятся.

Проблемы перехода со stage3 на Clang/ThinLTO и способы их решения описаны
в [отдельном руководстве](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/).

<span id="first-boot-и-guest-runtime--pass"></span>

## Загрузка и службы

Для самой VM используется BIOS-загрузка: SeaBIOS, GPT и GRUB с target
`i386-pc`, без Secure Boot. Ядро устанавливается пакетом
`sys-kernel/gentoo-kernel-bin`, initramfs создаёт Dracut. Эта схема загрузки
отличается от systemd-boot и UKI на ноутбуке.

Глобальный USE содержит `secureboot`, поэтому для BIOS-загрузки VM нужны
отдельные настройки пакетов.
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

Вспомогательные программы `gentoo-kernel-bin` собираются без LTO с линкером
BFD: прямой вызов `ld.bfd` в этом пакете не может обработать ThinLTO-объекты.
Остальные пакеты продолжают использовать Clang, ThinLTO и LLD. Настройка
исключения описана в
[troubleshooting kernel helpers](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/#6-gentoo-kernel-bin-thinlto-объекты-и-прямой-вызов-ldbfd).

Отсутствие ответа шлюза на ICMP ping не мешает работе маршрутизации:
проверяй доступ к нужным адресам и разрешение DNS. Правила firewall шлюза
ведутся в проекте home-server.

Служба QEMU Guest Agent может отображаться как `static`: её запуск связан
с устройством guest agent, поэтому отдельно включать её через `enable`
не требуется. Работу службы проверяй через `systemctl is-active`.
Если systemd-networkd не получает адрес из-за неверного machine-id,
см. [разбор DHCP](../../troubleshooting/systemd-networkd-dhcp-machine-id/).

## Раздача бинарных пакетов

Пакеты из `/var/cache/binpkgs` раздаются по HTTP с `10.1.20.99:8080`.
Caddy на `proxy-01` принимает HTTPS-запросы к
`https://binhost.apps.home.9fans.uk` и передаёт их на этот HTTP-сервер.

| Параметр | Текущее состояние |
|----------|-------------------|
| Создание пакетов | `FEATURES` содержит `buildpkg`; `BINPKG_FORMAT=gpkg`; `PKGDIR=/var/cache/binpkgs` |
| HTTP-служба | `/etc/systemd/system/gentoo-binhost.service`; Python HTTP server раздаёт `/var/cache/binpkgs` и слушает `10.1.20.99:8080`; служба включена в автозапуск |
| Внутренние адреса | `http://10.1.20.99:8080`, `http://gentoo-builder-01.home.9fans.uk:8080` |
| Адрес для клиента | `https://binhost.apps.home.9fans.uk`; Caddy upstream — `http://gentoo-builder-01.home.9fans.uk:8080` |
| TLS | HTTPS обслуживает Caddy на `proxy-01`; на builder используется HTTP |
| Подписи пакетов | Репозиторий без подписей; у клиента задано `verify-signature = false` |

Каталог `/var/cache/binpkgs` содержит пакеты GPKG и индекс `Packages`.
Portage на ноутбуке использует репозиторий `gentoo-builder`; официальный
бинарный репозиторий Gentoo отключён, но обычное дерево ebuild Gentoo
остаётся источником пакетов для сборки.

`FEATURES=getbinpkg` позволяет обычному `emerge` выбирать совместимые бинарные
пакеты без дополнительного `-g`. Если подходящего пакета нет, разрешена
локальная сборка из исходников. Настройка клиента, просмотр плана обновления
и диагностика скачивания описаны в
[разделе Portage на ноутбуке](../asus-b5402/system/boot-and-portage/#private-binrepo-на-workstation).

## Порядок обновления

Дерево `/var/db/repos/gentoo` синхронизируется через rsync с
`FEATURES=usersync`. Его владелец — `portage:portage`. Если часть дерева
принадлежит другому пользователю, rsync может завершаться ошибкой при очистке
quarantine или применении обновления. Диагностика и исправление — в
[руководстве по usersync](../../troubleshooting/portage-usersync-repository-ownership/).

Обновление выполняется вручную, сначала на builder:

1. Синхронизируй репозиторий Gentoo и нужные overlays.
2. Просмотри план обновления `@world` и устрани конфликты.
3. Обнови `@world`. С включённым `FEATURES=buildpkg` Portage создаёт GPKG
   для собранных пакетов.
4. После успешного обновления builder синхронизируй репозитории и обнови
   `@world` на ноутбуке. Подходящие бинарные пакеты будут скачаны автоматически,
   остальные соберутся из исходников.

Если сборка на builder завершилась ошибкой, сначала разбери причину и только
затем продолжай обычное обновление ноутбука. Для срочного независимого
обновления можно собрать нужный пакет локально. Обновление по расписанию
не настроено; репозитории синхронизируются без фиксации на общем снимке.
Команды и настройки клиента — в
[описании обновления ноутбука](../asus-b5402/system/boot-and-portage/#ручной-update-builder-first--pass--workstation).

## Проверка работы

### Профиль и параметры сборки

```bash
eselect profile show
portageq envvar ABI_X86
portageq envvar COMMON_FLAGS CFLAGS CXXFLAGS FCFLAGS FFLAGS
emerge --pretend --verbose --update --deep --newuse --complete-graph @world
```

Профиль должен быть no-multilib/hardened/systemd, `ABI_X86` — `64`, а флаги —
соответствовать разделу настроек сборки. У Fortran нет `-flto=thin`.
План Portage показывает доступные обновления и требуемые изменения USE.
Если обновлений нет, в итоге будет `Total: 0 packages`.

### Загрузка, диски и сеть

```bash
uname -r
findmnt /
swapon --show
networkctl status ens18
resolvectl status ens18
systemctl is-active systemd-networkd systemd-resolved sshd qemu-guest-agent
```

Корень должен быть смонтирован с ext4-раздела, swap — включён.
Для `ens18` ожидается полученный адрес и состояние `routable (configured)`;
`resolvectl` показывает DNS-серверы, а службы должны отвечать `active`.

### Сервер пакетов

На builder:

```bash
systemctl is-active gentoo-binhost.service
systemctl is-enabled gentoo-binhost.service
portageq envvar FEATURES BINPKG_FORMAT PKGDIR
```

Для HTTP-службы ожидаются `active` и `enabled`, в `FEATURES` — `buildpkg`,
формат пакетов — `gpkg`, каталог — `/var/cache/binpkgs`.
С ноутбука проверь доступность индекса пакетов:

```bash
curl -I http://10.1.20.99:8080/Packages
curl -I https://binhost.apps.home.9fans.uk/Packages
```

Оба адреса должны вернуть HTTP 200. Выбор бинарного пакета в плане Portage
проверяется по [инструкции для ноутбука](../asus-b5402/system/boot-and-portage/#private-binrepo-на-workstation).

## Связанные документы

- [Ручная установка Gentoo](../../installation/gentoo-installation/).
- [Stage3 → Clang/ThinLTO troubleshooting](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/).
- [systemd-networkd и machine-id](../../troubleshooting/systemd-networkd-dhcp-machine-id/).
- [Сравнение `-march=alderlake` и `-march=x86-64-v3`](../../experiments/compiler-optimization/alderlake-vs-x86-64-v3/) — почему для общих бинарных пакетов выбран V3.
- [Загрузка, Portage и обновление ноутбука](../asus-b5402/system/boot-and-portage/#gentoo-binary-build-host--production).
