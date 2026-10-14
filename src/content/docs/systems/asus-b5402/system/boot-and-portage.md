---
title: Загрузка и Portage на ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-10"
verified_on: [asus-b5402]
---

## Сейчас

| Что | Значение |
|-----|----------|
| Ядро | `7.2.9-bdsm` — `sys-kernel/gentoo-kernel` с `savedconfig` |
| Сборка ядра | LLVM 23.1.1 (env `kernel-llvm`, пилот) |
| Основной toolchain | LLVM/Clang/LLD 22 |
| Оптимизация | глобально `-O2` + ThinLTO |
| Runtime ABI | GNU остаётся основным |
| Загрузчик | systemd-boot |
| UKI-генератор | Dracut — `ukify` в generation path не входит |
| Корень | LUKS2 → TPM2-разблокировка → Btrfs-субволюм `@` |
| Portage env | 4 файла `env/`, 3 файла `package.env/` |
| Binary packages | `FEATURES=getbinpkg`; единственный remote binrepo — private `gentoo-builder`; local source fallback — PASS |

## Управление памятью

`zram-generator` создаёт `/dev/zram0` по настройкам
`/etc/systemd/zram-generator.conf`: `zram-size = ram / 2` (сейчас 11.5 GiB
при 24 GiB RAM), сжатие `zstd`, swap priority `100`. `zswap` не используется.

В `/etc/sysctl.d/99-memory.conf` задано `vm.swappiness = 100`: для swap в RAM
принята равная относительная стоимость reclaim анонимной памяти через swap и
файлового кэша. Это не процент занятой RAM и не порог начала swap; значение
`100` не объявляется универсальным оптимумом. `vm.vfs_cache_pressure = 100`
оставлено без изменений. MGLRU включён (`0x0007`); THP остаётся в режимах
`enabled = always` и `defrag = madvise`.

Состояние проверено 2026-09-27 по конфигурации, `sysctl`, `swapon` и sysfs.

## Toolchain

- Production toolchain — LLVM/Clang/LLD 22. Ядро намеренно собирается LLVM
  23.1.1 (env `kernel-llvm`, пилот): эксперимент по совместимости LLVM 23
  (A1–A4) завершён, перевод остальной системы на LLVM 23 не начат.
- Userspace CPU target — явный `-march=alderlake`: явный таргет воспроизводим и
  проверяем по конфигу, а `-march=native` подстраивается под конкретный
  экземпляр CPU, на котором идёт компиляция, и потому отклонён как
  userspace production policy. Явный набор `-mno-*` остаётся как отключение
  возможностей, которых у процессора нет.
- Записанный профиль: `MAKEOPTS="-j14 -l10"` — с запасом под гибридные ядра и
  память — и `VIDEO_CARDS="intel zink"` (невалидный токен `iris` удалён
  2026-09-11).
- `GOFLAGS` удалён 2026-09-11 как не влияющий на сборки: `go-env.eclass`
  задаёт собственный `GOFLAGS` и сам добавляет `-buildmode=pie`.
- Для C/C++ используется глобальный ccache; BOLT отключён.
- Кэширование разделено по языку: C/C++ использует глобальный `ccache`, Rust
  — глобальный для Portage `RUSTC_WRAPPER=/usr/bin/sccache`. Каталог
  `/var/tmp/sccache` имеет лимит `20G`; значения `RUSTC_WRAPPER`, `SCCACHE_DIR`,
  `SCCACHE_CACHE_SIZE` и `SCCACHE_SERVER_UDS` подтверждены через
  `portageq envvar`.
- Постоянный сервер запускает `sccache-portage.service` от `portage:portage`.
  Сервис включён и активен; он работает в foreground под контролем systemd
  (`SCCACHE_IDLE_TIMEOUT=0`, `SCCACHE_START_SERVER=1`, `SCCACHE_NO_DAEMON=1`).
  Portage подключается к нему через Unix domain socket
  `/var/tmp/sccache/sccache.sock`: при глобальном `FEATURES=network-sandbox`
  TCP localhost не подходил для build namespace и мог приводить к отдельным
  краткоживущим server instances со статистикой, остававшейся нулевой.
- Контролируемые Rust-сборки показали полезные попадания sccache, поэтому
  он остаётся включённым с `20G` локального хранилища. Размер пересматривается
  только по накопленной production-статистике. Remote storage и distributed
  compilation не используются.
