---
title: "Второй диск: бэкапы и дополнительное хранилище"
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Status

**PLAN — NOT APPLIED** (проверено аудитом 2026-09-22; дизайн скорректирован
без live-проверок).

Текущее состояние машины:

- `nvme0n1` — единый LUKS-раздел со старым Arch Linux, не открыт;
- новая backup/data схема на втором диске не создана;
- `/etc/crypttab` для неё отсутствует;
- таймеры btrbk/borg не настроены;
- Arch UKI остаются в ESP.

Цель плана — подключить второй NVMe (`nvme0n1`, ранее — Arch Linux) как
зашифрованное хранилище для **бэкапов системы и конфигов** и
**дополнительного места под данные**. Без RAID, без вмешательства в
критический путь загрузки.

Это дизайн будущей реализации, а не изменение live-системы. Перед реальным
выполнением hardware/device state проверяется заново; `last_verified`
относится к состоянию машины на 2026-09-22, а не к этой схеме.

## Applicability

На машине уже работает Gentoo на `nvme1n1` (LUKS2 + TPM2 + UKI + Btrfs), есть
второй физический диск `nvme0n1`, который хочется задействовать под бэкапы и
данные.

Контекст: подробности загрузочного стека — [installation/systemd-uki-setup](../../../../installation/systemd-uki-setup/) и [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/). Btrfs-соглашения — [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/).

## 1. Target design

Всё в этом разделе описывает состояние **после применения плана**, а не
текущую машину (текущее состояние — в Status выше).

### Ключевые принципы

- **Второй диск НЕ в initramfs.** Открывается через systemd `/etc/crypttab`
  уже после загрузки rootfs. Dracut/UKI/`rd.luks.*`/sbctl — не трогаем.
- **Один LUKS2 + TPM2 (PCR 7) + независимый passphrase keyslot.** Тот же TPM
  и тот же набор PCR, что у первого диска (PCR 7 — выбранная policy первого
  диска; эпизод 2026-09-14 — в §7). Авторасшифровка при загрузке.
- **Boot-независимость.** Отказ, отсутствие или TPM unlock failure второго
  NVMe не должен ломать загрузку Gentoo и не должен требовать интерактивный
  пароль второго диска. Обеспечивается `nofail` + `headless` (§9) и
  root-owned mountpoint (§10).
- **Soft-cold для бэкапов.** `@backup` монтируется `noauto`; orchestration
  service монтирует его только на время бэкапа и отмонтирует после (§13).
  Вне окна бэкапа обычный userspace без root не видит `/mnt/backup`.
- **`@data` горячий** — всегда смонтирован в `/home/<username>/data`, это
  дополнительное рабочее хранилище.
- **btrbk для системы** (снапшоты корня Gentoo), **borg для `/home` и
  `/etc`** (точечный restore, дедупликация, шифрование, exclude-паттерны).

### Целевая схема

```text
nvme0n1 (второй NVMe, подтверждённый по /dev/disk/by-id — §3)
└─ один GPT-раздел, тип 8309 (Linux LUKS)
   └─ LUKS2 + TPM2 PCR 7 + независимый passphrase keyslot
      │  (открывается через /etc/crypttab → /dev/mapper/cryptdata)
      └─ Btrfs, label "backup", compress=zstd:3
         ├─ @data
         │  └─ /home/<username>/data
         │     hot, не boot dependency
         │     дополнительное/воспроизводимое хранилище
         │
         └─ @backup
            └─ /mnt/backup
               noauto / soft-cold
               ├─ gentoo/    ← btrbk: снапшоты корня Gentoo
               ├─ home.borg  ← borg: /home/<username>
               └─ etc.borg   ← borg: /etc
```

### Принятая threat model

- **Защищаемся от отказа первого системного NVMe**: система теряется,
  локальные бэкапы остаются на втором диске.
- **Versioned/file-level recovery**: снапшоты корня (btrbk) + архивы
  `/home` и `/etc` (borg).
- **`@backup` обычно не mounted** — меньше exposure для обычного userspace.
- **Не обещаем защиту от root compromise** — см. границу ниже.
- **`@data` не содержит уникальных данных** и не входит в обязательный
  backup contract: это дополнительное/воспроизводимое пространство.
- **Отказ второго NVMe** означает потерю `@data` и локального backup tier —
  это принятый риск.
