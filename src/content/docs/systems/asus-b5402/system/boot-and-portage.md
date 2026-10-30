---
title: Загрузка и Portage на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Текущая конфигурация

- Gentoo использует профиль `default/linux/amd64/23.0/no-multilib/hardened/systemd`.
- Userspace собирается Clang/LLD из LLVM slot 22. Базовые C/C++ флаги — `-march=alderlake -O2 -flto=thin`; GNU runtime ABI остаётся основным.
- `sys-kernel/gentoo-kernel` собирается на `gentoo-builder-01` в GPKG с подготовленным для этой версии `savedconfig` и двумя локальными патчами. На ноутбуке этот пакет ставится только из binhost; затем `installkernel` и Dracut создают UKI для systemd-boot.
- `/etc/portage/make.conf` включает автоматическое получение подходящих GPKG (`FEATURES=getbinpkg`). Если подходящего пакета нет, обычный `emerge` собирает ebuild локально. Для ядра действует отдельная процедура, которая требует binpkg и завершится ошибкой, если его нет.
- Для swap используется zram объёмом в половину RAM; zswap отключён в kernel config. C/C++ использует ccache, Rust — sccache.

## Toolchain

`make.conf` задаёт toolchain по умолчанию для userspace. Параметры ядра переопределяются отдельным package environment и описаны в разделе об обновлении ядра.

Файл: `/etc/portage/make.conf` на ноутбуке.

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

- `-march=alderlake` задаёт целевой CPU userspace-сборок; явный target не зависит от того, на каком узле запущен компилятор.
- `-O2` — выбранный уровень оптимизации. `-flto=thin` включает ThinLTO там, где его не отключает ebuild. Fortran получает отдельный набор без LTO, поскольку используемый GNU Fortran не поддерживает Clang ThinLTO.
- `-fuse-ld=lld` выбирает LLVM linker. `--as-needed` не оставляет ссылки на неиспользуемые shared libraries.
- `-mno-kl`, `-mno-pconfig`, `-mno-sgx` и `-mno-widekl` отключают наборы инструкций, которых нет у целевого Alder Lake; `-mshstk` включает генерацию поддержки Shadow Stack.
- `RUSTFLAGS` задаёт Rust target CPU, а `GOAMD64="v3"` — минимальный Go ISA level для переносимых бинарных пакетов builder. Это разные настройки; `GOAMD64` не меняет C/C++ target.
- `MAKEOPTS` ограничивает параллелизм обычных сборок ноутбука. Package-specific `p-cores` и `ssd` переопределяют число jobs и временный каталог для тяжёлых пакетов.

Проверь эффективные значения, а не только исходные строки: Portage может добавлять или переопределять параметры в `package.env`.

```bash
portageq envvar CC CXX CFLAGS CXXFLAGS FCFLAGS FFLAGS LDFLAGS RUSTFLAGS GOAMD64 MAKEOPTS
eselect llvm show
```

Для обычных пакетов ожидаются `clang`, `-march=alderlake -O2 -flto=thin`, `-fuse-ld=lld`, `-C target-cpu=alderlake`, `v3`, `-j14 -l10` и `llvm-22`. Если отличаются параметры конкретного пакета, проверь его запись в `/etc/portage/package.env/` и назначенный файл `/etc/portage/env/`; не исправляй глобальные флаги ради package-specific override.

`sys-devel/binutils` и `x11-libs/pango` — два оставшихся GCC fallback. Для них `package.env/30-gcc-fallback` выбирает GCC и BFD. Binutils собирается через GCC из-за проблем Clang с PGO; Pango остаётся отдельным GCC/BFD исключением совместимости с Clang. GCC использует `-flto=auto`, поэтому для этого environment выбран BFD, а не глобальный LLD. Остальные удалённые GCC/no-LTO исключения не возвращай без воспроизводимой ошибки.

## Gentoo binary build host — production