- ccache остаётся включённым для C/C++. Постоянно заполненный кэш 50G давал
  около 21% попаданий и не оправдывал свой размер; 2026-10-02 лимит снижен
  до 20G: `CCACHE_SIZE="20G"` в `/etc/portage/make.conf`, `max_size = 20G`
  в `/var/tmp/ccache/ccache.conf`. Проверить `ccache -s` через 2–4 недели
  обычной работы; при падении hit rate заметно ниже ~15% — поднять лимит до 30G.

<details>
<summary>Исторические измерения кэшей</summary>

| Измерение | Результат |
|-----------|-----------|
| sccache 0.16.0, `emerge --buildpkgonly -1 dev-util/sccache` | Cold: 160,40 с, 151 miss; warm: 94,65 с, 151 hit (147 Rust, 4 Assembler). Экономия 65,75 с (~41%, ~1,69×); cumulative hit rate 50% (151 miss / 151 hit). |
| Cold non-cacheable calls | 34, включая 29 с причиной `crate-type`; измерение относится к cacheable compiler work, а не ко всем фазам Portage. |
| ccache, 2026-09-25 | 234 108 / 328 009 вызовов cacheable (71,37%); 50 581 hit (21,61%): 23 474 direct / 27 107 preprocessed. 93 897 uncacheable, 4 ошибки. `du -sh`: 47G; ccache: 50,0/50,0 GB (99,90%), 276 очисток. Лимит 50G сначала сохранён до периода обычных обновлений. |
| ccache, 2026-10-02 | 53 132 / 254 558 cacheable calls hit (20,87%); 50,0/50,0 GB (99,97%), 311 очисток. После `ccache -M 20G`, затем `ccache -c` каталог занимал 19G. |

</details>

## Gentoo binary build host — production

Workstation использует private binrepo от
[`gentoo-builder-01`](../../../gentoo-builder-01/), чтобы сократить локальные
userspace-сборки. Ресурсы VM, package policy, compiler settings, загрузка и
HTTP service описаны на странице builder.

- Builder userspace — `x86-64-v3`; workstation userspace сохраняет C/C++
  `-march=alderlake`, `RUSTFLAGS="-C target-cpu=alderlake"`, `GOAMD64="v3"`
  и текущий `CPU_FLAGS_X86` (2026-10-07). Синхронизация policy для совместимости
  прошла проверку 2026-10-09; execution settings workstation и builder различаются.
- Ядро остаётся local-only / native (`CONFIG_X86_NATIVE_CPU=y`), под Alder Lake;
  см. [CPU optimization](../../hardware/cpu-optimization/).
- Подходящие V3 packages используются автоматически; local source fallback
  сохраняет независимость workstation от доступности builder. Official Gentoo
  binrepo не участвует в production path. Приёмка записана 2026-10-10.

Сравнение V3 поддерживает эту policy только для проверенных workload и не
обосновывает смену workstation target. Canonical результаты — в
[benchmark и его ограничениях](../../../../experiments/compiler-optimization/alderlake-vs-x86-64-v3/).

### Private binrepo на workstation

**Production policy принята 2026-10-10.** Обычный `emerge` автоматически
использует подходящий private binpkg. Если пакет отсутствует, несовместим
с package policy/USE или private binhost недоступен, Portage разрешает
обычную local source build с Alder Lake optimization. Official Gentoo binary
packages в этом production path не участвуют; ядро остаётся local-only.

Файл: `/etc/portage/make.conf`.

```makefile
FEATURES="${FEATURES} getbinpkg"
```

Позже существующая строка `FEATURES="${FEATURES} ccache"` дополняет effective
`FEATURES` и сохраняет `getbinpkg`.

Официальный Gentoo **binary repository** исключён из active `binrepos.conf`:
его конфиг перенесён из `/etc/portage/binrepos.conf/gentoobinhost.conf` в
`/etc/portage/gentoobinhost.conf.disabled`. Обычный Gentoo ebuild repository
остаётся source repository системы.

Файл: `/etc/portage/binrepos.conf/gentoo-builder.conf`.
Единственный active remote binary repository:

```ini
[gentoo-builder]
priority = 9999
sync-uri = https://binhost.apps.home.9fans.uk
location = /var/cache/binhost/gentoo-builder
verify-signature = false
```

