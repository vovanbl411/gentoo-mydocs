---
title: "Второй NVMe: план хранения данных и резервных копий"
kind: system
scope: system
status: draft
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

## Текущее состояние

План не применён. Сейчас Gentoo загружен с основного NVMe; второй NVMe Micron
2450 (476,9G в выводе `lsblk`) всё ещё содержит один раздел GPT типа `8304`
с `LUKS2` старого Arch; раздел не смонтирован. UUID совпадает с
`rd.luks.name` в старых Arch UKI; в заголовке LUKS2 два keyslot: один связан с
`systemd-tpm2` token, другой — нет. Текущая запись загрузки — Gentoo, но
default entry — `arch-linux-cachyos.efi`, который ссылается на этот второй
диск. ESP находится на основном NVMe. Записей для второго диска в
`/etc/crypttab` и `/etc/fstab` нет; пакеты `btrbk` и `Borg` не установлены,
отдельного backup service или timer для них нет.

Дата в метаданных относится к проверке этого состояния и применимости плана,
а не к реализации целевой схемы.

## Целевая схема

```text
второй NVMe
└─ GPT: один раздел Linux LUKS
   └─ LUKS2
      ├─ TPM2 unlock, PCR 7
      ├─ passphrase keyslot для recovery
      └─ расшифрованный payload: Btrfs
         ├─ @data   → /home/<username>/data
         └─ @backup → /mnt/backup
```

- Второй диск не входит в `initramfs` и не является boot dependency. Отсутствие
  диска или ошибка TPM unlock не должны останавливать загрузку или вызывать
  интерактивный запрос пароля.
- `@data` обычно смонтирован как дополнительное хранилище.
- `@backup` имеет `noauto` и монтируется только на время backup job.
- RAID не используется. `@data` не считается источником уникальных данных;
  критичным данным нужна отдельная копия вне этого ноутбука.
- `@backup` — `soft-cold`: обычный userspace не видит его вне backup window,
  но root может открыть контейнер и смонтировать subvolume. Это не защита от
  root compromise.

## Что сохраняется

| Источник | Назначение | Инструмент | Примечание |
|---|---|---|---|
| Корневой subvolume `@` (`/`) | `@backup/gentoo` | `btrbk` | Отдельные subvolume (`/home`, `/var/log`, кэши, `/.snapshots`) не входят |
| `/home/<username>` | `@backup/home.borg` | `Borg 1.x` | Шифрованный архив и согласованный exclude-файл |
| `/etc` | `@backup/etc.borg` | `Borg 1.x` | Отдельный архив для восстановления файлов |

Архив `/home` включает чувствительные файлы, например `~/.ssh` и `~/.gnupg`,
поэтому `Borg` остаётся зашифрованным. Локальная копия не заменяет
external/off-device backup; passphrase и экспортированные ключи репозиториев
хранятся вне второго NVMe.

## Подготовка и реализация

### 1. Подтвердить диск и ESP

Имена `/dev/nvme0n1` и `/dev/nvme1n1` показывают текущий порядок устройств,
но не определяют диск для destructive-команд. Выбери второй NVMe по
`/dev/disk/by-id/` и каждый раз сверь модель, serial, размер, WWN, symlink и
разметку:

```bash
lsblk -d -o NAME,MODEL,SERIAL,SIZE,WWN
ls -l /dev/disk/by-id/ | grep nvme
readlink -f "/dev/disk/by-id/<SECOND-NVME>"
doas sgdisk -p "/dev/disk/by-id/<SECOND-NVME>"
```

До любой команды `wipefs`, `sgdisk`, `cryptsetup luksFormat` или `mkfs`
подтверди, что это именно второй диск, что на нём ожидается старый Arch LUKS
и что неизвестных разделов или данных нет. `/dev/nvme0n1` сам по себе не
является идентичностью; используй выбранный путь из `/dev/disk/by-id/`.

Отдельно подтверди расположение ESP и её содержимое:

```bash
doas bootctl status --no-pager
doas bootctl list --no-pager
doas find /boot/EFI -type f -printf '%p\n'
```