- **Критичные данные** всё равно требуют отдельной external/cloud copy вне
  этого диска.

> ⚠️ **Граница soft-cold**: soft-cold не защищает от root. Root может открыть
> LUKS-контейнер и смонтировать `@backup` в любой момент; TPM-enrolled
> второй LUKS сам по себе не делает бэкап устойчивым к root-компрометации.
> Настоящая root-resistant модель потребовала бы независимого секрета,
> физической/off-device изоляции или другой архитектуры — это сознательно
> **out of scope** текущего design.

### Что бэкапим, а что нет

| Источник | Куда | Инструмент | Что исключаем |
|----------|------|-----------|---------------|
| `@` (корень Gentoo: ОС + `/etc`) | `/mnt/backup/gentoo/` | btrbk (send/receive) | кэши в отдельных subvols не входят в `@`; `/.snapshots` не копируется |
| `/home/<username>` | `/mnt/backup/home.borg` | borg | `data` (второй NVMe — §12.3), `.cache`, `llvm-project`, `llvm-for-bolt-perf`, `Downloads`, `.steam`, `*.venv`, `__pycache__` |
| `/etc` | `/mnt/backup/etc.borg` | borg | `—` (точечный restore) |
| `~/.ssh`, `~/.gnupg`, токены | внутри `home.borg` | borg (зашифрован) | — |

**Не бэкапим** (воспроизводимое или вне контракта): `@var_cache`,
`@distfiles`, `@var_log` (по желанию), `@portage_tree` (`emerge --sync`),
`@portage_tmp`, `@ccache`, `/.snapshots` (локальная защита, не бэкап),
`/home/<username>/data` (на втором диске, additional/reproducible).

---

## 2. Prerequisites

```bash
# Снимок системы для отката (на всякий)
doas snapper -c root create -d "before second disk setup"

# Инструменты бэкапа
doas emerge -av app-backup/btrbk app-backup/borgbackup

# Проверка: пароль от старого LUKS Arch известен (для спасения данных)
# Проверка: составлен список данных Arch, которые нужно спасти (§4)
# Проверка: ESP общий, лежит на диске Gentoo (nvme1n1p1 → /boot)
lsblk -o NAME,FSTYPE,MOUNTPOINTS,PARTTYPENAME /dev/nvme1n1
```

---

## 3. Identity gate: подтверждение физического диска

> ⚠️ **STOP.** До любых `wipefs`, `sgdisk`, `cryptsetup luksFormat` нужно
> подтвердить, что выбранный узел устройств указывает именно на физический
> второй NVMe. `/dev/nvme0n1` — не идентичность: имя может измениться после
> замены дисков, прошивок или порядка инициализации. Уничтожение не того
> диска — потеря рабочей системы.

Снять идентичность обоих NVMe:

```bash
lsblk -d -o NAME,MODEL,SERIAL,SIZE,WWN
ls -l /dev/disk/by-id/ | grep nvme
```

Выбрать стабильный symlink конкретного второго NVMe из `/dev/disk/by-id/`
(вид `nvme-<MODEL>_<SERIAL>`) и проверить, куда он ведёт и что на нём:

```bash
readlink -f /dev/disk/by-id/<SECOND-NVME>
doas sgdisk -p /dev/disk/by-id/<SECOND-NVME>
```

Перед любой destructive-операцией зафиксируй вручную и сверь:

- **model** и **serial** — из `lsblk` и из имени by-id;
- **size** — совпадает с ожидаемым вторым диском;
- **текущую разметку** (`sgdisk -p`) — один раздел со старым Arch LUKS;
- **WWN** — перекрёстная проверка.

Дальше по тексту `<SECOND-NVME>` — этот подтверждённый by-id путь,
partition-узел — `<SECOND-NVME>-part1`. В destructive-шагах удобно
использовать переменную:

```bash
DISK=/dev/disk/by-id/<CONFIRMED-SECOND-NVME>
```

---

## 4. Спасение данных Arch

На старом разделе сейчас LUKS с Arch (UUID `<arch-luks-uuid>`). Перед
стиранием — открыть read-only и забрать нужное.

Временное хранилище — root-only каталог на уже зашифрованном первом диске,
не пользовательский `~/arch-rescue`: rescued-данные включают root-owned
секреты, и держать их в user-writable домашней директории не нужно.