Ноутбук получает бинарные пакеты только из private binrepo builder. Builder собирает userspace с `-march=x86-64-v3`; ноутбук сохраняет `-march=alderlake`. Эти target не взаимозаменяемы: binpkg содержит уже собранные файлы и metadata о build environment, но не меняет ноутбучные `CFLAGS`. В `CPU_FLAGS_X86` ноутбука есть `avx_vnni`, `sha` и `vpclmulqdq`; страница builder описывает для него общий subset без этих трёх флагов. Если package USE-настройки из-за этого не совпадают, Portage пропустит GPKG и соберёт ebuild локально. Не отключай проверку USE ради увеличения числа бинарных пакетов.

### Private binrepo на workstation

Файл: `/etc/portage/make.conf` на ноутбуке.

```makefile
FEATURES="${FEATURES} getbinpkg"
EMERGE_DEFAULT_OPTS="${EMERGE_DEFAULT_OPTS} --usepkg-exclude 'app-admin/keepassxc sys-auth/fprintd sys-auth/libfprint app-crypt/sbctl app-crypt/sbsigntools sys-boot/efibootmgr sys-kernel/installkernel sys-kernel/dracut sys-kernel/gentoo-kernel dev-util/perf sys-firmware/intel-microcode sys-kernel/linux-firmware sys-firmware/sof-firmware'"
```

Файл: `/etc/portage/binrepos.conf/gentoo-builder.conf`. Это единственный active remote binrepo:

```ini
[gentoo-builder]
priority = 9999
sync-uri = https://binhost.apps.home.9fans.uk
location = /var/cache/binhost/gentoo-builder
verify-signature = false
```

Official Gentoo binary repository в active `binrepos.conf` не включён. Gentoo ebuild repository продолжает использоваться для исходных ebuilds и distfiles. Private binrepo сейчас не подписывает GPKG; `verify-signature = false` относится к проверке подписи binpkg и никак не отключает Secure Boot или подпись UKI.

При обычном `emerge` Portage запрашивает индекс builder и использует пакет, если версия, ABI, USE и другие условия разрешения подходят. Если GPKG отсутствует, не соответствует текущей package policy или binhost недоступен, Portage оставляет ebuild в плане и собирает его из исходников. Это source fallback: он сохраняет возможность обслуживания ноутбука без builder, но может потребовать существенно больше времени.

Проверить выбор можно без установки:

```bash
doas emerge --pretend --verbose app-arch/zstd
```

В плане строка `[binary ...]` означает GPKG, `[ebuild ...]` — сборку из исходников. Если ожидаемый пакет показан как `ebuild`, сначала проверь, что `getbinpkg` есть в `portageq envvar FEATURES`, binhost доступен, а USE и ABI совпадают. Не отключай `--binpkg-respect-use`: несовместимый binpkg может установить неверный набор функций.

На ноутбуке `--usepkg-exclude` задаёт, какие GPKG нельзя автоматически устанавливать. На builder другая настройка — `--buildpkg-exclude`: она исключает пакеты из автоматического создания GPKG при обычном merge. Списки сейчас зеркальны.

Builder кладёт бинарные пакеты в `/var/cache/binpkgs` в формате GPKG. `pkgdir-index-trusted` полагается на актуальный локальный индекс `Packages`, а `compress-index` сохраняет также его сжатую копию для выдачи binhost.

Файл: `/etc/portage/make.conf` на builder.

```makefile
FEATURES="${FEATURES} buildpkg binpkg-logs compress-index pkgdir-index-trusted"
BINPKG_FORMAT="gpkg"
PKGDIR="/var/cache/binpkgs"
EMERGE_DEFAULT_OPTS="${EMERGE_DEFAULT_OPTS} --buildpkg-exclude 'app-admin/keepassxc sys-auth/fprintd sys-auth/libfprint app-crypt/sbctl app-crypt/sbsigntools sys-boot/efibootmgr sys-kernel/installkernel sys-kernel/dracut sys-kernel/gentoo-kernel dev-util/perf sys-firmware/intel-microcode sys-kernel/linux-firmware sys-firmware/sof-firmware'"
```

Проверь эффективные значения после изменений Portage config:

```bash
portageq envvar FEATURES BINPKG_FORMAT PKGDIR
```

