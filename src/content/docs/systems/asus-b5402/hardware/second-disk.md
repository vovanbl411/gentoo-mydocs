---
title: "Второй диск: бэкапы и дополнительное хранилище"
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Status

**PLAN — NOT APPLIED** (проверено аудитом 2026-09-22).

Текущее состояние машины:

- `nvme0n1` — единый LUKS-раздел со старым Arch Linux, не открыт;
- новая backup/data схема на втором диске не создана;
- `/etc/crypttab` для неё отсутствует;
- таймеры btrbk/borg не настроены;
- Arch UKI остаются в ESP.

Цель плана — подключить второй NVMe (`nvme0n1`, ранее — Arch Linux) как
зашифрованное хранилище для **бэкапов системы и конфигов** +
**дополнительного места под данные**. Без RAID, без вмешательства в
критический путь загрузки.

Перед выполнением заново проверь имена устройств, точки монтирования и
состояние обоих дисков.

## Applicability

На машине уже работает Gentoo на `nvme1n1` (LUKS2 + TPM2 + UKI + Btrfs), есть
второй физический диск `nvme0n1`, который хочется задействовать под бэкапы и
данные.

Контекст: подробности загрузочного стека — [installation/systemd-uki-setup](../../../../installation/systemd-uki-setup/) и [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/). Btrfs-соглашения — [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/).

## 1. Target design

Всё в этом разделе описывает состояние **после применения плана**, а не
текущую машину (текущее состояние — в Status выше).

### Ключевые принципы

- **Второй диск НЕ в initramfs.** Открывается через systemd `/etc/crypttab` уже после загрузки rootfs. Dracut/UKI/`rd.luks.*`/sbctl — **не трогаем**. Критический путь загрузки остаётся таким же надёжным.
- **Один LUKS2 + TPM2 (PCR 7)** — тот же TPM и тот же набор PCR, что у первого диска (PCR 7 — выбранная policy первого диска; эпизод 2026-09-14 описан в §6). Авторасшифровка при загрузке.
- **Soft-cold для бэкапов**: `@backup` монтируется `noauto`, systemd-юнит монтирует его только на время бэкапа и отмонтирует после. Защищает от ransomware в userspace (без root путь `/mnt/backup` недоступен).
- **`@data` горячий** — всегда смонтирован в `/home/<username>/data`, это рабочее хранилище.
- **btrbk для системы** (атомарные Btrfs-снапшоты `@`), **borg для `/home` и `/etc`** (точечный restore, дедупликация, шифрование, exclude-паттерны).

### Целевая схема

```text
/dev/nvme0n1 (весь диск, новая разметка)
└─ nvme0n1p1   LUKS2 (TPM2 PCR 7)   →  /dev/mapper/cryptdata
   └─ Btrfs, label "backup", compress=zstd:3
      ├─ @backup   → /mnt/backup            (noauto, soft-cold)
      │   ├─ gentoo/      ← btrbk: инкрементальные снапшоты @ (корень Gentoo)
      │   ├─ home.borg    ← borg-репозиторий (зашифрованный, /home/<username>)
      │   └─ etc.borg     ← borg-репозиторий (/etc)
      └─ @data     → /home/<username>/data    (hot, всегда смонтирован)
```

> ⚠️ **Важный нюанс про soft-cold**: при одном LUKS контейнер открыт всё время, пока работает система (для горячего `@data`). Защита на уровне точки монтирования: `/mnt/backup` не смонтирован → userspace-процесс не достанет бэкапы. Для защиты даже от root-уровня нужен **hard-cold** (два отдельных LUKS на двух разделах диска) — см. §14.

### Что бэкапим, а что нет

