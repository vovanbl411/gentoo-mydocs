---
title: Загрузка и Portage на ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Сейчас

| Что | Значение |
|-----|----------|
| Ядро | `7.2.7-bdsm` — `sys-kernel/gentoo-kernel` с `savedconfig` |
| Сборка ядра | LLVM 23.1.1 (env `kernel-llvm`, пилот) |
| Основной toolchain | LLVM/Clang/LLD 22 |
| Оптимизация | глобально `-O2` + ThinLTO |
| Runtime ABI | GNU остаётся основным |
| Загрузчик | systemd-boot |
| UKI-генератор | Dracut — `ukify` в generation path не входит |
| Корень | LUKS2 → TPM2-разблокировка → Btrfs-субволюм `@` |
| Portage env | 4 файла `env/`, 3 файла `package.env/` |

## Toolchain

- Production toolchain — LLVM/Clang/LLD 22. Ядро намеренно собирается LLVM
  23.1.1 (env `kernel-llvm`, пилот): эксперимент по совместимости LLVM 23
  (A1–A4) завершён, перевод остальной системы на LLVM 23 не начат.
- CPU target — явный `-march=alderlake`: явный таргет воспроизводим и
  проверяем по конфигу, а `-march=native` подстраивается под конкретный
  экземпляр CPU, на котором идёт компиляция, и потому отклонён как production
  policy. Явный набор `-mno-*` остаётся как отключение возможностей, которых
  у процессора нет.
- Записанный профиль: `MAKEOPTS="-j14 -l10"` — с запасом под гибридные ядра и
  память — и `VIDEO_CARDS="intel zink"` (невалидный токен `iris` удалён
  2026-09-11).
- `GOFLAGS` удалён 2026-09-11 как не влияющий на сборки: `go-env.eclass`
  задаёт собственный `GOFLAGS` и сам добавляет `-buildmode=pie`.
- Для повторных сборок используется ccache; BOLT отключён.

## Оптимизация

Глобально `-O2`; ThinLTO глобально там, где package/ebuild policy допускает;
`-O3` — только package-specific после отдельного benchmark. По итогам
эксперимента B1–B4 selective-правил для `-O3` не создано. Решение 2026-09-20,
доказательная база —
[experiments/llvm23-toolchain](../../../../experiments/llvm23-toolchain/).

- Fortran — `-O2` без ThinLTO: GNU Fortran не понимает `-flto=thin`
  (расширение Clang).
- Политика применена к `/etc/portage` 2026-09-20: `-O3` → `-O2` в `make.conf`
  и env-файлах (`kernel-llvm` уже был `-O2`). `portageq envvar CFLAGS CXXFLAGS`
  подтверждает `-O2 -flto=thin`, resolver рассчитывается.
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
  (`kernel-llvm p-cores ssd`), firefox и qtbase (`p-cores ssd`), mesa — только
  `ssd`.

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

- Текущее ядро (2026-09-22) — `7.2.7-bdsm`: установлены
  `sys-kernel/gentoo-kernel-7.2.7` и `-7.2.6`, `installkernel-68-r1`. Система
  успешно загрузилась на ядре 7.2.7 после обновления; полный regression-тест
  всех подсистем отдельно не проводился.
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
- AppArmor: в cmdline используется `apparmor=1` и
  `lsm=landlock,lockdown,yama,integrity,apparmor,bpf`; устаревший
  `security=apparmor` удалён. В runtime AppArmor присутствует в активном
  наборе LSM.

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
  `systemd-cryptenroll`); PAM integration остаётся через
  `gnome-base/gnome-keyring[pam]`.

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
| Текущее ядро, UKI-генератор, savedconfig | 2026-09-22 |

Основные команды проверки:

```bash
portageq envvar CFLAGS CXXFLAGS   # -O2 -flto=thin
bootctl list                      # текущая загрузка — gentoo-7.2.7-bdsm.efi
java -version                     # openjdk-bin:25, Temurin 25.0.4 LTS
```

## Связанные документы

- [Базовая система](../../../../installation/base-system/)
- [UKI через Dracut](../../../../installation/systemd-uki-setup/)
- [Portage](../../../../managed/portage/)
- [Эксперимент LLVM 23 toolchain](../../../../experiments/llvm23-toolchain/)