```bash
doas install -d -m 0700 -o root -g root /root/arch-rescue
```

Открыть старый LUKS только для чтения:

```bash
doas cryptsetup open --type luks --readonly /dev/disk/by-id/<SECOND-NVME>-part1 cryptarch-ro

doas mkdir -p /mnt/arch
# Корень Arch — сабвольюм @ (см. rd.luks...rootflags=subvol=@ в bootctl)
doas mount -o ro,subvol=/@ /dev/mapper/cryptarch-ro /mnt/arch

# Посмотреть, что там есть
ls -la /mnt/arch
ls -la /mnt/arch/home   # пользователь Arch
```

Скопировать ценное с root privileges. Ошибки копирования не подавляем:
пустой результат из-за проглоченной ошибки — это молчаливая потеря данных.

```bash
# Секреты
doas cp -a /mnt/arch/etc/ssh /root/arch-rescue/etc-ssh
# Найди домашнюю директорию пользователя Arch и забери ~/.ssh, ~/.gnupg, dotfiles, проекты:
# doas cp -a /mnt/arch/home/<arch-user>/.ssh   /root/arch-rescue/
# doas cp -a /mnt/arch/home/<arch-user>/.gnupg /root/arch-rescue/
# doas cp -a /mnt/arch/etc                     /root/arch-rescue/etc-arch
```

Закрыть:

```bash
doas umount /mnt/arch
doas cryptsetup close cryptarch-ro
```

### Verification gate перед уничтожением диска

Никаких destructive-шагов (§6 и далее), пока не подтверждено:

- [ ] составлен список данных, которые необходимо было спасти;
- [ ] каждый пункт списка физически присутствует в `/root/arch-rescue`
      (`doas ls -laR /root/arch-rescue`);
- [ ] permissions/ownership приемлемы (`doas stat`);
- [ ] важные файлы реально открываются и читаются (ключи, конфиги, проекты);
- [ ] ты явно подтвердил решение уничтожить старый Arch disk.

### Жизненный цикл rescue-копии

После успешной миграции (бэкапы настроены и проверены, §12–14) временная
копия больше не нужна:

```bash
doas rm -rf /root/arch-rescue
```

Это обычное удаление, а не physical secure erase. Утилиты «затирания»
одиночных файлов рассчитаны на in-place overwrite; Btrfs (CoW) и SSD/NVMe
(wear levelling) такую гарантию не дают. Настоящая security boundary —
encryption at rest: оба диска под LUKS, `/root` лежит на зашифрованном
первом диске.

---

## 5. Очистка ESP от Arch UKI

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

## 6. Переразметка второго диска

> ⚠️ **Деструктивно**: стирает всё на втором NVMe. Перед этим должны быть
> пройдены identity gate (§3) и rescue verification gate (§4).

```bash
DISK=/dev/disk/by-id/<CONFIRMED-SECOND-NVME>

# Убедиться, что старый LUKS закрыт
doas cryptsetup status cryptarch-ro   # ожидается "is inactive"
doas cryptsetup status cryptarch      # если когда-либо открывался — тоже закрыт

# Очистить подписи диска
doas wipefs -a "$DISK"

# Новая GPT с одним разделом
doas sgdisk -Z "$DISK"
doas sgdisk -n 1:0:0 -t 1:8309 "$DISK"

# Проверить
doas sgdisk -p "$DISK"
```

Тип раздела — `8309` (**Linux LUKS**), а не generic `8300`: назначение
раздела уже известно, и разметка должна это отражать. Новый partition-узел:
`<SECOND-NVME>-part1`.

---

## 7. LUKS2 + TPM2

Workstation policy прежняя: LUKS2, TPM2, PCR 7 — как у первого диска. PCR 7 —
уже принятое решение текущего boot design; второй диск пока не enrolled, и
перед реальной реализацией актуальный TPM/systemd state проверяется заново.

```bash
# Создать LUKS2; passphrase — независимый recovery-путь, не привязанный к TPM
doas cryptsetup luksFormat --type luks2 --pbkdf argon2id /dev/disk/by-id/<SECOND-NVME>-part1

# Открыть
doas cryptsetup open --type luks /dev/disk/by-id/<SECOND-NVME>-part1 cryptdata

# Привязать к TPM2 — PCR 7, тот же набор, что у первого диска
doas systemd-cryptenroll --wipe-slot=tpm2 --tpm2-device=auto --tpm2-pcrs=7 /dev/disk/by-id/<SECOND-NVME>-part1
```

