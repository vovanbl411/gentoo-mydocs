---
title: Обновление BIOS/UEFI на ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-09-09"
verified_on: [asus-b5402]
---

## Current result

Обновление BIOS с версии `313` до `314` через ASUS Firmware Update/EZ Flash
выполнено успешно (2026-09-09). На системе используются Secure Boot с ключами
`sbctl`, LUKS2 и автоматическая разблокировка через TPM2.

- BIOS: `B5402CBA.314`, дата образа из DMI — `06/02/2026`.
- Secure Boot: восстановлен и включён после обновления, Setup Mode отключён.
- TPM2/LUKS auto-unlock: работает после обновления — корневой LUKS-раздел
  разблокировался автоматически (`/dev/tpmrm0`).
- Ошибочных systemd-юнитов нет.

Важный нюанс этой машины: при включённом Secure Boot с пользовательскими
ключами `sbctl` ASUS Firmware Update отклонял официальный образ — контрольная
сумма, модель и версия файла были правильными. Обновление сработало только
после временного отключения Secure Boot (см. [Firmware update](#firmware-update)).
Это наблюдение конкретной машины, а не универсальное свойство прошивки ASUS.

## Prerequisites

Перед изменением Secure Boot нужно проверить резервный способ разблокировки
корневого LUKS-раздела:

```bash
doas cryptsetup open --test-passphrase /dev/nvme1n1p2
```

Команда должна завершиться с кодом `0`. Пароль или recovery key нельзя
сохранять в репозитории.

Ноутбук должен быть подключён к блоку питания. ASUS требует не менее 20%
заряда батареи; перед этим обновлением было 80%.

## Image verification

Скачивать нужно вариант **BIOS for ASUS EZ Flash Utility** для модели
`B5402CBA`, а не Windows installer.

Для архива `B5402CBAAS314.zip`:

```bash
sha256sum "$HOME/Downloads/B5402CBAAS314.zip"
unzip -t "$HOME/Downloads/B5402CBAAS314.zip"
unzip -l "$HOME/Downloads/B5402CBAAS314.zip"
```

Проверенный SHA-256 архива:

```text
bfb12fb5b44a5f2d4b0a47be221802a66e50536bbf43850c20a9541a4d79c48d
```

В архиве должен находиться один файл `B5402CBAAS.314`. Его внутренний
идентификатор модели — `B5402CBA`.

## USB preparation

На использованной флешке были три раздела:

- основной раздел Ventoy — exFAT;
- служебный `VTOYEFI`;
- отдельный раздел FAT32 размером 1 GiB для прошивок.

Имена `/dev/sdX` могут измениться. Перед монтированием нужно заново определить
FAT32-раздел:

```bash
lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS,RO,RM
```

В проверенном обновлении это был `/dev/sda3` — в другой сессии имя может
отличаться, ориентируйся на `lsblk`:

```bash
doas mkdir -p /mnt/bios-usb
doas mount -o rw,nosuid,nodev,noexec,uid=$(id -u),gid=$(id -g),umask=022 \
  /dev/sda3 /mnt/bios-usb
findmnt -no SOURCE,FSTYPE,OPTIONS /mnt/bios-usb
```

В выводе `findmnt` должна быть опция `rw`. Если раздел оказался смонтирован
только для чтения:

```bash
doas mount -o remount,rw /mnt/bios-usb
```

Распаковка и копирование:

```bash
mkdir -p /tmp/b5402-bios-314
unzip -j "$HOME/Downloads/B5402CBAAS314.zip" B5402CBAAS.314 \
  -d /tmp/b5402-bios-314
cp /tmp/b5402-bios-314/B5402CBAAS.314 /mnt/bios-usb/
sync -f /mnt/bios-usb
cmp /tmp/b5402-bios-314/B5402CBAAS.314 \
  /mnt/bios-usb/B5402CBAAS.314
doas umount /mnt/bios-usb
```

`cmp` не должен выводить различий. Проверенный SHA-256 распакованного файла:

```text
fba0d81fe3fd1739bddf798f2acc1c5704be56c180830fbc65ffd899f079f4c7
```

## Firmware update

При включённом Secure Boot ASUS Firmware Update отклонял официальный образ с
сообщением, что выбранный файл не подходит для обновления BIOS. Контрольная
сумма, модель и версия файла при этом были правильными.

На этой системе причиной оказалась проверка при включённом Secure Boot с
пользовательскими ключами `sbctl`. Сработала такая последовательность:

1. Войти в UEFI клавишей `F2`.
2. Отключить только Secure Boot.
3. Не очищать TPM, PK, KEK, `db` или `dbx` и не загружать настройки UEFI по
   умолчанию.
4. Сохранить настройки и перезагрузиться.
5. Снова войти в UEFI, открыть `Advanced` → `ASUS Firmware Update` или
   `ASUS EZ Flash` и выбрать `B5402CBAAS.314` на FAT32-разделе.
6. Подтвердить обновление и не отключать питание до автоматической
   перезагрузки.
7. После обновления снова включить Secure Boot и загрузить систему.

## Post-update verification

```bash
cat /sys/class/dmi/id/bios_version
cat /sys/class/dmi/id/bios_date
sbctl status
systemd-cryptenroll --tpm2-device=list
systemctl --failed
```

Результат проверки 2026-09-09:

- BIOS: `B5402CBA.314`;
- дата образа из DMI: `06/02/2026`;
- Secure Boot включён, Setup Mode отключён;
- TPM2 определяется как `/dev/tpmrm0`;
- корневой LUKS-раздел автоматически разблокировался через TPM2;
- ошибочных systemd-юнитов нет.

## Recovery notes

Если TPM2-разблокировка не сработает, нужно использовать заранее проверенный
пароль LUKS. Если после включения Secure Boot прошивка отклонит подписанный UKI,
следует временно отключить Secure Boot, загрузить систему и проверить ключи и
подписи через `sbctl`. TPM и ключевые базы UEFI очищать нельзя.

## Sources

- [BIOS для ASUS ExpertBook B5402CBA](https://www.asus.com/us/supportonly/b5402cba/helpdesk_bios/)
- [Обновление BIOS через ASUS Firmware Update/EZ Flash](https://www.asus.com/support/faq/1008859/)
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html)