ESP должна оставаться на основном NVMe, а не на диске, который будет стёрт.
До стирания подтверди, что Gentoo выбран записью загрузки по умолчанию.
Сейчас default указывает на старый Arch UKI, поэтому сначала отдельно
переключи default на Gentoo по ID из `bootctl list` и проверь загрузку:

```bash
doas bootctl set-default "<CONFIRMED-GENTOO-UKI-ID>"
doas bootctl status --no-pager
```

Если Gentoo не загружается, не стирай диск; сначала восстанови прежний default
и устрани проблему загрузки.
Если ESP находится не на основном NVMe или разметка отличается от ожидаемой,
остановись и пересмотри план до любых изменений.

### 2. Спасти данные старого Arch

Сначала выбери нужные файлы старой системы. Например: `/etc`, `~/.ssh`,
`~/.gnupg`, проекты и другие уникальные данные. Копию держи в `root-only`
каталоге на уже зашифрованном системном диске:

```bash
doas install -d -m 0700 -o root -g root /root/arch-rescue
doas cryptsetup open --type luks --readonly \
  "/dev/disk/by-id/<SECOND-NVME>-part1" cryptarch-ro
doas mkdir -p /mnt/arch
doas mount -o ro,subvol=@ /dev/mapper/cryptarch-ro /mnt/arch

ls -la /mnt/arch/home
doas cp -a /mnt/arch/etc /root/arch-rescue/
doas cp -a "/mnt/arch/home/<arch-user>/.ssh" /root/arch-rescue/
```

Добавь только нужные данные; проверь наличие, владельцев и чтение каждого
важного файла. Затем закрой rescue mount и mapping:

```bash
doas umount /mnt/arch
doas cryptsetup close cryptarch-ro
```

**Destructive gate:** не стирай диск, пока rescue-копия не проверена и ты
отдельно не подтвердил уничтожение старого Arch.

Не удаляй `/root/arch-rescue` после настройки диска. Удали её вручную только
после успешного restore test новой схемы и отдельного решения, что старые
данные больше не нужны.

### 3. Очистить ESP отдельно (необязательно)

Удаление старых Arch UKI — отдельный cleanup gate; оно не требуется для
переразметки второго NVMe. Сначала сверь записи загрузчика и полный список
файлов. Удаляй только конкретные файлы, принадлежность которых Arch
подтверждена:

```bash
doas bootctl list --no-pager
doas find /boot/EFI -type f -printf '%p\n'
doas rm -v "/boot/EFI/Linux/<CONFIRMED-ARCH-UKI>"
```

Не используй wildcard для удаления UKI.

### 4. Создать GPT и `LUKS2`

Перед продолжением повтори identity gate из шага 1 и проверь, что rescue gate
пройден. После этого подставь подтверждённый by-id путь:

```bash
DISK="/dev/disk/by-id/<CONFIRMED-SECOND-NVME>"

doas wipefs -a "$DISK"
doas sgdisk --zap-all "$DISK"
doas sgdisk --new=1:0:0 --typecode=1:8309 "$DISK"
doas udevadm settle
doas sgdisk -p "$DISK"
test -b "$DISK-part1"
```

Создай `LUKS2`. Passphrase, заданный при `luksFormat`, остаётся независимым
recovery-путём; сохрани его вне этого диска. Затем добавь `TPM2` enrollment
по принятой политике `PCR 7`. TPM enrollment зависит от выбранной PCR policy;
сохраняй passphrase на случай, если автоматический unlock станет недоступен
после изменения состояния firmware или Secure Boot.

```bash
doas cryptsetup luksFormat --type luks2 --pbkdf argon2id "$DISK-part1"
doas systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 "$DISK-part1"
```

До продолжения проверь LUKS metadata локально, не публикуя token blobs.
Определи keyslot с passphrase, не связанный с TPM token, и проверь именно его:

```bash
doas cryptsetup luksDump "$DISK-part1"
doas cryptsetup open --test-passphrase --key-slot "<PASSPHRASE-SLOT>" \
  "$DISK-part1"
```