Проверить результат через `luksDump` (инспекция; не путай номера keyslots и
номера токенов — это разные сущности):

```bash
doas cryptsetup luksDump /dev/disk/by-id/<SECOND-NVME>-part1
```

Требования к результату:

- существует **минимум один passphrase keyslot** (секция `Keyslots`);
- существует **TPM2 token** (секция `Tokens`);
- passphrase реально открывает LUKS независимо от TPM:

```bash
doas cryptsetup open --test-passphrase /dev/disk/by-id/<SECOND-NVME>-part1
```

«Парольный слот 0» — не универсальный факт: нумерация слотов — деталь
конкретного enrollment, проверяй фактическое состояние, а не предполагаемый
номер.

Зафиксировать UUID LUKS для `/etc/crypttab`:

```bash
doas blkid -s UUID -o value /dev/disk/by-id/<SECOND-NVME>-part1
```

> ⚠️ **Важно**: обязательно оставь passphrase keyslot. Если TPM умрёт или PCR изменятся (обновление firmware, перемонтаж Secure Boot) — без пароля диск не открыть никогда. Сравни с первым диском: `doas cryptsetup luksDump /dev/nvme1n1p2` — там тоже должен быть passphrase keyslot рядом с TPM.

> ⚠️ **Важный нюанс**: именно PCR 7, а не расширенный набор вроде `0+7` — на этой машине даже с минимальным набором смена cmdline (2026-09-14) совпадала с PCR-mismatch и потерей анлока, повторное зачисление восстановило работу; точный measurement path прошивки не подтверждён (прямого before/after-замера PCR 7 не было). Хронология и процедура перезачисления — [troubleshooting: TPM2-анлок после пересборки UKI](../../../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/). Возьмёшь другой набор — синхронизируй `tpm2-pcrs=` в `/etc/crypttab` (§9).

---

## 8. Btrfs + субвольмы

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

Один Btrfs, ровно два сабвольюма: `@data` + `@backup`. Дополнительные
субвольюмы не добавляются без необходимости.

---

## 9. /etc/crypttab и /etc/fstab: boot-независимость

Архитектурное требование:

> Отказ, отсутствие или TPM unlock failure второго NVMe не должен ломать
> boot Gentoo и не должен требовать интерактивный пароль второго диска во
> время обычной загрузки. Recovery passphrase используется вручную, при
> диагностике/восстановлении.

Файл: `/etc/crypttab` (создать, если отсутствует):

```text
# <name>      <device>          <password>   <options>
cryptdata      UUID=<LUKS-UUID>  none         luks,tpm2-device=auto,tpm2-pcrs=7,nofail,headless
```

- `nofail` — зашифрованное устройство не является hard boot dependency:
  система грузится, даже если второй диск отсутствует или не открылся;
- `headless` — при неудаче TPM boot не превращается в интерактивный password
  prompt: устройство просто остаётся закрытым;
- `tpm2-pcrs=7` указан явно и совпадает с набором из `systemd-cryptenroll`
  (§7) — разблокировка не зависит от дефолтов crypttab.

Ручной recovery при проблемах с TPM:

```bash
doas cryptsetup open --type luks /dev/disk/by-id/<SECOND-NVME>-part1 cryptdata
```

Файл: `/etc/fstab` — добавить строки (в стиле существующих Btrfs-записей):

```text
# Second disk — data (hot, не boot dependency)
UUID=<BTRFS-UUID>  /home/<username>/data  btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@data,nofail  0 0

# Second disk — backup target (soft-cold)
UUID=<BTRFS-UUID>  /mnt/backup  btrfs  rw,noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=/@backup,noauto,nofail  0 0
```

- `@data`: `nofail` — отсутствие или отказ второго диска не вешает загрузку;
- `@backup`: `noauto,nofail` — обычно не смонтирован (soft-cold) и не
  участвует в boot.

> Где `<LUKS-UUID>` — из §7, `<BTRFS-UUID>` — из §8. Произвольный
> `x-systemd.device-timeout=` не добавляем: без live-замера необходимости и
> подбора значения он только маскирует проблему.

Второй диск не входит в initramfs: Dracut/UKI/kernel cmdline/sbctl не
меняются.

---

## 10. Точки монтирования и ownership