| Источник | Куда | Инструмент | Что исключаем |
|----------|------|-----------|---------------|
| `@` (корень Gentoo: ОС + `/etc`) | `/mnt/backup/gentoo/` | btrbk (send/receive) | кэши в отдельных subvols не входят в `@` |
| `/home/<username>` | `/mnt/backup/home.borg` | borg | `.cache`, `llvm-project`, `llvm-for-bolt-perf`, `Downloads`, `.steam`, `*.venv`, `__pycache__` |
| `/etc` | `/mnt/backup/etc.borg` | borg | `—` (точечный restore) |
| `~/.ssh`, `~/.gnupg`, токены | внутри `home.borg` | borg (зашифрован) | — |

**Не бэкапим** (воспроизводимое): `@var_cache`, `@distfiles`, `@var_log` (по желанию), `@portage_tree` (`emerge --sync`), `@portage_tmp`, `@ccache`, `/.snapshots` (локальная защита, не бэкап).

---

## 2. Prerequisites

```bash
# Снимок системы для отката (на всякий)
doas snapper -c root create -d "before second disk setup"

# Инструменты бэкапа
doas emerge -av app-backup/btrbk app-backup/borgbackup

# Проверка: пароль от старого LUKS Arch известен (для спасения данных)
# Проверка: ESP общий, лежит на диске Gentoo (nvme1n1p1 → /boot)
lsblk -o NAME,FSTYPE,MOUNTPOINTS,PARTTYPENAME /dev/nvme1n1
```

---

## 3. Спасение данных Arch

На `nvme0n1p1` сейчас LUKS с Arch (`cryptarch`, UUID `<arch-luks-uuid>`). Перед стиранием — открыть read-only и забрать нужное.

```bash
# Открыть Arch LUKS только для чтения
doas cryptsetup open --type luks --readonly /dev/nvme0n1p1 cryptarch-ro

# Корень Arch — subvol @ (см. rd.luks...rootflags=subvol=@ в bootctl)
doas mkdir -p /mnt/arch
doas mount -o ro,subvol=/@ /dev/mapper/cryptarch-ro /mnt/arch

# Посмотреть, что там есть
ls -la /mnt/arch
ls -la /mnt/arch/home   # пользователь Arch
```

Скопировать ценное в временное место на первом диске:

```bash
mkdir -p ~/arch-rescue
# Секреты (осторожно — после переноса удалить ~/arch-rescue или зашифровать)
cp -a /mnt/arch/etc/ssh                ~/arch-rescue/etc-ssh 2>/dev/null
# Найди домашнюю директорию пользователя Arch и забери ~/.ssh, ~/.gnupg, dotfiles, проекты
# cp -a /mnt/arch/home/<arch-user>/.ssh   ~/arch-rescue/
# cp -a /mnt/arch/home/<arch-user>/.gnupg ~/arch-rescue/
# cp -a /mnt/arch/etc                     ~/arch-rescue/etc-arch
```

Закрыть:

```bash
doas umount /mnt/arch
doas cryptsetup close cryptarch-ro
```

> **Важно**: `~/arch-rescue/` содержит секреты. После завершения настройки — либо удали, либо перенеси в `home.borg` и затри оригиналы (`shred -u`).

---

## 4. Очистка ESP от Arch UKI

Arch-загрузчики (`arch-linux-cachyos.efi`, `arch-linux.efi`) лежат в **общем ESP** `/boot/EFI/Linux/`. systemd-boot детектит их по BLS Type #2 автоматически — отдельной NVRAM-записи нет, чистить `efibootmgr` не нужно.

```bash
# Посмотреть Arch UKI в ESP
ls -l /boot/EFI/Linux/arch-linux*.efi

# Удалить
doas rm -v /boot/EFI/Linux/arch-linux*.efi

# Проверить, что systemd-boot больше не видит Arch
doas bootctl list | grep -i arch   # должно быть пусто
```

---

## 5. Переразметка nvme0n1

> ⚠️ **Деструктивно**: стирает всё на `nvme0n1`. Убедись, что данные Arch спасены (§3).