Private repo сейчас unsigned: `verify-signature = false` — принятое текущее
состояние этого репозитория. Signing не является blocker или обязательным
следующим шагом production path.

### Ручной update: builder first → PASS → workstation

1. На `gentoo-builder-01` синхронизировать Gentoo repositories / overlays,
   проверить resolver и выполнить обычный update `@world`. `buildpkg`
   автоматически создаёт новые GPKG; update должен завершиться успешно.
2. Только после PASS builder синхронизировать repositories / overlays на
   workstation и выполнить обычный update `@world`. Подходящие private GPKG
   используются автоматически, остальное собирается локально из source.

Builder служит простым staging/build gate. Если его update не прошёл,
routine update workstation не продолжается до разбора причины.
Scheduled обновление builder не используется и сейчас не требуется;
exact repository snapshot pinning не реализован. При срочном независимом
обновлении workstation возможна local source build; routine workflow
остаётся builder-first.

### Проверка binary consumption

Ниже — проверки владельца 2026-10-10; при обновлении документации команды
не запускались на живой системе.

```bash
curl -I https://binhost.apps.home.9fans.uk/Packages
```

Ответ: HTTP/2 200, `via: 1.0 Caddy`. Canonical endpoint:
`https://binhost.apps.home.9fans.uk`. Backend и ingress configuration —
на [странице builder](../../../gentoo-builder-01/).

| Проверка на workstation | Результат |
|-------------------------|-----------|
| `emerge -gpv1 app-arch/zstd` | `[binary Rg]`; 1 reinstall, 1 binary |
| `emerge -gfv1 app-arch/zstd` | Реальная загрузка private GPKG, HTTP 200 |
| `emerge -g -1v app-arch/zstd` | `[binary Rg]`, `>>> Emerging binary`, package merged successfully; без локальной компиляции zstd |
| `emerge -pv1 app-arch/zstd` после включения `getbinpkg` и исключения official binrepo | `[binary   Rg   ] app-arch/zstd-1.5.7-r1-1`; automatic consumption без `-g` — PASS |

Загружен пакет
`https://binhost.apps.home.9fans.uk/app-arch/zstd/zstd-1.5.7-r1-1.gpkg.tar`;
сохранён в
`/var/cache/binhost/gentoo-builder/app-arch/zstd/zstd-1.5.7-r1-1.gpkg.tar`.

В последнем pretend `0 KiB` означает, что GPKG уже cached после предыдущего
E2E fetch. Выбран именно binary package, а не source build.

### Проверка source fallback

Владелец проверил fallback отдельно 2026-10-10, исключив cache false positive.
Перед тестом cached private GPKG
`/var/cache/binhost/gentoo-builder/app-arch/zstd/zstd-1.5.7-r1-1.gpkg.tar`
временно переименован в `zstd-1.5.7-r1-1.gpkg.tar.saved` в том же каталоге;
на builder остановлен `gentoo-binhost.service`.

Обычный production-style вызов без `-g`:

```bash
emerge -1v app-arch/zstd
```

Portage сообщил `[gentoo-builder] HTTP Error 502: Bad Gateway`, но
не завершился ошибкой и выбрал `[ebuild   R    ] app-arch/zstd-1.5.7-r1`.
Начались verifying ebuild manifests, успешная проверка подписи source archive
и распаковка source в `PORTAGE_TMPDIR`.

**PASS:** resolver/source fallback при недоступном private binhost и реальный
вход в source build path. После доказательства source path владелец намеренно
остановил сборку Ctrl+C; полный fallback source rebuild/merge zstd этим тестом
не подтверждён. Архитектурное требование независимости workstation от
доступности builder принято.

## Оптимизация

Глобально `-O2`; ThinLTO глобально там, где package/ebuild policy допускает;
`-O3` — только для отдельного пакета после собственного benchmark. По итогам
сравнения `-O2` и `-O3` selective-правила не создавались; полные результаты,
методика и ограничения приведены в
[документе эксперимента](../../../../experiments/compiler-optimization/o2-vs-o3/).

- Fortran — `-O2` без ThinLTO: GNU Fortran не понимает `-flto=thin`
  (расширение Clang).