Ожидаются `buildpkg`, `gpkg` и `/var/cache/binpkgs` среди выведенных значений. Если значение отличается, проверь `/etc/portage/make.conf` и перекрывающие настройки Portage до обновления builder.

Обычный update builder не создаёт GPKG для списка исключений; обычный update ноутбука не устанавливает их из binrepo. Это разные переключатели на двух системах, а не настройка совместимости GPKG. `--usepkg-exclude` запрещает только выбор бинарного пакета и не исключает ebuild из плана обновления. Поэтому обычные команды обновления ноутбука ниже явно исключают `sys-kernel/gentoo-kernel` и `virtual/dist-kernel`; отдельная процедура собирает оба GPKG для ядра ноутбука на builder, не устанавливая его там. Собственное ядро builder (`sys-kernel/gentoo-kernel-bin`) обновляется по его обычной package policy.

Причины сгруппированы по роли пакетов:

| Пакеты | Почему остаются вне обычного binpkg потока |
|--------|--------------------------------------------|
| `app-admin/keepassxc` | Для используемой версии применяется локальный Portage patch; обычный source merge гарантирует, что он попадёт в установленный пакет. |
| `sys-auth/fprintd`, `sys-auth/libfprint` | `libfprint` устанавливается с локальным patchset для сканера ELAN ноутбука; `fprintd` остаётся в том же hardware-specific стеке. |
| `app-crypt/sbctl`, `app-crypt/sbsigntools`, `sys-boot/efibootmgr` | Утилиты обслуживают Secure Boot и UEFI именно ноутбука; builder использует другой boot path (SeaBIOS/GRUB). Конфигурация и состояние UEFI остаются на ноутбуке. |
| `sys-kernel/installkernel`, `sys-kernel/dracut` | На ноутбуке они собраны для `systemd-boot` и Dracut UKI path; builder использует GRUB и не генерирует workstation UKI. Package USE policy для этих пакетов различается. |
| `sys-kernel/gentoo-kernel` | Отдельный version-specific workflow с `savedconfig` и локальными патчами. Он создаётся на builder вручную, обходя обычный buildpkg exclusion. |
| `dev-util/perf` | Его обновление связано с kernel headers и конфигурацией целевой системы, поэтому оно не входит в portable userspace binpkg set. |
| `sys-firmware/intel-microcode`, `sys-kernel/linux-firmware`, `sys-firmware/sof-firmware` | Это firmware stack ноутбука; для Intel microcode также включён `hostonly`, который нельзя собирать по CPU builder. |

Исключение не означает, что бинарный формат сам по себе несовместим: локальная сборка нужна для принятой package/patch/boot policy. Если причина исключения исчезнет, меняй обе стороны (`--buildpkg-exclude` и `--usepkg-exclude`) после отдельной проверки совместимости.

## Обычное обновление Portage

Routine workflow — сначала обновить builder, затем ноутбук. Builder собирает GPKG при package merge через `FEATURES=buildpkg`; его userspace target и package policy предназначены для совместимых бинарных пакетов. Не продолжай обычное обновление ноутбука, если update builder завершился ошибкой.

1. На `gentoo-builder-01` синхронизируй repositories/overlays, проверь resolver и выполни update `@world` с `--newuse`:

   ```bash
   doas emaint sync -a
   doas emerge --pretend --verbose --update --deep --newuse --complete-graph @world
   doas emerge --ask --verbose --update --deep --newuse --complete-graph @world
   ```

   Pretend должен завершиться без resolver-конфликтов. После подтверждённого update builder создаёт GPKG для обновлённых пакетов, кроме `--buildpkg-exclude`; индекс `Packages` должен отражать доступные пакеты в binhost. Если sync или merge завершился ошибкой, сначала исправь проблему на builder; обновление ноутбука не начинай.