`/mnt/backup` остаётся root-controlled. Для `@data` порядок критичен:
ownership меняется **после** успешного mount, не до.

Почему: если сделать `chown <username>` до mount и второй диск не
смонтируется (отсутствует, LUKS не открылся), приложения получат
user-writable каталог на первом NVMe и начнут незаметно писать данные туда.
Root-owned non-writable mountpoint даёт обратную семантику: без диска запись
падает с ошибкой, а не молча уходит на первый диск.

```bash
# 1. Mountpoint — root-owned и non-user-writable (до mount)
doas install -d -m 0755 -o root -g root /home/<username>/data
doas install -d -m 0755 -o root -g root /mnt/backup

# 2. Активировать конфигурацию: открыть второй LUKS через TPM
doas systemctl daemon-reload
doas systemctl start systemd-cryptsetup@cryptdata

# 3. Смонтировать горячие данные (backup НЕ монтируем — noauto)
doas mount /home/<username>/data

# 4. Проверить, что смонтирован именно @data с ожидаемым UUID/subvol
findmnt --mountpoint /home/<username>/data

# 5. Только после успешного mount — ownership корня смонтированного @data
doas chown <username>:<username> /home/<username>/data

# Контроль
lsblk -o NAME,FSTYPE,MOUNTPOINTS /dev/disk/by-id/<SECOND-NVME>
```

`chown` в шаге 5 меняет владельца корня смонтированного сабвольюма `@data`
(на втором диске), а не каталога-точки монтирования на первом диске.

---

## 11. btrbk: бэкап корня Gentoo

btrbk делает снапшоты корня Gentoo и инкрементальный `btrfs send/receive` на
второй диск. Источник — первый диск, target — `/mnt/backup/gentoo`.

Источник в конфигурации — `/` как absolute path: `/` уже является
смонтированным сабвольюмом `@`, и отдельный top-level mount (subvolid=5)
ради btrbk не нужен. Прежняя форма конфига предполагала, что `@` доступен
как вложенный путь внутри корня — это не соответствует фактическому layout
рабочей станции.

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

# Снапшоты корня — в отдельном каталоге внутри /.snapshots
snapshot_dir            /.snapshots/btrbk

# Источник: / (смонтированный сабвольюм @ корня Gentoo)
subvolume /
  snapshot_name root
  target send-receive /mnt/backup/gentoo
```

До первого run создать каталог снапшотов:

```bash
doas mkdir -p /.snapshots/btrbk
```

Каталог target создаётся **только после успешного mount** `/mnt/backup`:

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup   # убедиться: subvol=/@backup, ожидаемый UUID
doas mkdir -p /mnt/backup/gentoo
```

Не создавай target в пустом `/mnt/backup`: если сабвольюм не смонтирован,
каталог окажется на корневой ФС первого диска, и бэкап пойдёт туда же.

Проверка конфигурации (без записи):

```bash
doas btrbk config print
doas btrbk run -n
```

`btrbk run -n` — документированная dry-run форма. Реальный send в рамках
этого плана не выполняется.

---

## 12. Borg: репозитории, секреты, exclude policy

Два репозитория: `/mnt/backup/home.borg` и `/mnt/backup/etc.borg`. `/etc`
сохраняется отдельно для удобного file-level restore, даже несмотря на то,
что root также попадает в btrbk.

### 12.1. Инициализация и экспорт ключа

```bash
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup   # subvol=/@backup

doas mkdir -p /mnt/backup/home.borg /mnt/backup/etc.borg
doas borg init --encryption=repokey /mnt/backup/home.borg
doas borg init --encryption=repokey /mnt/backup/etc.borg
```

Сразу после init — экспорт ключа каждого репозитория:

```bash
doas borg key export /mnt/backup/home.borg <OFF-DEVICE-PATH>/home.borg.key
doas borg key export /mnt/backup/etc.borg  <OFF-DEVICE-PATH>/etc.borg.key
```

- при `repokey` основной ключ хранится внутри репозитория: export — не
  единственная копия, но защищает от corruption/loss ключа внутри репо;
- для recovery всё равно нужен passphrase;
- экспортированный ключ хранится **вне второго NVMe** и точно не на
  `@backup`;
- passphrase дополнительно сохраняется в password manager (off-device
  recovery context).

### 12.2. Passphrase для automation