```bash
# Убедиться, что cryptarch закрыт
doas cryptsetup status cryptarch 2>/dev/null
doas cryptsetup status cryptarch-ro 2>/dev/null

# Очистить подписи диска
doas wipefs -a /dev/nvme0n1

# Новая GPT с одним разделом (тип 8304 = Linux root x86-64)
doas sgdisk -Z /dev/nvme0n1
doas sgdisk -n 1:0:0 -t 1:8304 /dev/nvme0n1

# Проверить
doas sgdisk -p /dev/nvme0n1
```

---

## 6. LUKS2 + TPM2

```bash
# Создать LUKS2 (пароль — запасной слот на случай поломки TPM/изменения PCR)
doas cryptsetup luksFormat --type luks2 --pbkdf argon2id /dev/nvme0n1p1

# Открыть
doas cryptsetup open --type luks /dev/nvme0n1p1 cryptdata

# Привязать к TPM2 — PCR 7, тот же набор, что у первого диска
doas systemd-cryptenroll --wipe-slot=tpm2 --tpm2-device=auto --tpm2-pcrs=7 /dev/nvme0n1p1

# Проверить слоты: должны быть парольный (0) и TPM2
doas cryptsetup luksDump /dev/nvme0n1p1

# Зафиксировать UUID LUKS для /etc/crypttab
doas blkid -s UUID -o value /dev/nvme0n1p1
```

> ⚠️ **Важно**: обязательно оставь **парольный слот**. Если TPM умрёт или PCR изменятся (обновление firmware, перемонтаж Secure Boot) — без пароля диск не открыть никогда. Сравни с первым диском: `doas cryptsetup luksDump /dev/nvme1n1p2` — там тоже должен быть парольный слот рядом с TPM.

> ⚠️ **Важный нюанс**: именно PCR 7, а не расширенный набор вроде `0+7` — на этой машине даже с минимальным набором смена cmdline (2026-09-14) совпадала с PCR-mismatch и потерей анлока, повторное зачисление восстановило работу; точный measurement path прошивки не подтверждён (прямого before/after-замера PCR 7 не было). Хронология и процедура перезачисления — [troubleshooting: TPM2-анлок после пересборки UKI](../../../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/). Возьмёшь другой набор — синхронизируй `tpm2-pcrs=` в `/etc/crypttab` (§8).

---

## 7. Btrfs + субвольмы

```bash
# Создать ФС (single profile — без RAID, это дефолт для одного устройства)
doas mkfs.btrfs -L backup /dev/mapper/cryptdata

# Временно смонтировать корень ФС для создания subvols
doas mkdir -p /mnt/cryptdata-root
doas mount /dev/mapper/cryptdata /mnt/cryptdata-root

# Создать subvols (flat-layout, как на первом диске)
doas btrfs subvolume create /mnt/cryptdata-root/@backup
doas btrfs subvolume create /mnt/cryptdata-root/@data

# Зафиксировать UUID Btrfs для /etc/fstab
doas blkid -s UUID -o value /dev/mapper/cryptdata

# Отмонтировать временный mount
doas umount /mnt/cryptdata-root
```

---

## 8. /etc/crypttab и /etc/fstab

Точки монтирования:

```bash
doas mkdir -p /home/<username>/data /mnt/backup
doas chown <username>:<username> /home/<username>/data
```

Файл: `/etc/crypttab` (создать, если отсутствует):

```text
# <name>      <device>                <password>   <options>
cryptdata      UUID=<LUKS-UUID>        none         luks,tpm2-device=auto,tpm2-pcrs=7
```

> Где `<LUKS-UUID>` — UUID из `blkid -s UUID -o value /dev/nvme0n1p1` (§6). `tpm2-pcrs=` указан явно и совпадает с набором из `systemd-cryptenroll` в §6 — так разблокировка не зависит от дефолтов crypttab.

Файл: `/etc/fstab` — добавить строки (в стиле существующих Btrfs-записей):

```text
# Second disk (nvme0n1) — data (hot)
UUID=<BTRFS-UUID>  /home/<username>/data  btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@data     0 0

# Second disk — backup target (soft-cold, noauto)
UUID=<BTRFS-UUID>  /mnt/backup          btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@backup,noauto  0 0
```