- Полный rebuild `@world` после смены optimization/LTO policy завершён
  2026-09-21: система загрузилась штатно, основные сервисы работают, регрессий,
  связанных с `-O2` + ThinLTO, в журналах не выявлено. Это не значит, что
  каждый установленный файл собран с ThinLTO: ebuild'ы могут фильтровать LTO
  (`filter-lto`), а часть пакетов вообще не использует C/C++ toolchain.

## Package.env и GCC-исключения

Текущая структура — 4 файла `env/`, 3 файла `package.env`:

```text
/etc/portage/env:          gcc-fallback  kernel-llvm  p-cores  ssd
/etc/portage/package.env:  00-toolchain  10-performance  30-gcc-fallback
```

Действующая policy:

- C/C++ — глобально `-O2` + ThinLTO, если ebuild сам его не фильтрует;
  локального `no-lto-llvm` blacklist больше нет.
- GCC fallback — только два текущих исключения: `sys-devel/binutils` (реальная
  проблема Clang + PGO) и `x11-libs/pango` (временное исключение перед
  переходом на LLVM 23 из-за известной проблемы Clang 23). Назначения — в
  `30-gcc-fallback`. BFD policy находится внутри `env/gcc-fallback`: GCC LTO
  (`-flto=auto`) несовместим с глобальным `-fuse-ld=lld`.
- Performance policy (`p-cores`, `ssd`) — в `00-toolchain` и
  `10-performance`: clang/lld/llvm (`p-cores ssd`), gentoo-kernel
  (`kernel-llvm p-cores ssd`), firefox, qtbase и thunderbird (`p-cores ssd`),
  mesa — только `ssd`.

### Как к этому пришли

- Основной аудит и очистка `make.conf` — 2026-09-11; optimization policy
  применена 2026-09-20.
- No-LTO exception cleanup завершён 2026-09-21: все 102 локальных
  `no-lto-llvm` overrides перепроверены и сняты контролируемыми batch'ами
  (проверка — `emerge --buildpkgonly -1`); `env/no-lto-llvm`, `env/no-ccache`
  (после исчезновения последнего потребителя) и `package.env/20-compatibility`
  удалены. Все overrides оказались больше не нужны: для части пакетов ebuild
  сам управляет LTO (`filter-lto`), а часть Go/Rust-пакетов не использует эти
  C/C++ flags напрямую.
- Перепроверены 2026-09-20 и больше не документируются как GCC-исключения:
  `app-shells/bash` (включая `USE=pgo`), `app-containers/lxc-7.0.0-r1`,
  `app-editors/nano`, `dev-cpp/highway`, `net-analyzer/nmap`,
  `media-libs/libjxl`, modern OpenJDK — все успешно собираются production
  Clang.

## Загрузка

Путь загрузки:

```text
systemd-boot → UKI (Dracut) → LUKS2 (TPM2) → Btrfs (@)
```

- Текущее ядро — `7.2.9-bdsm`: boot и User-status LED acceptance — PASS
  2026-10-04; полный regression-тест всех подсистем отдельно не проводился.
  Историческая verification point (2026-09-22) — `7.2.7-bdsm`: установлены
  `sys-kernel/gentoo-kernel-7.2.7` и `-7.2.6`, `installkernel-68-r1`; система
  успешно загрузилась на ядре 7.2.7 после обновления.
- `kernel-install` использует `layout=uki`, `initrd_generator=dracut` и
  `uki_generator=dracut` (`/etc/kernel/install.conf`, проверено 2026-09-22).
  Production-генератор UKI — Dracut: он создаёт UKI, а systemd-boot загружает
  его с ESP. `ukify` — только USE-capability `sys-kernel/installkernel`
  (см. package policy ниже), в generation path не входит.
- Dracut подписывает UKI ключами sbctl; после установки плагин sbctl проверяет
  подпись итогового EFI-файла.
- `bootctl list` (2026-09-22): текущая загрузка — `gentoo-7.2.7-bdsm.efi`
  (selected); в ESP также `gentoo-7.2.6-bdsm.efi`, `gentoo-7.2.2-bdsm.efi` и
  Arch UKI (`arch-linux-cachyos.efi` — default, `arch-linux.efi`).
- Secure Boot и наличие корректно подписанных boot artifacts проверены
  2026-09-22.
- Автоматическая TPM2-разблокировка LUKS последний раз подтверждена реальной
  успешной загрузкой 2026-09-14; 2026-09-22 её повторно не тестировали.