2. На ноутбуке синхронизируй repositories/overlays и проверь resolver:

   ```bash
   doas emaint sync -a
   doas emerge --pretend --verbose --update --deep --newuse --complete-graph \
       --exclude=sys-kernel/gentoo-kernel --exclude=virtual/dist-kernel @world
   ```

   Ожидается полный план обновления без конфликтов зависимостей, кроме двух явно исключённых пакетов ядра. Если sync завершился с rsync status `23` или `RepoStorageException`, сначала проверь владельца Gentoo repository по [инструкции usersync](../../../../troubleshooting/portage-usersync-repository-ownership/).

3. Просмотри список пакетов, USE changes и планируемые source builds. Если план приемлем, выполни обычное обновление:

   ```bash
   doas emerge --ask --verbose --update --deep --newuse --complete-graph \
       --exclude=sys-kernel/gentoo-kernel --exclude=virtual/dist-kernel @world
   ```

   Подходящие GPKG будут выбраны автоматически, остальные пакеты соберутся из исходников. На вопрос Portage подтверди продолжение только после просмотра списка. Если private binhost недоступен, а план переключился на дорогие локальные сборки, отложи update и восстанови доступ builder; срочный source fallback допустим, если он осознан и хватает места/ресурсов.

Синхронизация builder и ноутбука не привязана к одному snapshot Gentoo repositories: точная фиксация snapshot не настроена. Поэтому builder-first уменьшает риск несовместимых GPKG, но не заменяет проверку resolver на ноутбуке.

## Обновление ядра: сборка GPKG на builder

Сначала выбери доступную версию `sys-kernel/gentoo-kernel` из дерева ebuilds и проверь её план, например через `emerge --search sys-kernel/gentoo-kernel` и pretend-запрос выбранного атома. В команде ниже замени `REPLACE_WITH_SELECTED_VERSION` на точную версию ebuild. На builder и ноутбуке используй одну и ту же выбранную версию. Версионные `savedconfig` и каталоги патчей должны соответствовать ей.

Для выбранной версии заранее подготовь на builder:

- version-specific `/etc/portage/savedconfig/sys-kernel/gentoo-kernel-<version>`;
- оба патча в `/etc/portage/patches/sys-kernel/gentoo-kernel-<version>/`: `10-asus-wmi-user-status-led.patch` и `20-asus-b5402-headset-mic.patch`;
- ту же версию ebuild, которую будет устанавливать ноутбук.

Ядро ноутбука собирается на builder только для binpkg: оно не устанавливается в систему builder. На ноутбуке хранятся соответствующие version-specific `savedconfig` и оба патча. Сохраняй рабочий UKI до установки новой версии. Каталоги текущих локальных патчей находятся под `/etc/portage/patches/sys-kernel/`; патчи привязаны к версии ebuild и должны быть перенесены в новый каталог после проверки их применимости.

На builder выполни два buildpkg-only шага. Первый собирает ядро с prepared config и патчами, но не устанавливает его в runtime builder. Второй создаёт binpkg для `virtual/dist-kernel`, чтобы dependency closure была доступна ноутбуку:

```bash
version=REPLACE_WITH_SELECTED_VERSION

doas env ACCEPT_KEYWORDS="amd64 ~amd64" \
    emerge --ignore-default-opts \
    --ask --verbose --oneshot --buildpkgonly --usepkg=n \
    "=sys-kernel/gentoo-kernel-${version}"

doas env ACCEPT_KEYWORDS="amd64 ~amd64" \
    emerge --ignore-default-opts \
    --ask --verbose --oneshot --buildpkgonly --usepkg=n --nodeps \
    "=virtual/dist-kernel-${version}"
```

`--ignore-default-opts` убирает workstation-style binpkg исключения из обычных параметров; `--usepkg=n` не позволяет builder случайно взять старый бинарный пакет вместо пересборки. Второй шаг использует `--nodeps`, чтобы создать только virtual binpkg без установки его runtime kernel dependency на builder. Ожидаемый результат — оба emerge завершаются успешно и GPKG для ядра и virtual доступны в binrepo. При ошибке patch application проверь версию каталога патчей и соответствие patch исходникам; при ошибке `savedconfig` проверь наличие version-specific файла.

На ноутбуке устанавливай именно собранную версию только из binrepo:

```bash
version=REPLACE_WITH_SELECTED_VERSION

doas emerge --ignore-default-opts --getbinpkg --usepkgonly \
    --ask --verbose --oneshot "=sys-kernel/gentoo-kernel-${version}"
```

`--usepkgonly` запрещает source fallback. Если нет GPKG ядра или `virtual/dist-kernel`, установка остановится до merge: вернись на builder, проверь завершение обоих buildpkg-only шагов и публикацию Packages index. Не убирай `--usepkgonly` для обхода ошибки: это может собрать ядро локально без подготовленного kernel flow.

Локальные патчи добавляют поддержку User-status LED и quirk микрофона гарнитуры. При переходе на новую версию сначала проверь, не появились ли эти изменения upstream и применяются ли патчи к новым исходникам; затем собирай GPKG. Подробное назначение патчей описано в [User-status indicator](../../hardware/user-status-indicator/) и [Headset microphone](../../hardware/headset-microphone/).

## От kernel package до systemd-boot

В Portage включены `savedconfig`, `modules-sign` и `modules-compress` для `sys-kernel/gentoo-kernel`; для `sys-kernel/installkernel` включены `systemd-boot`, `dracut`, `uki` и USE-capability `ukify`. Это не означает, что UKI генерирует ukify: фактический путь задаётся `/etc/kernel/install.conf`.

Файл: `/etc/portage/package.use/20-kernel-boot`.

```text
sys-kernel/gentoo-kernel      initramfs savedconfig modules-sign modules-compress -debug
sys-kernel/installkernel     systemd-boot ukify dracut uki -grub -efistub -ugrd -refind
```

На builder пакет ядра получает environment `workstation-kernel` через отдельную запись. Это compiler environment kernel build на builder, не userspace toolchain и не laptop `make.conf`.

Файл: `/etc/portage/package.env/61-workstation-kernel` на builder.

```text
sys-kernel/gentoo-kernel workstation-kernel
```

Файл: `/etc/portage/env/workstation-kernel` на builder.

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

`LLVM=1` и явные пути выбирают LLVM 23 как compiler/linker для kernel и host tools; `LLVM_IAS=1` выбирает integrated assembler. `KCFLAGS` и `KRUSTFLAGS` задают Alder Lake target для kernel C и Rust code. Это environment использует `-O2 -pipe`, без глобальных userspace ThinLTO и `-fuse-ld=lld` flags. Kernel `savedconfig` хранит конфигурацию и Linux module-signature settings; его точная версия хранится отдельно для каждого ebuild.

Файл: `/etc/kernel/install.conf`.

```ini
layout=uki
initrd_generator=dracut
uki_generator=dracut
```

При merge ядра `installkernel` передаёт новый kernel образ в `kernel-install`. Hook Dracut собирает initramfs и UKI; в этой конфигурации он запускает `dracut --uefi --no-ukify`. `/etc/dracut.conf.d/20-modules.conf` включает `systemd tpm2-tss crypt btrfs` и исключает ненужные `network nfs`. `/etc/dracut.conf.d/90-uki.conf` задаёт UEFI output, Secure Boot signing и cmdline для LUKS2/TPM2 и корневого Btrfs subvolume `@`. UUID дисков в документацию не копируй.

После генерации systemd `kernel-install` кладёт UKI в `/boot/EFI/Linux/`; hook `91-sbctl.install` подписывает итоговый EFI-файл. systemd-boot обнаруживает UKI по Type #2 и показывает его как отдельную запись. Отдельно проверь наличие нового UKI и запись загрузчика до перезагрузки:

```bash
doas ls -lh /boot/EFI/Linux/
bootctl list
doas sbctl verify
```

Ожидаются UKI новой версии в `/boot/EFI/Linux/`, запись `gentoo-<version>-bdsm.efi` в `bootctl list` и отсутствие ошибок проверки подписи. Если UKI не появился, проверь вывод `emerge`, `journalctl`/логи `kernel-install` и наличие смонтированного ESP в `/boot`; не перезагружайся в новую версию, пока образ не появился и проверка подписи не прошла. Оставь предыдущий рабочий UKI как fallback.