> Где `<BTRFS-UUID>` — UUID из `blkid -s UUID -o value /dev/mapper/cryptdata` (§7).

Активировать и проверить:

```bash
doas systemctl daemon-reload

# Перечитать crypttab, открыть второй LUKS через TPM
doas systemctl start systemd-cryptsetup@cryptdata

# Смонтировать горячие данные (backup НЕ монтируем — noauto)
doas mount /home/<username>/data

# Проверка
lsblk -o NAME,FSTYPE,MOUNTPOINTS /dev/nvme0n1
mount | grep -E 'cryptdata|/home/<username>/data'
```

---

## 9. btrbk: бэкап корня Gentoo

btrbk делает инкрементальные `btrfs send/receive` снимков subvol `@` (корень Gentoo) на второй диск. Источник — первый диск (`/`), target — `/mnt/backup/gentoo`.

Файл: `/etc/btrbk/btrbk.conf`:

```text
# Retention
snapshot_preserve_min   latest
snapshot_preserve       14d 4w 6m
target_preserve_min     latest
target_preserve         14d 4w 6m

# Логирование
loglevel                info
lockfile                /var/lock/btrbk.lock

# Источник: корень Gentoo (Btrfs с subvol @)
volume /
  subvolume @
    target send-receive /mnt/backup/gentoo
```

Проверить конфиг (без записи):

```bash
doas btrbk dryrun
doas btrbk config print
```

---

## 10. borg: бэкап /home и /etc

### 10.1. Инициализация репозиториев

```bash
# Примонтировать backup-target вручную (он noauto)
doas mount /mnt/backup

# Создать директории репозиториев (владелец — root)
doas mkdir -p /mnt/backup/home.borg /mnt/backup/etc.borg

# Инициализация с шифрованием repokey (ключ хранится в репо, защищён паролем)
doas borg init --encryption=repokey /mnt/backup/home.borg
doas borg init --encryption=repokey /mnt/backup/etc.borg

# Пароль репозитория — сохранить в менеджере паролей!
```

> ⚠️ **Важно**: пароль borg-репозитория и ключ — **критично** для восстановления. Без них бэкап бесполезен. Сохрани пароль в менеджере паролей. При `repokey` ключ лежит внутри репо (на зашифрованном диске), для restore нужен пароль + доступ к `/mnt/backup`.

### 10.2. Скрипт бэкапа

Файл: `/usr/local/bin/borg-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_HOME=/mnt/backup/home.borg
REPO_ETC=/mnt/backup/etc.borg
BACKUP_TARGET=/mnt/backup

# Soft-cold: смонтировать target, отмонтировать в конце
mount "$BACKUP_TARGET" 2>/dev/null || true
trap 'umount "$BACKUP_TARGET" 2>/dev/null || true' EXIT

ARCHIVE_HOME="home-$(date +%Y-%m-%d_%H:%M)"
ARCHIVE_ETC="etc-$(date +%Y-%m-%d_%H:%M)"

# /home/<username> с exclude-паттернами
borg create --stats --progress \
  --exclude '/home/<username>/.cache' \
  --exclude '/home/<username>/llvm-project' \
  --exclude '/home/<username>/llvm-for-bolt-perf' \
  --exclude '/home/<username>/Downloads' \
  --exclude '/home/<username>/.steam' \
  --exclude '/home/<username>/.local/share/Trash' \
  --exclude '*/.venv' \
  --exclude '*/__pycache__' \
  --exclude '*/node_modules' \
  --exclude-caches \
  --exclude '*.pyc' \
  "${REPO_HOME}::${ARCHIVE_HOME}" \
  /home/<username>

# /etc
borg create --stats \
  --exclude-caches \
  "${REPO_ETC}::${ARCHIVE_ETC}" \
  /etc

# Retention + компактификация
for repo in "$REPO_HOME" "$REPO_ETC"; do
  borg prune --keep-daily 14 --keep-weekly 4 --keep-monthly 6 "$repo"
  borg compact "$repo"
done
```