Passphrase не должен появляться в systemd unit, command line или
example history — только в root-only файле:

```bash
doas install -d -m 0700 -o root -g root /etc/borg
doas nano /etc/borg/passphrase   # записать passphrase
doas chmod 0600 /etc/borg/passphrase
doas stat -c '%a %U:%G' /etc/borg/passphrase   # ожидается: 600 root:root
```

Borg-automation читает его через passcommand:

```bash
export BORG_PASSCOMMAND='cat /etc/borg/passphrase'
```

### 12.3. Exclude policy и dry-run проверка

Критичное правило: `/home/<username>/data` находится на том же втором NVMe,
что и target бэкапа. Borg `/home` **обязан исключать этот путь** — иначе
получится копия данных второго диска на тот же физический диск.

Exclude-паттерны — в нормализованной форме: Borg 1.2+ нормализует discovered
paths без leading slash, надёжная привязка — по пути без ведущего `/`:

- `home/<username>/data/` — критично, см. выше;
- `home/<username>/.cache/`;
- `home/<username>/llvm-project/`;
- `home/<username>/llvm-for-bolt-perf/`;
- `home/<username>/Downloads/`;
- `home/<username>/.steam/`;
- `home/<username>/.local/share/Trash/`;
- `*/.venv`, `*/__pycache__`, `*/node_modules`, `*.pyc`, `--exclude-caches`.

Перед первым реальным бэкапом — dry-run/list verification семантики
исключений (документированные возможности Borg):

```bash
doas mount /mnt/backup

doas borg create --dry-run --list \
  --exclude 'home/<username>/data/' \
  --exclude 'home/<username>/.cache/' \
  --exclude 'home/<username>/llvm-project/' \
  --exclude 'home/<username>/llvm-for-bolt-perf/' \
  --exclude 'home/<username>/Downloads/' \
  --exclude 'home/<username>/.steam/' \
  --exclude 'home/<username>/.local/share/Trash/' \
  --exclude '*/.venv' \
  --exclude '*/__pycache__' \
  --exclude '*/node_modules' \
  --exclude-caches \
  --exclude '*.pyc' \
  /mnt/backup/home.borg::dryrun \
  /home/<username> | tee /tmp/borg-dryrun.txt

# Все строки с data должны иметь статус 'x' (excluded)
grep 'home/<username>/data' /tmp/borg-dryrun.txt
```

> ⚠️ **Секреты**: `~/.ssh`, `~/.gnupg`, `~/.ansible_vault_pass`, `~/.mcp-auth`, `~/.codex`, `.claude.json`, `~/.mozilla` попадают в `home.borg`. Репозиторий зашифрован и лежит на зашифрованном диске — это допустимо. Но никогда не копируй их в открытый git/облако.

---

## 13. Автоматизация: один orchestration service + один timer

Вместо двух независимых таймеров, которые по отдельности mount/unmount один
и тот же `/mnt/backup`, — **один backup orchestration service и один
timer**. Один mount lifecycle, нет race между btrbk и Borg, один systemd
статус, одна точка failure reporting, простые soft-cold semantics.

Файл: `/usr/local/bin/second-disk-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_TARGET=/mnt/backup
REPO_HOME=$BACKUP_TARGET/home.borg
REPO_ETC=$BACKUP_TARGET/etc.borg
export BORG_PASSCOMMAND='cat /etc/borg/passphrase'

MOUNTED_BY_US=0

cleanup() {
  local rc=$?
  # Unmount гарантирован и при success, и при failure — но только свой mount
  if [[ $MOUNTED_BY_US -eq 1 ]] && findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
    umount "$BACKUP_TARGET" || rc=1
  fi
  exit "$rc"
}
trap cleanup EXIT

# 1. Чужой mount — явный fail, молча отмонтировать нельзя.
#    Именно --mountpoint: --target вернул бы ФС, содержащую путь
#    (корень первого диска), и блокировал бы каждый запуск
if findmnt --mountpoint "$BACKUP_TARGET" >/dev/null; then
  echo "ERROR: $BACKUP_TARGET is already mounted; unmount it manually and investigate" >&2
  exit 1
fi

# 2. Mount: без '|| true' — после failed mount бэкап не продолжается,
#    иначе запись пойдёт в пустой mountpoint на первом диске
mount "$BACKUP_TARGET"
MOUNTED_BY_US=1

# 3. btrbk: снапшоты корня + send/receive
btrbk run

# 4–5. Borg: /home и /etc
STAMP=$(date +%Y-%m-%d_%H:%M)

borg create --stats \
  --exclude 'home/<username>/data/' \
  --exclude 'home/<username>/.cache/' \
  --exclude 'home/<username>/llvm-project/' \
  --exclude 'home/<username>/llvm-for-bolt-perf/' \
  --exclude 'home/<username>/Downloads/' \
  --exclude 'home/<username>/.steam/' \
  --exclude 'home/<username>/.local/share/Trash/' \
  --exclude '*/.venv' \
  --exclude '*/__pycache__' \
  --exclude '*/node_modules' \
  --exclude-caches \
  --exclude '*.pyc' \
  "${REPO_HOME}::home-${STAMP}" \
  /home/<username>

borg create --stats \
  --exclude-caches \
  "${REPO_ETC}::etc-${STAMP}" \
  /etc

# 6. Retention + компактификация
for repo in "$REPO_HOME" "$REPO_ETC"; do
  borg prune --keep-daily 14 --keep-weekly 4 --keep-monthly 6 "$repo"
  borg compact "$repo"
done

# 7. Unmount — в trap (cleanup), и при success, и при failure
```