Passphrase test должен завершиться успешно без открытия mapping. Если он не
проходит — остановись; TPM token не заменяет recovery keyslot.

### 5. Создать `Btrfs` и subvolumes

Открой контейнер, создай `Btrfs` без RAID и ровно два subvolume:

```bash
doas cryptsetup open --type luks "$DISK-part1" cryptdata
doas mkfs.btrfs -L backup /dev/mapper/cryptdata
doas mkdir -p /mnt/cryptdata-root
doas mount /dev/mapper/cryptdata /mnt/cryptdata-root
doas btrfs subvolume create /mnt/cryptdata-root/@data
doas btrfs subvolume create /mnt/cryptdata-root/@backup
doas blkid -s UUID -o value /dev/mapper/cryptdata
doas umount /mnt/cryptdata-root
```

### 6. Настроить `/etc/crypttab` и `/etc/fstab`

Файл: `/etc/crypttab`

```text
cryptdata UUID=<LUKS-UUID> none luks,tpm2-device=auto,nofail,headless=yes
```

`headless=yes` запрещает интерактивный запрос пароля, а `nofail` делает
разблокировку нефатальной для загрузки. `PCR 7` задан при
`systemd-cryptenroll` и хранится в `LUKS2` token metadata.

Файл: `/etc/fstab`

```text
UUID=<BTRFS-UUID> /home/<username>/data btrfs rw,noatime,compress=zstd:3,ssd,space_cache=v2,subvol=@data,nofail 0 0
UUID=<BTRFS-UUID> /mnt/backup btrfs rw,noatime,compress=zstd:3,ssd,space_cache=v2,subvol=@backup,noauto,nofail 0 0
```

`nofail` нужен и на mount, который зависит от cryptdata: одного `nofail` в
crypttab недостаточно. `@data` будет монтироваться при обычной загрузке;
`@backup` останется unmounted до запуска backup service.
TRIM через LUKS не включён; добавление `discard` в crypttab — отдельное
решение с последствиями для конфиденциальности.

Создай root-owned точки монтирования. Для `@data` меняй владельца только
после успешного mount, чтобы при недоступном диске запись не уходила
незаметно в каталог на системном диске:

```bash
doas install -d -m 0755 -o root -g root "/home/<username>/data" /mnt/backup
doas systemctl daemon-reload
doas systemctl start systemd-cryptsetup@cryptdata
doas mount "/home/<username>/data"
findmnt --mountpoint "/home/<username>/data"
doas chown "<username>:<username>" "/home/<username>/data"
```

### 7. Установить инструменты и настроить `btrbk`

Пакеты в Gentoo сейчас не установлены. Установи их перед настройкой backup:

```bash
doas emerge -av app-backup/btrbk app-backup/borgbackup
```

Файл: `/etc/btrbk/btrbk.conf`

```text
snapshot_preserve_min   latest
snapshot_preserve       14d 4w 6m
target_preserve_min     latest
target_preserve         14d 4w 6m
loglevel                info
snapshot_dir            /.snapshots/btrbk

subvolume /
  snapshot_name root
  target send-receive /mnt/backup/gentoo
```

/ — уже смонтированный root subvolume Gentoo. Подготовь snapshot directory,
смонтируй `@backup` и подтверди правильную точку монтирования:

```bash
doas mkdir -p /.snapshots/btrbk
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
```

Убедись, что смонтирован Btrfs subvolume `@backup` второго диска. Иначе
остановись: нельзя создавать target в обычном каталоге `/mnt/backup` на root.
После проверки создай target directory и проверь конфигурацию/dry-run:

```bash
doas mkdir -p /mnt/backup/gentoo
doas btrbk config print
doas btrbk run -n
doas umount /mnt/backup
```

Backup service ниже запускает `btrbk` run. После первого run проверь наличие
полученного subvolume в `@backup/gentoo`, прочитай из него выбранный файл и
проверь, что путь восстановления понятен.

### 8. Настроить `Borg 1.x`

