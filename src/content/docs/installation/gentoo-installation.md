---
title: Ручная установка Gentoo amd64
kind: guide
scope: general
status: current
last_verified: "2026-10-09"
verified_on: [gentoo-builder-01]
---

## Результат и границы руководства

Этот путь ведёт от LiveCD к загружающейся Gentoo amd64: разметка,
проверенный stage3, chroot, Portage/profile bootstrap, базовая конфигурация,
ядро с Dracut initramfs, GRUB и успешный first boot с целевого диска.
Проверенная ветка — **BIOS + GPT + GRUB `i386-pc`**, ext4 и systemd.

Руководство предназначено для установки Gentoo amd64 с нуля, в том числе
на другой ноутбук. Проверенный пример использует BIOS + GPT, ext4,
hardened/systemd и переход на no-multilib. Boot mode, диск, CPU target и
профиль нужно выбрать для своей машины. Ветка UEFI пока не проверена здесь.

До начала нужны загруженный Gentoo LiveCD, работающая сеть и DNS, корректные
дата/время для HTTPS, достаточно места на диске и резервная копия данных,
которые требуется сохранить. Команды выполняются **от root** в LiveCD,
а после входа в chroot в разделе 6 — внутри него до явно указанного выхода.
Для установки команды приведены без `doas`; после first boot
административные действия обычного пользователя используют `doas`. При ошибке остановись и выясни причину, прежде
чем выполнять следующий этап.

Проверки предоставлены владельцем: bootstrap пройден дважды 2026-10-08,
base installation и first boot приняты 2026-10-09 на `gentoo-builder-01`.
Это пример проверки процедуры;
[состояние конкретной системы](../../systems/gentoo-builder-01/) ведётся
отдельно. [Настройка базовой системы](../base-system/) описывает последующую
Portage/toolchain policy и не является конфигурацией для этого bootstrap.

## 1. Live environment: определить диск и boot mode

Сначала выясни, где работаешь и какой диск будет установленной системой.
Это предотвращает разметку чужого диска и выбор неподходящего boot layout.
`lscpu` и `free -h` помогают оценить CPU и RAM, если эти параметры неизвестны.

```bash
lscpu
free -h
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINTS,MODEL
findmnt /
if [ -d /sys/firmware/efi ]; then
    echo UEFI
else
    echo BIOS
fi
fdisk -l
```

`findmnt /` показывает корень **LiveCD**, а не будущей Gentoo. Новый root
появится в `/mnt/gentoo` после монтирования. Проверка `/sys/firmware/efi`
определяет режим текущей загрузки установочного носителя; она не говорит,
какие режимы вообще поддерживает прошивка машины.

**PASS:** целевой диск однозначно определён по размеру, модели и текущим
разделам; boot mode известен; текущий `/` распознан как Live environment.
В проверенном примере это BIOS, `/dev/sda` размером 100 GiB и примерно
16 GiB RAM. Эти значения не являются требованиями установки.

> **Важно:** во всех дальнейших примерах `/dev/sda` — выбранный целевой
> диск. На своей машине замени его и пути разделов; например, разделы
> `/dev/nvme0n1` называются `/dev/nvme0n1p1`, а не `/dev/nvme0n11`.

## 2. Разметка: проверенный BIOS + GPT layout

Boot mode определяет служебный загрузочный раздел. В этом BIOS + GPT примере
резервируется BIOS Boot Partition для будущего BIOS-загрузчика, затем swap
и root. Сам загрузчик на этом этапе не устанавливается.

| Раздел примера | Размер | Назначение |
|----------------|--------|------------|
| `/dev/sda1` | 1 MiB | BIOS Boot Partition, без файловой системы |
| `/dev/sda2` | 8 GiB | Linux swap |
| `/dev/sda3` | Остаток диска | Linux filesystem / будущий root |

8 GiB swap — выбранный размер примера, не универсальная формула по RAM.
`fdisk`, `parted` и GParted — альтернативные инструменты: важен итоговый
layout. Здесь `sfdisk` выбран для воспроизводимого CLI-примера.