```bash
doas chmod +x /usr/local/bin/second-disk-backup.sh
```

Файл: `/etc/systemd/system/second-disk-backup.service`:

```ini
[Unit]
Description=Second-disk backup orchestration (btrbk + borg)

[Service]
Type=oneshot
ExecStart=/usr/local/bin/second-disk-backup.sh
IOSchedulingClass=idle
Nice=10
```

Файл: `/etc/systemd/system/second-disk-backup.timer`:

```ini
[Unit]
Description=Daily second-disk backup (btrbk + borg)

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Активация:

```bash
doas systemctl daemon-reload
doas systemctl enable --now second-disk-backup.timer
systemctl list-timers second-disk-backup.timer
```

---

## 14. Verification / acceptance

### 14.1. Design-time (этот документ)

Ничего из перечисленного ниже **live не проверялось**: схема — план.
`btrbk config print`, `btrbk run -n`, Borg dry-run здесь — будущие шаги
реализации, а не выполненные проверки. Отдельные concurrent-таймеры не
добавляются.

### 14.2. Будущий implementation acceptance

Минимальный набор проверок при реализации.

Диски и загрузка:

- [ ] identity выбранного диска подтверждена (§3: model/serial/size/WWN,
      зафиксирован by-id);
- [ ] LUKS passphrase unlock работает
      (`cryptsetup open --test-passphrase`);
- [ ] TPM unlock работает;
- [ ] reboot с исправным вторым диском — PASS: Gentoo грузится, `@data`
      смонтирован;
- [ ] второй диск не boot-critical — negative test: при отсутствии или
      неуспешном unlock второго диска boot Gentoo не ломается и не требует
      интерактивного passphrase (`nofail` + `headless`);
- [ ] после такого boot `/home/<username>/data` не принимает данные молча
      на первый диск — mountpoint root-owned, запись падает с ошибкой:

```bash
findmnt --mountpoint /home/<username>/data   # ожидается: не смонтирован
touch /home/<username>/data/test         # ожидается: Permission denied
```

Btrfs:

- [ ] существуют ровно ожидаемые `@data` и `@backup`;
- [ ] `findmnt` показывает правильные UUID/subvol для обеих точек;
- [ ] `@backup` после backup job снова unmounted.

btrbk:

- [ ] `btrbk config print` без ошибок;
- [ ] `btrbk run -n` показывает ожидаемые действия;
- [ ] выполнен manual first real backup;
- [ ] received subvolume существует в `/mnt/backup/gentoo`;
- [ ] бэкап открывается и читается;
- [ ] full disaster restore не заявляется как PASS без реального restore
      drill.

Borg:

- [ ] dry-run/list подтверждает exclude-семантику (§12.3);
- [ ] `home`-бэкап не содержит `home/<username>/data`;
- [ ] archives list/info доступны;
- [ ] `borg check` выполняется по принятой policy;
- [ ] passphrase recovery path проверен (passcommand и ручной ввод);
- [ ] exported repokey существует вне второго NVMe.

File restore test — безопасный restore в отдельный временном каталоге,
не `borg extract` в `/`:

```bash
doas mount /mnt/backup
mkdir /tmp/borg-restore-test
cd /tmp/borg-restore-test
doas borg extract /mnt/backup/etc.borg::etc-<DATE> etc/fstab
cat etc/fstab   # проверить содержимое
cd /
doas rm -rf /tmp/borg-restore-test
doas umount /mnt/backup
```

---

## 15. Rollback

**Отключить второй диск от загрузки** (если что-то не так):

```bash
# Убрать cryptdata и second-disk записи из fstab и crypttab
doas nano /etc/crypttab   # убрать cryptdata
doas nano /etc/fstab      # убрать @data и @backup
doas systemctl daemon-reload