- AppArmor / LSM: принятая cmdline — `apparmor=1` и
  `lsm=landlock,lockdown,yama,apparmor,bpf`; устаревший
  `security=apparmor` удалён. После сборки и загрузки `7.2.9-bdsm`
  `/sys/kernel/security/lsm` подтвердил активный runtime-набор:
  `lockdown,capability,landlock,yama,apparmor,bpf`.
  В kernel config `# CONFIG_INTEGRITY is not set` (`CONFIG_INTEGRITY=n`):
  старый token `integrity` в cmdline не имел собранной infrastructure
  и отсутствовал в runtime. Он удалён из принятой UKI cmdline для
  согласованности с ядром; это не security fix и не функциональное изменение
  работающей системы. `CONFIG_DM_INTEGRITY` и `CONFIG_BLK_DEV_INTEGRITY` —
  отдельные возможности device-mapper и block layer; они намеренно сохранены,
  и удаление `integrity` из `lsm=` их не отключает.

## Package policy

Подтверждено сверкой с живой системой 2026-09-12 (файлы
`/etc/portage/package.use/`).

```makefile
# /etc/portage/package.use/20-kernel-boot
sys-kernel/gentoo-kernel      initramfs savedconfig modules-sign modules-compress -debug
sys-kernel/installkernel      systemd-boot ukify dracut uki -grub -efistub -ugrd -refind
sys-kernel/linux-firmware     compress-zstd deduplicate -savedconfig
sys-firmware/intel-microcode  dist-kernel initramfs split-ucode hostonly -vanilla
```

- `savedconfig` ядра хранится в `/etc/portage/savedconfig/sys-kernel/`
  (проверено 2026-09-22): rolling-файл `gentoo-kernel` и версионные
  `gentoo-kernel-7.2.6`, `gentoo-kernel-7.2.7` (приоритет PF > PN по правилу
  eclass); файлов `*.bak` нет.
- Прежний флаг `-generic` у gentoo-kernel устарел: в текущих ebuild его нет
  (схема сменилась на `generic-uki`), из живой конфигурации он убран.
- При выключенном `savedconfig` у linux-firmware сохранённый список
  `linux-firmware-20260916` не применяется — судьба файла не решена (обновлён
  с прежнего `20260810`, проверено 2026-09-22).
- Точечные `llvm_slot_*`-правила удалены 2026-09-12: при установленных слотах
  LLVM 22 и 23 все потребители (mesa, mesa_clc, niri, bpftool, perf, firefox,
  xwayland-satellite) резолвятся в 22, потому что слот 23 их ebuild'ами ещё не
  поддерживается. Когда появится `llvm_slot_23`, дефолты перевернутся на него
  сами — в этот момент решать вопрос перехода.
- `video_cards_i915` у mesa удалён 2026-09-12: легаси-драйвер Gen2–Gen5,
  графику Alder Lake обслуживает iris (значение `intel` в `VIDEO_CARDS`).
- Java: source `dev-java/openjdk:17` больше не нужен; система переведена на
  `dev-java/openjdk-bin:25` — system VM через `eselect java-vm`, проверено
  `java -version` (Temurin 25.0.4 LTS) и `javac -version`.

## USE-policy: детали

Раздел для точечных решений по USE-флагам; читать основной текст выше можно
без него.

Глобальные изменения `make.conf` (аудит 2026-09-12):

- Из глобального `USE` удалены семь флагов без установленных потребителей
  (`mapi`, `vpp`, `zink`, `networkmanager`, `udisks2`, `libnotify`, `acpi`).
  Драйвер Zink не затронут: он управляется `video_cards_zink` из
  `VIDEO_CARDS`.
- Ещё четыре флага перенесены точечно в `package.use`: `sound-server`
  (pipewire), `screencast` (niri), `lto` (gcc), `gles2` (gst-plugins-base,
  mesa-progs). `egl`, `ffmpeg`, `v4l`, `pgo`, `custom-cflags` и `btrfs`
  остаются глобальной политикой.
- Глобально в `make.conf` включён `verify-provenance`: применяется
  поддерживающими его `dev-python/*` ebuild'ами для проверки PyPI
  provenance/attestations. Дополняет `verify-sig`, не заменяет его, и не
  распространяется на все Python-пакеты.