> ⚠️ **Важный нюанс:** следующая команда перезаписывает таблицу разделов
> выбранного диска. Считай его существующее содержимое уничтоженным;
> дальнейшее форматирование перезапишет данные разделов. До выполнения
> проверь `/dev/sda` ещё раз и сохрани нужные данные на другом носителе.
> Откат после перезаписи и форматирования — восстановление из резервной
> копии; автоматического безопасного undo нет. Целевой диск не должен
> содержать используемые LiveCD mountpoints или активный swap.

Пример рассчитан на **логические секторы по 512 байт**, что видно в
`fdisk -l /dev/sda`. При другом размере сектора эти числовые смещения и размеры
нельзя копировать: пересчитай layout до записи. `unit: sectors` задаёт
единицу `start` и `size`; 2048 таких секторов — 1 MiB, 16777216 — 8 GiB.
Последний раздел занимает доступный остаток диска.

```bash
sfdisk /dev/sda <<'EOF'
label: gpt
unit: sectors

start=2048,     size=2048,     type=21686148-6449-6E6F-744E-656564454649
start=4096,     size=16777216, type=0657FD6D-A4AB-43C4-84E5-0933C84B4F4F
start=16781312,                type=0FC63DAF-8483-4772-8E79-3D69D8477DE4
EOF
```

GUID в `type=` обозначают **тип GPT-раздела**, а не идентификатор файловой
системы: первый — BIOS Boot, второй — Linux swap, третий — Linux filesystem.
BIOS Boot Partition не нужно форматировать или монтировать.

Для **UEFI** вместо BIOS Boot Partition потребуется EFI System Partition
(ESP) и соответствующая UEFI-ветка загрузчика. Этот BIOS layout нельзя
переносить в UEFI-установку без изменения. Размер, форматирование ESP и
установка UEFI-загрузчика будут документироваться и проверяться отдельно.

Проверка после записи:

```bash
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,PARTTYPENAME,PARTTYPE
fdisk -l /dev/sda
```

**PASS:** таблица GPT, три раздела в указанном порядке, размеры и GUID types
соответствуют выбранному layout, разделы не перекрываются. Значения FSTYPE
и LABEL проверяются после форматирования; GPT type сам по себе не создаёт
файловую систему.

## 3. Файловая система и swap

Создай ext4 для Gentoo root и swap для подкачки, затем подключи их к LiveCD.
`/mnt/gentoo` станет местом распаковки stage3.

> **Важно:** `mkswap` и `mkfs.ext4` перезаписывают содержимое соответствующих
> разделов. Перед выполнением сверь `/dev/sda2` и `/dev/sda3` с результатом
> разметки. Восстановление прежних данных требует резервной копии.

```bash
mkswap -L gentoo-swap /dev/sda2
mkfs.ext4 -L gentoo-root /dev/sda3

swapon /dev/sda2
mkdir -p /mnt/gentoo
mount /dev/sda3 /mnt/gentoo
```

`-L` задаёт **LABEL файловой системы / swap**. GPT partition type задаёт
назначение раздела, а необязательный `PARTLABEL` — его имя в таблице GPT.
Это разные поля: отсутствие PARTLABEL не мешает установке.

Проверка:

```bash
lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
blkid /dev/sda2 /dev/sda3
swapon --show
findmnt /mnt/gentoo
```

**PASS:** `/dev/sda2` имеет TYPE `swap`, LABEL `gentoo-swap` и присутствует
в `swapon --show`; `/dev/sda3` имеет TYPE `ext4`, LABEL `gentoo-root` и
смонтирован в `/mnt/gentoo`. Служебный `/dev/sda1` остаётся без filesystem.

## 4. Stage3: скачать и проверить основу системы

Stage3 — минимальный Gentoo userspace: программы, библиотеки и начальные
конфиги, которые станут основой установленной системы. В проверенном пути
выбран вариант **amd64 / hardened / systemd**. Это осознанный выбор init
system и профиля, а не требование для любой Gentoo-установки.