Смонтируй `@backup` и проверь, что `findmnt` показывает Btrfs subvolume
`@backup` второго диска. Если это не так, остановись: репозитории нельзя
создавать в обычном каталоге `/mnt/backup` на системном диске.

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
```

После этой проверки создай два зашифрованных репозитория. Экспортируй ключи
за пределы второго NVMe; passphrase сохрани в password manager и в
`root-only` файле для automation:

```bash
doas borg init --encryption=repokey /mnt/backup/home.borg
doas borg init --encryption=repokey /mnt/backup/etc.borg
doas borg key export /mnt/backup/home.borg "<OFF-DEVICE-PATH>/home.borg.key"
doas borg key export /mnt/backup/etc.borg "<OFF-DEVICE-PATH>/etc.borg.key"

doas install -d -m 0700 -o root -g root /etc/borg
doas install -m 0600 -o root -g root /dev/null /etc/borg/passphrase
doas umount /mnt/backup
```

Запиши `Borg` passphrase в `/etc/borg/passphrase`; файл должен иметь режим
0600 и владельца root:root.

Файл: `/etc/borg/home.exclude`

```text
home/<username>/data/
home/<username>/.cache/
home/<username>/llvm-project/
home/<username>/llvm-for-bolt-perf/
home/<username>/Downloads/
home/<username>/.steam/
home/<username>/.local/share/Trash/
*/.venv
*/__pycache__
*/node_modules
*.pyc
```

Это принятые исключения для /home; data/ обязателен, потому что находится
на том же физическом диске, что и репозитории. `--exclude-caches` остаётся
отдельной опцией `Borg`. Перед первым backup проверь этот же exclude-файл
через `borg create --dry-run --list --filter x` и подтверди, что
`home/<username>/data/` показан как исключённый.

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
```

Убедись, что `findmnt` показывает Btrfs subvolume `@backup` второго диска;
если mount не подтвердился, остановись. Затем проверь исключения и отключи
mount:

```bash
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' borg create --dry-run --list \
  --filter x \
  --exclude-from /etc/borg/home.exclude --exclude-caches \
  /mnt/backup/home.borg::dryrun "/home/<username>"
doas umount /mnt/backup
```

### 9. Настроить один backup service и timer

Файл: `/usr/local/bin/second-disk-backup.sh`

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_TARGET=/mnt/backup
REPO_HOME=$BACKUP_TARGET/home.borg
REPO_ETC=$BACKUP_TARGET/etc.borg
export BORG_PASSCOMMAND='cat /etc/borg/passphrase'
mounted_by_us=0

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if (( mounted_by_us )) && findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
    umount "$BACKUP_TARGET" || rc=1
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
  echo "ERROR: $BACKUP_TARGET is already mounted; investigate first" >&2
  exit 1
fi

mount "$BACKUP_TARGET"
mounted_by_us=1
btrbk run

STAMP=$(date +%Y-%m-%d_%H-%M-%S)
borg create --stats --exclude-from /etc/borg/home.exclude --exclude-caches \
  "$REPO_HOME::home-$STAMP" "/home/<username>"
borg create --stats --exclude-caches \
  "$REPO_ETC::etc-$STAMP" /etc

for repo in "$REPO_HOME" "$REPO_ETC"; do
  borg prune --keep-daily 14 --keep-weekly 4 --keep-monthly 6 "$repo"
  borg compact "$repo"
done
```

set -e сохраняет ошибку `btrbk`/`Borg`, а EXIT trap пытается отмонтировать
`@backup` при успехе, ошибке команды и обработанных SIGINT/SIGTERM. Ошибка
umount также даёт ненулевой exit status; systemd покажет service как failed.
Не добавляй || true к backup-командам.

Файл: `/etc/systemd/system/second-disk-backup.service`

```ini
[Unit]
Description=Second-disk backup orchestration (btrbk + Borg)

[Service]
Type=oneshot
ExecStart=/usr/local/bin/second-disk-backup.sh
IOSchedulingClass=idle
Nice=10
```

Файл: `/etc/systemd/system/second-disk-backup.timer`

```ini
[Unit]
Description=Daily second-disk backup (btrbk + Borg)

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Один `Type=oneshot` service не запускает параллельную копию, пока предыдущая
ещё активна; timer использует этот же unit. Включай timer только после
ручной проверки первого backup и restore:

```bash
doas chmod 0755 /usr/local/bin/second-disk-backup.sh
doas systemctl daemon-reload
doas systemctl enable --now second-disk-backup.timer
systemctl list-timers second-disk-backup.timer
```

## Проверка готовности

Схему можно считать принятой только после этих проверок:

- passphrase проверен отдельно на его LUKS keyslot; `TPM2` unlock прошёл;
- Gentoo выбран по умолчанию и normal boot успешен: `@data` смонтирован,
  `@backup` вне backup job не смонтирован;
- отдельно проверено, что отсутствие диска или TPM unlock failure не ломает
  загрузку и не вызывает интерактивный prompt; `@data` при этом не принимает
  запись в root-owned mountpoint на системном диске;
- `btrbk config print` и `btrbk run -n` успешны; полученный snapshot читается,
  а restore path проверен;
- `borg list` показывает архивы, `borg extract --dry-run` может прочитать
  выбранный архив, exclude проверен, ключи сохранены вне второго диска;
- выполнен небольшой реальный restore `Borg` в пустой временный каталог;
- после успешного и неуспешного backup `@backup` unmounted либо service
  завершился с видимой ошибкой.

Не проверяй отказ диска удалением ключей или другими destructive-тестами.
Failure-case boot проверяется отдельно по безопасному плану реализации.

Для проверки `Borg` после backup смонтируй `@backup` и подтверди, что
`findmnt` показывает этот subvolume второго диска:

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' borg list /mnt/backup/etc.borg
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' \
  borg extract --dry-run "/mnt/backup/etc.borg::etc-<STAMP>" etc/fstab
doas install -d -m 0755 -o root -g root /tmp/borg-restore-test
cd /tmp/borg-restore-test
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' \
  borg extract "/mnt/backup/etc.borg::etc-<STAMP>" etc/fstab
doas cat etc/fstab
cd /
doas umount /mnt/backup
```

Проверь восстановленный файл и затем вручную удали временный каталог.

## Откат и восстановление

Чтобы отключить схему, останови и отключи timer, убери только добавленные
cryptdata/`Btrfs` строки из `/etc/crypttab` и `/etc/fstab`, затем выполни
systemctl daemon-reload. Перед закрытием mapping убедись, что оба subvolume
unmounted. После стирания диска старый Arch с него восстановить нельзя;
до destructive gate данные должны быть проверены в `/root/arch-rescue`.

---

Источники: [systemd crypttab(5)](https://www.freedesktop.org/software/systemd/man/latest/crypttab.html),
[systemd-cryptenroll(1)](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html),
[cryptsetup open(8)](https://man7.org/linux/man-pages/man8/cryptsetup-open.8.html),
[fstab(5)](https://man7.org/linux/man-pages/man5/fstab.5.html),
[systemd.mount(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html),
[systemd.service(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html),
[systemd.timer(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html),
[bootctl(1)](https://www.freedesktop.org/software/systemd/man/latest/bootctl.html),
[Btrfs subvolumes](https://btrfs.readthedocs.io/en/latest/Subvolumes.html),
[btrbk(1)](https://digint.ch/btrbk/doc/btrbk.1.html),
[btrbk.conf(5)](https://digint.ch/btrbk/doc/btrbk.conf.5.html),
[Borg 1.4 create](https://borgbackup.readthedocs.io/en/stable/usage/create.html),
[extract](https://borgbackup.readthedocs.io/en/stable/usage/extract.html) и
[prune](https://borgbackup.readthedocs.io/en/stable/usage/prune.html),
[Gentoo app-backup/btrbk](https://packages.gentoo.org/packages/app-backup/btrbk) и
[app-backup/borgbackup](https://packages.gentoo.org/packages/app-backup/borgbackup).

Общие правила Btrfs, загрузки и TPM: [Btrfs setup](../../../../filesystem/btrfs-setup/),
[systemd UKI setup](../../../../installation/systemd-uki-setup/) и
[Secure Boot и TPM](../../../../installation/secure-boot-tpm/).