### Review 2026-09-22: базовые и system-пакеты

Частичный review USE-флагов; зафиксированы только принятые решения (применены
владельцем):

- `app-alternatives/gzip` — выбран `pigz` (parallel gzip) вместо reference
  GNU gzip.
- `dev-libs/libpcre2` — `jit`: PCRE2 JIT capability и JIT в `pcre2grep`;
  автоматического использования JIT каждым consumer PCRE2 это не даёт.
- `dev-libs/openssl` — `ktls`: kernel support уже присутствует; USE-флаг
  только компилирует поддержку kTLS в OpenSSL, фактическое использование
  требует opt-in со стороны приложения/runtime (`SSL_OP_ENABLE_KTLS` или
  эквивалент).
- `sys-process/audit` — `io-uring`: поддержка kernel Audit `io_uring`
  filter/правил и интерпретации io_uring operations; сам `auditd` при этом на
  io_uring не переводится.
- `sys-apps/util-linux` — `caps` (добавляет `setpriv` для диагностики
  capabilities/hardening), `-cramfs` (legacy filesystem tooling не нужен).
- `app-misc/pax-utils` — `caps`: `pspax` отображает capability sets процессов.
- `sys-devel/gettext` — `git`: `autopoint` использует Git backend для
  internal infrastructure data.
- `sys-apps/coreutils` — `caps` (capability-aware file utilities) и `gmp`
  (multiprecision arithmetic в `factor`, `expr`, `basenc`).

Архитектурные решения того же review:

- **TPM policy**: `app-crypt/tpm2-tss -fapi -policy`,
  `app-crypt/tpm2-tools -fapi`, `app-crypt/gnupg -tpm`. TPM используется для
  LUKS2/`systemd-cryptenroll`; TSS FAPI не задействован, GnuPG keys на TPM не
  хранятся.
- **Контейнеры**: `app-containers/lxc landlock` — в дополнение к сохраняемым
  `apparmor caps seccomp`; `app-containers/containerd -cri` — Kubernetes/CRI
  не используется. Runtime storage drivers проверены: Docker — `overlay2`,
  Podman — `overlay`, поэтому `app-containers/docker -btrfs` и
  `app-containers/podman -btrfs` — осознанное решение, несмотря на Btrfs host
  filesystem. Для `containerd` действует та же логика: `-btrfs` после
  resolver-проверки, что `containerd[btrfs]` больше никому не требуется.
- **Privilege hardening**: `sys-process/htop caps -filecaps` — обычному htop
  не выдаётся постоянный `CAP_SYS_PTRACE`, расширенный доступ — `doas htop`;
  `sys-apps/smartmontools caps` — smartd сбрасывает лишние privileges через
  libcap-ng.
- **Chrony**: `net-misc/chrony -phc -refclock -rtc` — проверено по
  `/etc/chrony/chrony.conf`, соответствующие directives отсутствуют; обычный
  `rtcsync` от USE=`rtc` не зависит.
- **Graphics**: `media-libs/mesa -vaapi -lm-sensors` при
  `VIDEO_CARDS="intel zink"` — Gallium VA-API для этого Intel setup не
  используется (VA-API обслуживается отдельным Intel/libva stack), а
  `lm-sensors` нужен Mesa только для Gallium HUD, который не используется.
- **LLVM runtime policy**: `clang-runtime:22` и `clang-runtime:23` —
  `compiler-rt openmp sanitize` при `-default-compiler-rt -default-libcxx
  -default-lld -libcxx -llvm-libunwind`. По умолчанию сохраняется GNU runtime
  ABI; наличие compiler-rt/sanitizer runtimes не переводит систему на LLVM
  runtimes — это отдельный [Experiment
  C](../../../../experiments/llvm23-toolchain/) (NOT STARTED).
- **OpenVPN**: `net-vpn/openvpn dco kernel-ovpn` (решение 2026-09-22, по
  итогам инцидента с `ovpn-dco`): DCO включён через mainline in-kernel модуль
  `ovpn` (`CONFIG_OVPN=m`, собирается с ядром). Out-of-tree
  `net-vpn/ovpn-dco` не вводится: он требует снимать
  `CONFIG_TRIM_UNUSED_KSYMS` и дублирует in-kernel модуль; при включении
  `dco` без `kernel-ovpn` пакет `ovpn-dco` падает в setup phase на
  kernel-config check.