# Отключить автоматизацию
doas systemctl disable --now second-disk-backup.timer

# Перезагрузка — Gentoo грузится независимо от второго NVMe
doas reboot
```

> Arch восстановить **нельзя** — диск затёрт (§6). Если dual-boot всё же нужен — это решение принимается до §5.

---

## 16. Risks

| Риск | Последствие | Митигация |
|------|-------------|-----------|
| Отказ первого (системного) NVMe | Система потеряна; локальные бэкапы остаются на втором диске | Восстановление `@` через btrbk/`btrfs receive` на новый диск + переустановка bootloader; критичное — дополнительно внешняя копия |
| Отказ второго NVMe | Локальный backup tier и `@data` потеряны; Gentoo работает | Принятый риск: `@data` — дополнительное/воспроизводимое хранилище; уникальные критичные данные — external/cloud copy |
| Потеря/кража ноутбука целиком | Оба локальных диска потеряны | External/cloud copy критичных данных вне ноутбука |
| TPM failure / изменение PCR | Автоанлок второго диска не работает | Независимый passphrase keyslot: ручной unlock + re-enroll TPM |
| Root compromise | Soft-cold не защищает: root может открыть LUKS и смонтировать `@backup` | Out of scope текущего design (граница — в §1); root-resistant модель требует другой архитектуры |
| Повреждение бэкапов | Часть архивов/снапшотов недоступна | Периодический `borg check`, restore drills |
| Утерян passphrase Borg / ключ репозитория | Зашифрованный Borg-бэкап недоступен | Passphrase в password manager; `borg key export` вне второго NVMe |
| Смена имён NVMe при замене дисков | fstab/crypttab не найдут устройство | UUID в fstab/crypttab; при setup — подтверждённый `/dev/disk/by-id/` |

---

## 17. Шпаргалка

```bash
# Открыть backup-target вручную (для проверки/restore)
doas mount /mnt/backup
findmnt --mountpoint /mnt/backup        # убедиться: subvol=/@backup

# Статус btrbk
doas btrbk list snapshots
doas btrfs subvolume list /mnt/backup/gentoo

# Статус borg (интерактивно спросит passphrase)
doas borg list /mnt/backup/home.borg
doas borg info /mnt/backup/home.borg::home-<DATE>
doas borg check --verify-data /mnt/backup/home.borg

# borg без ручного ввода passphrase
doas env BORG_PASSCOMMAND='cat /etc/borg/passphrase' borg list /mnt/backup/home.borg

# Восстановить файл/директорию — только в отдельный временный каталог
mkdir /tmp/borg-restore-test && cd /tmp/borg-restore-test
doas borg extract /mnt/backup/home.borg::home-<DATE> home/<username>/<path>

# Закрыть backup-target
doas umount /mnt/backup

# TPM/token статус обоих дисков
doas cryptsetup luksDump /dev/disk/by-id/<SECOND-NVME>-part1
doas cryptsetup luksDump /dev/nvme1n1p2
```

---

## 18. Ссылки

- [btrbk documentation](https://digint.ch/btrbk/) — конфигурация, retention, send/receive
- [borgbackup documentation](https://borgbackup.readthedocs.io/) — exclude-паттерны, restore, automation
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/systemd-cryptenroll.html) — TPM2-привязка
- [crypttab](https://www.freedesktop.org/software/systemd/man/crypttab.html) — опции LUKS через systemd (`nofail`, `headless`)
- [filesystem/btrfs-setup](../../../../filesystem/btrfs-setup/) — соглашения по subvols/опциям
- [installation/secure-boot-tpm](../../../../installation/secure-boot-tpm/) — модель TPM/LUKS первого диска