Сделать исполняемым:

```bash
doas chmod +x /usr/local/bin/borg-backup.sh
```

> ⚠️ **Секреты**: `~/.ssh`, `~/.gnupg`, `~/.ansible_vault_pass`, `~/.mcp-auth`, `~/.codex`, `.claude.json`, `~/.mozilla` попадают в `home.borg`. Поскольку репо **зашифрован** и лежит на **зашифрованном диске** — это допустимо. Но никогда не копируй их в открытый git/облако.

### 10.3. Тест первого бэкапа

```bash
doas /usr/local/bin/borg-backup.sh
doas borg list /mnt/backup/home.borg
doas borg list /mnt/backup/etc.borg
```

---

## 11. Автоматизация: systemd-юниты и таймеры

### 11.1. btrbk

Файл: `/etc/systemd/system/btrbk-backup.service`:

```ini
[Unit]
Description=btrbk backup of Gentoo root subvol @
Wants=mnt-backup.mount
After=mnt-backup.mount

[Service]
Type=oneshot
ExecStartPre=/usr/bin/mount /mnt/backup
ExecStart=/usr/sbin/btrbk run
ExecStopPost=/usr/bin/umount /mnt/backup
IOSchedulingClass=idle
Nice=10
```

Файл: `/etc/systemd/system/btrbk-backup.timer`:

```ini
[Unit]
Description=Daily btrbk backup

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

### 11.2. borg

Файл: `/etc/systemd/system/borg-backup.service`:

```ini
[Unit]
Description=borg backup of /home and /etc
After=network.target

[Service]
Type=oneshot
Environment=BORG_PASSPHRASE=<your-borg-passphrase>
Environment=BORG_RELOCATED_REPO_ACCESS_IS_OK=yes
ExecStart=/usr/local/bin/borg-backup.sh
IOSchedulingClass=idle
Nice=10
```

> ⚠️ `BORG_PASSPHRASE` в EnvironmentFile/Unit — лучше вынести в `/etc/borg-passphrase` (права `600`, владелец root) и подключить через `EnvironmentFile=/etc/borg-passphrase`.

Файл: `/etc/systemd/system/borg-backup.timer`:

```ini
[Unit]
Description=Daily borg backup

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Активация:

```bash
doas systemctl daemon-reload
doas systemctl enable --now btrbk-backup.timer borg-backup.timer

# Проверка таймеров
systemctl list-timers btrbk-backup.timer borg-backup.timer
```

> **Совет**: btrbk в 03:00, borg в 04:00 — чтобы не накладывались. Подстрой под своё расписание.

---

## 12. Verification

### 12.1. Перезагрузка (главная проверка)

```bash
doas reboot
```

После загрузки:

```bash
# Второй LUKS авторасшифрован через TPM
lsblk -o NAME,FSTYPE,MOUNTPOINTS /dev/nvme0n1
systemctl status systemd-cryptsetup@cryptdata

# @data смонтирован
mount | grep /home/<username>/data

# @backup НЕ смонтирован (soft-cold)
mount | grep /mnt/backup   # должно быть пусто

# Arch больше не виден в systemd-boot
doas bootctl list | grep -i arch   # пусто

# Gentoo грузится как раньше (UKI/Secure Boot не тронуты)
doas sbctl verify
```

### 12.2. Тест бэкапа вручную

```bash
# btrbk
doas systemctl start btrbk-backup.service
doas btrfs subvolume list /mnt/backup/gentoo   # должны появиться снапшоты @.*

# borg
doas systemctl start borg-backup.service
doas borg list /mnt/backup/home.borg
doas borg list /mnt/backup/etc.borg
```

### 12.3. Тест восстановления (обязательно!)