### Review 2026-09-22: desktop и прикладной стек

**Desktop / document stack**

- `app-text/poppler cairo` — Cairo/GLib backend включён; устранена
  бессмысленная комбинация `introspection -cairo`.
- `dev-java/openjdk-bin -source` — runtime/JDK сохраняется, установка
  исходников не нужна.
- `media-gfx/imagemagick lcms tiff` — ICC color-management и TIFF support
  входят в capability универсального image tool.

**Multimedia**

- `media-libs/gst-plugins-base orc`, `gst-plugins-good orc`,
  `gst-plugins-bad orc` — единая ORC/JIT policy для основного GStreamer stack.
- `media-video/ffmpeg pulseaudio` — libpulse backend поверх PipeWire
  compatibility layer.
- `app-emulation/spice opus` — Opus audio support.
- `media-libs/libheif -kvazaar` — HEVC encoding остаётся на x265; второй
  encoder не нужен.

**Firmware / platform**

- `sys-apps/fwupd uefi gnutls` — UEFI capsule/update functionality для
  ноутбука; `gnutls` требуется этой конфигурацией.

**Secrets / TPM**

- `app-crypt/libsecret -pam -tpm` — TPM integration libsecret не используется,
  что согласуется с TPM policy выше (TPM — только LUKS2/
  `systemd-cryptenroll`). USE-флаг `pam` включает поддержку PAM в
  `gnome-base/gnome-keyring[pam]`; модуль `pam_gnome_keyring.so` установлен.
  Текущий PAM stack его не вызывает, поэтому активной PAM-интеграции с GNOME
  Keyring сейчас нет.

**Qt / desktop performance**

- `dev-qt/qtdeclarative jit` — QML JIT runtime path остаётся доступным для Qt
  Quick/QML consumers.
- `dev-qt/qtbase io-uring` — включён io_uring backend Qt; осознанный
  performance/capability choice, а не утверждение о гарантированном
  ускорении.
- `media-gfx/qimgv video exif` — video/animated media через libmpv и EXIF
  metadata support.
- `gui-apps/noctalia jemalloc` — jemalloc сохранён как выбранная runtime
  memory-allocation policy для long-running shell (состояние — в [системном
  desktop-разделе](../../desktop/noctalia/)).

**Network analysis**

- `net-analyzer/wireshark http2 http3 sshdump` — полноценная современная
  HTTP/2 и HTTP/3 support; remote capture через SSH.

**Firefox cleanup**

- Локальный `www-client/firefox -jumbo-build` удалён и не заменён явным
  `jumbo-build`: актуальный Gentoo profile форсирует `jumbo-build` для
  Firefox, а `USE=pgo` также его требует. Отрицательный локальный override
  стал no-op и больше не является policy — `jumbo-build` наследуется от
  профиля.

Мелкие подтверждённые решения: `app-misc/fastfetch drm pulseaudio`,
`dev-lang/ruby gmp`.

Review 2026-09-22 завершён. Он закрыл только перечисленные решения и не
заменяет полный аудит `/etc/portage` от 2026-09-14.

## Проверка состояния

Разделы сверяются с живой системой поэтапно:

| Раздел | Проверено |
|--------|-----------|
| Secure Boot и подписи boot artifacts | 2026-09-22 |
| TPM2 auto-unlock LUKS (реальная загрузка) | 2026-09-14 |
| Toolchain и package.env | 2026-09-20…21 |
| Package policy (`package.use/`) | 2026-09-12 |
| USE-policy review | 2026-09-22 |
| Текущее ядро, UKI-генератор, savedconfig | 2026-09-22; текущее ядро — 2026-10-04 |

Основные команды проверки:

```bash
portageq envvar CFLAGS CXXFLAGS   # -O2 -flto=thin
bootctl list                      # текущая загрузка — UKI ядра 7.2.9-bdsm
java -version                     # openjdk-bin:25, Temurin 25.0.4 LTS
```

## Связанные документы

- [Базовая система](../../../../installation/base-system/)
- [UKI через Dracut](../../../../installation/systemd-uki-setup/)
- [Portage](../../../../managed/portage/)
- [Эксперимент LLVM 23 toolchain](../../../../experiments/llvm23-toolchain/)