`modules-sign` и Secure Boot решают разные задачи. В versioned kernel `savedconfig` включены подпись и автоматическое подписание модулей; обязательная проверка подписи не включена:

```makefile
CONFIG_MODULE_SIG=y
CONFIG_MODULE_SIG_ALL=y
# CONFIG_MODULE_SIG_FORCE is not set
```

Эта подпись относится к `.ko` и проверяется ядром при загрузке модуля. Dracut/sbctl отдельно подписывают UKI как EFI PE image, который проверяет Secure Boot firmware. Подпись модулей не заменяет подпись UKI, а подпись UKI не подписывает отдельные внешние модули. Kernel runtime может дополнительно включить enforcement параметром `module.sig_enforce=1`; сама UKI-подпись этого не делает.

После запланированной перезагрузки проверь `uname -r`, `bootctl status` и доступность LUKS-разблокировки. Ожидаются новая версия с суффиксом `-bdsm`, выбранный UKI и обычный запуск системы. Если загрузка не удалась, выбери предыдущую рабочую запись в systemd-boot и вернись к проверке нового kernel config/UKI до следующей попытки.

## Память и кэши сборки

Файл: `/etc/systemd/zram-generator.conf`.

```ini
[zram0]
zram-size =ram / 2
compression-algorithm = zstd
swap-priority = 100
fs-type = swap
```

Это создаёт zram swap размером в половину RAM с `zstd` и priority `100`. Kernel savedconfig содержит `# CONFIG_ZSWAP is not set`, поэтому отдельный zswap backend не используется.

Файл: `/etc/sysctl.d/99-memory.conf`.

```ini
vm.swappiness = 100
```

`swappiness=100` — относительная политика reclaim для swap в RAM, а не процент занятой памяти и не порог включения swap.

Для компиляции C/C++ в `/etc/portage/make.conf` включён ccache с каталогом `/var/tmp/ccache` и лимитом `20G`. Rust использует `RUSTC_WRAPPER=/usr/bin/sccache`, кэш `/var/tmp/sccache` с лимитом `20G` и Unix socket `/var/tmp/sccache/sccache.sock`, обслуживаемый `sccache-portage.service`. Это локальные build caches; они не передают исходники builder и не распределяют компиляцию.

Для тяжёлых сборок `package.env/10-performance` назначает `ssd`, который переносит `PORTAGE_TMPDIR` в `/var/tmp/portage-disk`. У остальных пакетов остаётся стандартный `PORTAGE_TMPDIR` Portage. Если сборка заканчивается нехваткой места, проверь `df -h /var/tmp /var/tmp/portage-disk /var/tmp/ccache /var/tmp/sccache` и убедись, что нужный пакет действительно получил environment `ssd`.

## Связанные документы

- [gentoo-builder-01](../../../gentoo-builder-01/) — builder target и публикация GPKG.
- [UKI через Dracut](../../../../installation/systemd-uki-setup/) — общая конфигурация генерации UKI.
- [CPU optimization](../../hardware/cpu-optimization/) — workstation Alder Lake и переносимый builder target.
- [Portage usersync troubleshooting](../../../../troubleshooting/portage-usersync-repository-ownership/) — rsync status `23` и ownership Gentoo repository.
- [Gentoo Binary Package Guide](https://wiki.gentoo.org/wiki/Binary_package_guide) и [Portage emerge manual](https://dev.gentoo.org/~zmedico/portage/doc/man/emerge.1.html) — выбор и установка GPKG.
- [USE-флаг Gentoo `hostonly`](https://packages.gentoo.org/useflags/hostonly) — выбор микрокода Intel для процессора, доступного во время сборки.
- [Linux kernel module signing](https://docs.kernel.org/admin-guide/module-signing.html) — подписи `.ko` и режим их проверки.
- [systemd kernel-install](https://freedesktop.org/software/systemd/man/latest/kernel-install.html), [systemd-boot](https://www.freedesktop.org/software/systemd/man/latest/systemd-boot.html) и [Dracut](https://man7.org/linux/man-pages/man8/dracut.8.html) — hooks, UKI и загрузочные записи.