Используй официальный каталог
[current-stage3-amd64-hardened-systemd](https://distfiles.gentoo.org/releases/amd64/autobuilds/current-stage3-amd64-hardened-systemd/).
Имя tarball извлекается из `latest-…txt`, поэтому инструкция не привязана
к timestamp одной сборки. Сохрани скачанные файлы для своей проверки.

В LiveCD, до входа в chroot:

```bash
cd /mnt/gentoo
STAGE_BASE="https://distfiles.gentoo.org/releases/amd64/autobuilds/current-stage3-amd64-hardened-systemd"
wget -O latest-stage3-amd64-hardened-systemd.txt \
  "$STAGE_BASE/latest-stage3-amd64-hardened-systemd.txt"
STAGE_PATH=$(awk '$1 ~ /\.tar\.xz$/ {print $1; exit}' \
  latest-stage3-amd64-hardened-systemd.txt)
STAGE3=${STAGE_PATH##*/}
printf '%s\n' "$STAGE3"
```

`awk` берёт путь архива из строки с `.tar.xz`; `${STAGE_PATH##*/}` оставляет
имя файла без каталога даты. Проверь, что вывод — непустое имя
`stage3-amd64-hardened-systemd-…tar.xz`, прежде чем продолжать.

```bash
wget "$STAGE_BASE/$STAGE3"
wget "$STAGE_BASE/$STAGE3.sha256"
wget "$STAGE_BASE/$STAGE3.asc"
gpg --import /usr/share/openpgp-keys/gentoo-release.asc
```

Release key импортируется из доверенного Gentoo LiveCD; здесь нужен публичный
ключ, не приватные ключи пользователя. Если LiveCD не содержит этот файл,
остановись и проверь источник ключа по Gentoo Handbook. Не импортируй
произвольный ключ только ради исчезновения ошибки проверки.

`.sha256` содержит подписанный SHA256 checksum. Извлеки его с проверкой
подписи, затем сравни с архивом:

```bash
gpg --output "$STAGE3.sha256.verified" \
  --decrypt "$STAGE3.sha256"
sha256sum --check "$STAGE3.sha256.verified"
gpg --verify "$STAGE3.asc" "$STAGE3"
```

Здесь `--decrypt` читает clear-signed текст и проверяет его подпись;
это не расшифровка секретных данных. Используй `.verified` только после
успешного завершения GPG. Последняя команда отдельно проверяет detached
signature самого tarball. Форматы файлов и проверка подписи описаны в
[Gentoo Handbook: Stage](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Stage).

- **SHA256** проверяет целостность: архив совпадает с checksum. Сам по себе
  совпавший hash не доказывает, что файл выпущен Gentoo.
- **OpenPGP signature** проверяет подлинность относительно Gentoo release
  key. Основной результат cryptographic check — `Good signature` от
  ожидаемого release key и успешный код завершения GPG.
- Local GPG trust warning о том, что ключ не сертифицирован доверенной
  подписью, относится к локальной trust database. Он не означает invalid
  signature и не равнозначен `BAD signature`.

**PASS:** все загрузки завершились успешно; GPG подтвердил подписи checksum
и архива ожидаемым release key; `sha256sum` вывел для `$STAGE3` `OK`.
При несовпадении checksum, `BAD signature`, неизвестном или неожиданном
ключе архив не распаковывай: проверь источник и повтори загрузку/проверку.

## 5. Распаковать stage3

Распакуй проверенный архив в смонтированный root. В той же LiveCD shell
сохраняется переменная `STAGE3` из предыдущего этапа.

```bash
tar xpvf "$STAGE3" \
  --xattrs-include='*.*' \
  --numeric-owner \
  -C /mnt/gentoo
```

`x` извлекает файлы, `p` сохраняет permissions, `v` показывает ход распаковки,
`f` задаёт архив. `--xattrs-include='*.*'` задаёт включение extended attributes
при восстановлении; `--numeric-owner` сохраняет числовые UID/GID из архива,
не сопоставляя их с именами пользователей LiveCD. `-C` задаёт каталог
назначения. Распаковка от root нужна для сохранения владельцев и прав
системных файлов.

Проверка:

```bash
ls -ld \
  /mnt/gentoo/etc \
  /mnt/gentoo/usr \
  /mnt/gentoo/var \
  /mnt/gentoo/bin

cat /mnt/gentoo/etc/gentoo-release
ls -l /mnt/gentoo/etc/portage/make.conf
```

**PASS:** распаковка завершилась без ошибок; перечисленные пути существуют;
`gentoo-release` идентифицирует Gentoo, а stage3 `make.conf` доступен.
Это проверка структуры userspace; установленного ядра она не подтверждает.

## 6. Подготовить chroot и войти в новую систему

Chroot меняет root userspace процесса. Это **не VM**: процессы используют
тот же kernel LiveCD. Чтобы инструменты новой системы видели процессы,
устройства и runtime data, подключи `/proc`, `/sys`, `/dev` и `/run`.

В LiveCD:

```bash
mount --types proc /proc /mnt/gentoo/proc

mount --rbind /sys /mnt/gentoo/sys
mount --make-rslave /mnt/gentoo/sys

mount --rbind /dev /mnt/gentoo/dev
mount --make-rslave /mnt/gentoo/dev

mount --bind /run /mnt/gentoo/run
mount --make-slave /mnt/gentoo/run

cp --dereference /etc/resolv.conf /mnt/gentoo/etc/resolv.conf
```

`proc` монтируется как отдельная виртуальная файловая система.
`--rbind` переносит также вложенные mountpoints, `--bind` — сам mount.
Slave propagation допускает получение событий монтирования с исходной
стороны, но не позволяет изменениям внутри chroot распространяться обратно
в LiveCD. `--make-rslave` применяет это рекурсивно к вложенным mounts.
Это особенно важно при последующем размонтировании.

Копирование `resolv.conf` передаёт работающую resolver configuration LiveCD.
`--dereference` копирует содержимое файла по symlink, чтобы не оставить
в новой системе ссылку на недоступный путь. Это начальная DNS-настройка
для bootstrap, не завершённая настройка сети установленной системы.

Вход:

```bash
chroot /mnt/gentoo /bin/bash
source /etc/profile
export PS1="(chroot) ${PS1}"
```

`source /etc/profile` загружает окружение Gentoo, а PS1 добавляет заметную
метку контекста. До явно указанного выхода все дальнейшие команды выполняются внутри chroot.

```bash
cat /etc/gentoo-release
mountpoint /proc
mountpoint /sys
mountpoint /dev
mountpoint /run
getent hosts distfiles.gentoo.org
uname -r
```

**PASS:** вывод release идентифицирует Gentoo; четыре проверки `mountpoint` успешны;
`getent` возвращает адреса. `uname -r` показывает всё ещё kernel LiveCD:
chroot не загрузил ядро новой системы и не запустил её systemd как PID 1.

## 7. Начальный Portage bootstrap

Сначала сохрани исходный конфиг stage3, чтобы иметь точку сравнения и
возможность вернуть настройки до пересборки:

```bash
cp -a /etc/portage/make.conf /etc/portage/make.conf.stage3
emerge --sync
eselect news list
```

`cp -a` сохраняет атрибуты файла. `emerge --sync` получает актуальный Gentoo
repository, а `eselect news list` показывает сообщения о важных изменениях.
Прочитай применимые непрочитанные сообщения и выполни их требования перед
сменой профиля или сборкой.

Теперь выбери CPU policy. В проверенном примере заранее подтверждён общий
ISA contract **x86-64-v3**, поэтому использован следующий минимальный конфиг.
На другой машине CPU target нужно выбрать осознанно: CPU должен поддерживать
выбранные инструкции, иначе собранные программы могут не запускаться.
До такого выбора можно сохранить исходный `-O2 -pipe` stage3.

Файл внутри chroot: `/etc/portage/make.conf`.
**Пример для подтверждённого x86-64-v3 target:**

```makefile
COMMON_FLAGS="-march=x86-64-v3 -O2 -pipe"

CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"
FCFLAGS="${COMMON_FLAGS}"
FFLAGS="${COMMON_FLAGS}"

LC_MESSAGES=C.UTF-8
```

`-march` задаёт допустимый ISA target, `-O2` — уровень оптимизации,
`-pipe` — передачу промежуточных данных компиляции через pipes.
Четыре переменные передают общий набор флагов C, C++ и Fortran;
`LC_MESSAGES` задаёт язык сообщений.

На этом этапе не добавлялись LLVM/Clang, ThinLTO, LLD, Rust flags, Go flags,
`CPU_FLAGS_X86`, глобальная USE policy, compiler caches или binpkg configuration.
Они требуют отдельных решений и проверки после bootstrap.

Проверка:

```bash
portageq envvar COMMON_FLAGS CFLAGS CXXFLAGS FCFLAGS FFLAGS
```

**PASS:** sync завершился без ошибок, news просмотрены, backup существует,
Portage показывает выбранные флаги во всех пяти строках. В проверенном
примере каждая строка — `-march=x86-64-v3 -O2 -pipe`.
Это проверка конфигурации, а не доказательство уже пересобранного userspace.

## 8. Выбрать профиль

Профиль задаёт базовые настройки Portage, включая ABI и USE defaults.
Проверенный stage3 начал с:

```text
default/linux/amd64/23.0/hardened/systemd
```

Целевой профиль примера — чистая 64-bit система без multilib:

```text
default/linux/amd64/23.0/no-multilib/hardened/systemd
```

No-multilib выбирай только если не нужны 32-bit библиотеки и приложения.
Обратный переход после пересборки не сводится к возврату symlink профиля;
это отдельная сложная миграция. Если нужен multilib, сохрани соответствующий
профиль — no-multilib не является общим требованием этого руководства.

Найди целевой путь в актуальном списке:

```bash
eselect profile list
```

Запиши прежний путь/номер для возврата **до пересборки**, затем подставь
номер выбранного профиля из этого списка вместо `<number>`:

```bash
eselect profile set <number>
```

Номер не фиксируется: даже если одна установка показывала `12`, на другой
нужно сверять путь, а не копировать индекс. Проверь результат:

```bash
eselect profile show
readlink -f /etc/portage/make.profile
portageq envvar ABI_X86
```

**PASS для no-multilib примера:** выбран именно целевой путь, symlink ведёт
в его каталог внутри Gentoo repository, `ABI_X86` равен `64`.
Смена профиля меняет policy, но ещё не пересобирает пакеты.

## 9. Пересобрать систему после смены профиля

Portage должен привести установленный набор пакетов к новому профилю.
Сначала посмотри resolver preview, чтобы выявить конфликты до изменения
системы:

```bash
emerge \
  --pretend \
  --verbose \
  --update \
  --deep \
  --newuse \
  --complete-graph \
  @world
```

`--pretend` только показывает план; `--verbose` раскрывает детали.
`--update --deep` рассматривают обновления и зависимости, `--newuse` учитывает
изменившуюся USE policy, а `--complete-graph` проверяет полный граф зависимостей.
`@world` включает выбранные пакеты и системный набор.

**PASS preview:** resolver завершился успешно, без нерешённых blockers или
конфликтов; план соответствует выбранному профилю. Только после этого
запускай реальную сборку и подтверждай предложенный план:

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

`--ask` требует подтверждения перед применением. Это может быть долгая
пересборка toolchain и библиотек; успешный preview не гарантирует успешную
компиляцию. При ошибке сохрани её вывод и исправь причину до продолжения.

После успешной сборки:

```bash
eselect profile show
portageq envvar ABI_X86
gcc -print-multi-lib
emerge --info | head -n 15

emerge \
  --pretend \
  --verbose \
  --update \
  --deep \
  --newuse \
  --complete-graph \
  @world
```

**PASS для проверенного no-multilib примера:**

- сборка завершилась без ошибок;
- профиль остаётся `default/linux/amd64/23.0/no-multilib/hardened/systemd`;
- `ABI_X86=64`;
- `gcc -print-multi-lib` выводит только `.;`;
- `emerge --info` соответствует выбранному окружению;
- final resolver показывает `Total: 0 packages`.

Нулевой план подтверждает завершение обновления при текущей policy и текущем
состоянии repository. Он не означает, что будущие sync не потребуют обновлений.

## 10. `/etc/fstab`

Для ext4 root и swap из примера задай постоянные mounts по LABEL.
Сначала сверь labels через `lsblk -o NAME,FSTYPE,LABEL`. На другой машине
используй свои labels и layout; одинаковые LABEL на подключённых дисках
недопустимы. Сохрани исходный `/etc/fstab`, затем замени его примерные
записи реальными, не дублируя уже существующие строки.

Файл: `/etc/fstab`.

```text
LABEL=gentoo-root / ext4 defaults 0 1
LABEL=gentoo-swap none swap sw 0 0
```
Проверь файл:

```bash
findmnt --verify --verbose
```
**PASS:** labels разрешаются в нужные разделы; проверка завершилась
с нулём errors/warnings. BIOS Boot Partition в fstab не включается;
в этом layout `/boot` — каталог на root, отдельного mount нет.

## 11. Hostname, timezone, locale и machine-id

Задай свой hostname в `/etc/hostname`. UTC и `C.UTF-8` — проверенные
значения примера, а не обязательный выбор для каждой машины.

```bash
printf '%s
' 'your-hostname' > /etc/hostname
ln -snf /usr/share/zoneinfo/UTC /etc/localtime
printf '%s
' 'LANG=C.UTF-8' > /etc/locale.conf
locale -a
```
Замени `your-hostname`. `C.UTF-8` должен быть доступен в `locale -a`;
для другого locale сначала настрой его генерацию.

**До first boot** инициализируй machine-id в целевой системе:

```bash
systemd-machine-id-setup
test -f /etc/machine-id &&
    test "$(wc -c < /etc/machine-id)" -eq 33 &&
    LC_ALL=C grep -Eq '^[0-9a-f]{32}$' /etc/machine-id &&
    ! grep -Eq '^0{32}$' /etc/machine-id
```
**PASS:** команда и проверка формата успешны. Не копируй ID LiveCD
или другой машины; не заменяй уже валидный machine-id. Если файл невалиден
и непуст, остановись и разбери его по
[networkd troubleshooting](../../troubleshooting/systemd-networkd-dhcp-machine-id/).
Здесь проверяется формат без вывода ID, не его уникальность. На проверенной
установке отсутствие валидного ID мешало запуску DHCPv4 client.

## 12. Постоянная сеть: networkd + resolved

Для wired DHCPv4 примера используется `ens18`. Определи своё имя через
`ip link`; настройка не подходит без адаптации для Wi-Fi или static addressing.
Убедись, что целевой systemd содержит networkd/resolved units. Конфигурация
LiveCD не становится постоянной автоматически.

Файл: `/etc/systemd/network/20-wired.network` (создай каталог при необходимости).

```ini
[Match]
Name=ens18

[Network]
DHCP=ipv4
```
Разреши запуск при загрузке целевой системы:

```bash
systemctl enable systemd-networkd.service systemd-resolved.service
```
В chroot `enable` создаёт symlinks для следующего boot. Не используй
`--now`: PID 1 и работающая сеть пока принадлежат LiveCD.
DNS по DHCP будет передан systemd-resolved. Рабочую копию `/etc/resolv.conf`
сохрани до завершения всех package downloads; замена на stub symlink
выполняется в финальной проверке ниже.

## 13. Обычный пользователь, doas и SSH

Создай обычного пользователя с `wheel`. В проверенной VM это `vladimir`;
в командах выбери своё имя вместо `your-user`. Задай пароль для первого
входа. Держи доступ к VM/local console, пока удалённый вход не проверен.

```bash
INSTALL_USER="your-user"
useradd -m -G wheel -s /bin/bash "$INSTALL_USER"
passwd "$INSTALL_USER"
emerge --ask app-admin/doas net-misc/openssh
```
Если пользователь уже существует, проверь его через `id`, не создавай
вторую запись. Для doas задай проверенную policy:

Файл: `/etc/doas.conf`.

```text
permit persist :wheel
```
Ограничь права конфига и включи SSH:

```bash
chown root:root /etc/doas.conf
chmod 0600 /etc/doas.conf
doas -C /etc/doas.conf
ssh-keygen -A
sshd -t
systemctl enable sshd.service
```
**PASS:** doas configuration и `sshd -t` проходят, sshd enabled.
В проверенной установке сохранён рабочий способ login для first boot;
реальный SSH-вход принят после загрузки. Public-key/key-only access —
следующий отдельный этап. Не отключай рабочий login до проверки ключа
из второй SSH-сессии и сохранения console recovery.

## 14. Необязательно: QEMU Guest Agent

Только для Proxmox/QEMU guest, где agent channel включён на hypervisor:

```bash
emerge --ask app-emulation/qemu-guest-agent
```
Service может быть `static`: его не нужно принудительно `enable`.
Проверяй ACTIVE runtime и взаимодействие с host после boot.
Для обычной физической машины этот пакет не требуется.

## 15. Distribution kernel, Dracut и GRUB BIOS/GPT

Перед установкой ядра настрой installkernel и GRUB. Добавь или обнови
одну строку в `/etc/portage/make.conf`:

```makefile
GRUB_PLATFORMS="pc"
```
Файл: `/etc/portage/package.use/installkernel` (согласуй с имеющейся policy).

```text
sys-kernel/installkernel dracut grub systemd -efistub -refind -systemd-boot -ugrd -uki -ukify
```

Эта package-specific policy фиксирует BIOS/systemd/GRUB path: отдельный
Dracut initramfs, без UKI и альтернативных boot paths. `-ugrd` исключает
конфликт с `dracut`, даже если внешний/global USE включает другой generator.
Установи инструменты до kernel:

```bash
emerge --ask sys-kernel/installkernel sys-kernel/dracut sys-boot/grub
cat /usr/lib/kernel/install.conf
```
Ожидаемая конфигурация `/usr/lib/kernel/install.conf`:

```ini
layout=grub
initrd_generator=dracut
uki_generator=none
```
Это файл установленного пакета: не редактируй его вручную.
Если существует `/etc/kernel/install.conf`, проверь и его: local override
не должен противоречить выбранному path.

При global Clang/ThinLTO до установки kernel примени package-specific
[no-LTO/BFD policy для kernel helpers](../../troubleshooting/gentoo-stage3-clang-thinlto-transition/#6-gentoo-kernel-bin-thinlto-объекты-и-прямой-вызов-ldbfd).
Userspace ThinLTO policy сохраняется.

Установи stable distribution kernel:

```bash
emerge --ask sys-kernel/gentoo-kernel-bin
```
Проверенный пример — `sys-kernel/gentoo-kernel-bin-6.18.54`, runtime
`6.18.54-gentoo-dist-bin`. Это выбранная stable-версия builder;
согласовывать её с ядром другой машины не требуется. Installkernel должен
создать Dracut initramfs и разместить kernel в `/boot`.

Перед `grub-install` сверь целевой диск и BIOS Boot Partition снова.
Команда пишет загрузчик на **диск**, не на `/dev/sda1` или `/dev/sda3`.
Ошибка выбора диска может повредить загрузку другой системы; до применения
нужны backup и LiveCD для восстановления.

```bash
grub-install --target=i386-pc --recheck /dev/sda
grub-mkconfig -o /boot/grub/grub.cfg
ls -lh /boot
ls /lib/modules
grep -E '^[[:space:]]*(linux|initrd)' /boot/grub/grub.cfg
```
**PASS:** GRUB installation завершилась без ошибки; `grub.cfg` содержит
нужный kernel и существующий initramfs. Проверяй обе записи и наличие
файлов, не только exit status `grub-mkconfig`. В chroot `uname -r`
по-прежнему показывает LiveCD kernel.

## 16. Финальные проверки и reboot

Не выходи к reboot, пока все установки пакетов и проверки выше не завершены.
Теперь замени bootstrap DNS file на systemd-resolved stub symlink:

```bash
ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
readlink /etc/resolv.conf
findmnt --verify --verbose
systemctl is-enabled systemd-networkd systemd-resolved sshd
sshd -t
test -s /boot/grub/grub.cfg
```
Stub target может ещё отсутствовать внутри chroot: его создаст resolved
после boot. После замены не рассчитывай на bootstrap DNS для новых downloads.
Повтори machine-id format check из раздела 11; проверь hostname, timezone,
locale, user/wheel и boot files. Enabled units ещё не доказывают runtime.

Выйди из chroot, затем в LiveCD размонтируй target и отключи **его** swap:

```bash
exit
cd /
sync
umount -R /mnt/gentoo
swapoff /dev/sda2
findmnt -R /mnt/gentoo
swapon --show
reboot
```
Если unmount/swapoff не прошёл, остановись: найди использующие target
процессы и mountpoints. Не используй forced/lazy unmount как обычное решение.
После успешного unmount `findmnt` не должен находить target mounts;
`swapon --show` не должен показывать target swap. Выполняй `reboot` только
после этих проверок. В firmware/hypervisor поставь целевой диск первым
или извлеки ISO. Проверенный Proxmox boot order — `scsi0;ide2;net0`.

## 17. First-boot acceptance

После входа обычным пользователем проверь **загруженную целевую систему**:

```bash
uname -r
findmnt /
findmnt --verify --verbose
swapon --show
hostnamectl
timedatectl
locale
id
doas id -u
networkctl status ens18
ip -4 route
resolvectl status ens18
readlink /etc/resolv.conf
getent ahostsv4 gentoo.org
ping -4 -c 3 1.1.1.1
systemctl is-active systemd-networkd systemd-resolved sshd
systemctl is-enabled sshd
```
**PASS:** target kernel загружен, root и swap соответствуют fstab,
проверка fstab без errors/warnings; hostname/timezone/locale верны,
пользователь в wheel, `doas id -u` выводит `0`. Networkd сообщает
`routable (configured)` / `online`, есть DHCP default route, external IPv4
и DNS через resolved работают. Не используй прямой ping gateway как
единственный network gate: ICMP может блокироваться его firewall.

Проверь реальный SSH-вход **с другой машины**, заменив placeholders:

```bash
ssh <user>@<guest-address>
```
Проверь host key fingerprint через доверенную console перед принятием
нового SSH host key. Успешный login закрывает установочную SSH-проверку,
но не public-key/key-only acceptance.

Для QEMU guest дополнительно:

```bash
systemctl is-active qemu-guest-agent
systemctl is-enabled qemu-guest-agent
doas journalctl -b -u qemu-guest-agent --no-pager
```
**PASS:** agent ACTIVE и host действительно обращается к нему
(в проверенном случае journal содержит `guest-ping`). `static` в выводе
`is-enabled` не является ошибкой и не заменяет runtime check.

Результат этой ветки — загружающаяся Gentoo с базовым доступом и сетью.
Machine-id, MAC, filesystem UUID и transient DHCP IP из локальных выводов
не нужны для публикации verification.


## Остановка и восстановление

Если preview не проходит, сборку не запускай. До пересборки можно вернуть
прежний профиль через `eselect profile` и исходный `make.conf` из
`/etc/portage/make.conf.stage3`, затем повторить preview. После частичной
пересборки возврат одного конфига не возвращает старые пакеты; сначала
разбери причину ошибки, а при необходимости восстанови root из заранее
сделанной копии или начни установку заново с проверенного stage3.

При ошибке разметки/форматирования прекрати запись на диск. Восстановление
данных требует резервной копии; повторный запуск команд не является откатом.
Если chroot не имеет mounts или DNS, вернись в LiveCD shell и проверь
подготовку из раздела 6. При boot failure снова загрузи LiveCD, смонтируй
root и подготовь chroot; проверь fstab, kernel/initramfs и GRUB, исправь
причину и повтори boot. При networkd DHCP failure используй
[диагностику machine-id](../../troubleshooting/systemd-networkd-dhcp-machine-id/).

## Next steps

Base installation и first boot проверенного BIOS path завершены.
Следующий этап для SSH — public-key login и key-only access с отдельной
проверкой. Portage/toolchain policy адаптируется под назначение машины по
[настройке базовой системы](../base-system/); userspace Clang/ThinLTO
не является условием прохождения этого общего installation guide.
UEFI/systemd-boot ветка здесь пока не проверена.

## Источники

- [Gentoo AMD64 Handbook](https://wiki.gentoo.org/wiki/Handbook:AMD64).
- [Подготовка дисков](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Disks).
- [Stage3 и проверка загрузок](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Stage).
- [Chroot и выбор профиля](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Base).
- [sfdisk: script format и GPT types](https://man7.org/linux/man-pages/man8/sfdisk.8.html).

- [Installkernel](https://wiki.gentoo.org/wiki/Installkernel).
- [GRUB BIOS / bootloader](https://wiki.gentoo.org/wiki/Handbook:AMD64/Installation/Bootloader).
- [systemd-machine-id-setup(1)](https://www.freedesktop.org/software/systemd/man/latest/systemd-machine-id-setup.html).