```bash
# Восстановить один файл из /etc
doas mount /mnt/backup
doas borg extract --list /mnt/backup/etc.borg::etc-<DATE> etc/fstab
# (выполнить в /tmp, проверить, что содержимое корректное)
doas umount /mnt/backup
```

---

## 13. Rollback

**Отключить второй диск от загрузки** (если что-то не так):

```bash
# Закомментировать/удалить строки cryptdata и second-disk в fstab и crypttab
doas nano /etc/crypttab   # убрать cryptdata
doas nano /etc/fstab      # убрать @data и @backup
doas systemctl daemon-reload

# Отключить таймеры
doas systemctl disable --now btrbk-backup.timer borg-backup.timer

# Перезагрузка — Gentoo грузится независимо от nvme0n1
doas reboot
```

> Arch восстановить **нельзя** — диск затёрт (§5). Если dual-boot всё же нужен — это решение принимается до §4.

---

## 14. Risks

| Риск | Последствие | Митигация |
|------|-------------|-----------|
| TPM сломался / PCR изменились | Оба LUKS не авторасшифруются | **Парольный слот** на каждом диске; грузишься с парольной фразой, затем re-enroll TPM |
| Отказ 2-го диска | Потеря бэкапов + `~/data`; Gentoo работает | Внешний/облачный бэкап критичного вне ноутбука |
| Отказ 1-го диска (Gentoo) | Потеря системы; бэкапы целы на 2-м | `btrbk`/`btrfs receive` восстановление `@` на новый диск + reinstall bootloader |
| nvme0n1 сменил имя при замене дисков | fstab/crypttab не найдут устройство | Используем **UUID**, не `/dev/nvme...` |
| borg-репо повредился | Часть архивов недоступна | Периодический `borg check --verify-data` |
| Soft-cold не защищает от root | Root-процесс может смонтировать `/mnt/backup` | Hard-cold (см. ниже) или отключать диск физически |
| Пароль borg утерян | Бэкап бесполезен | Хранить в менеджере паролей + бэкап ключа |
| `~/arch-rescue` с секретами забыт | Секреты в открытом виде на первом диске | После переноса в `home.borg` → `shred -u ~/arch-rescue/*` |

### Hard-cold (опционально, для паранойи)

Если soft-cold недостаточен: разбить `nvme0n1` на два раздела — `nvme0n1p1` (LUKS-data, hot, открывается при загрузке для `@data`) и `nvme0n1p2` (LUKS-backup, **не в crypttab** вообще, открывается только `systemd-cryptsetup start cryptbackup` перед бэкапом). Защита вплоть до root-уровня (между бэкапами backup-LUKS закрыт). Стоимость — два LUKS, два enroll TPM, усложнённый fstab/crypttab.

---

## 15. Шпаргалка

```bash
# Открыть backup-target вручную (для проверки/restore)
doas mount /mnt/backup

# Статус btrbk
doas btrbk list snapshots
doas btrfs subvolume list /mnt/backup/gentoo

# Статус borg
doas borg list /mnt/backup/home.borg
doas borg info /mnt/backup/home.borg::home-<DATE>
doas borg check --verify-data /mnt/backup/home.borg

# Восстановить файл/директорию
cd /tmp && doas borg extract /mnt/backup/home.borg::home-<DATE> home/<username>/<path>

# Закрыть backup-target
doas umount /mnt/backup

# Статус TPM-слотов на обоих дисках
doas cryptsetup luksDump /dev/nvme0n1p1
doas cryptsetup luksDump /dev/nvme1n1p2
```

---

## 16. Ссылки

- [btrbk documentation](https://digint.ch/btrbk/) — конфигурация, retention, send/receive
- [borgbackup documentation](https://borgbackup.readthedocs.io/) — exclude-паттерны, restore, automation
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/systemd-cryptenroll.html) — TPM2-привязка
- [crypttab](https://www.freedesktop.org/software/systemd/man/crypttab.html) — опции LUKS через systemd
- [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/) — соглашения по subvols/опциям
- [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/) — модель TPM/LUKS первого диска
