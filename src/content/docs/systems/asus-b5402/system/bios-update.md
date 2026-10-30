---
title: Обновление BIOS/UEFI на ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Текущее состояние

- Установлен BIOS `B5402CBA.314` через ASUS Firmware Update/EZ Flash.
- Secure Boot включён, используются пользовательские ключи `sbctl`; Setup Mode выключен.
- Корневая система использует LUKS2 с интеграцией TPM2.
- Загрузка использует systemd-boot и UKI, которые генерирует Dracut.
  Подробности — в [разделе о загрузке и Portage](../boot-and-portage/).

## Перед обновлением

### Проверить модель и версию BIOS

Проверь, что система определяет модель ASUS ExpertBook B5402CBA и текущую
версию BIOS:

```bash
cat /sys/class/dmi/id/product_name
cat /sys/class/dmi/id/bios_version
```

### Проверить пароль для LUKS

До изменения Secure Boot вручную проверь пароль или recovery key корневого
LUKS. Сначала найди mapper корневой системы и его исходное устройство:

```bash
findmnt -no SOURCE,FSTYPE /
lsblk -o NAME,TYPE,FSTYPE,SIZE,MOUNTPOINTS
ROOT_MAPPER="REPLACE_WITH_ROOT_MAPPER_NAME"
doas cryptsetup status "$ROOT_MAPPER"
```

В выводе `cryptsetup status` поле `device:` показывает исходное LUKS-
устройство. Подставь этот путь в следующую команду и введи секрет только в
запрос cryptsetup:

```bash
ROOT_LUKS_DEVICE="REPLACE_WITH_ROOT_LUKS_DEVICE"
doas cryptsetup open --test-passphrase "$ROOT_LUKS_DEVICE"
```

Команда должна завершиться с кодом `0`. Выполни эту проверку вручную
непосредственно перед обновлением; пароль и recovery key не сохраняй в
репозитории.

### Проверить питание

Подключи ноутбук к адаптеру питания и убедись, что заряд батареи не ниже 20% —
это требование ASUS для обновления через EZ Flash.

## Проверка образа

Скачай прошивку только с [официальной страницы поддержки ASUS для
B5402CBA](https://www.asus.com/us/supportonly/b5402cba/helpdesk_bios/).
Выбирай **BIOS for ASUS EZ Flash Utility**, а не установщик Windows.

Укажи путь к архиву и проверь его. Сравни SHA-256 со значением, которое ASUS
опубликовала для выбранной версии:

```bash
BIOS_ZIP="$HOME/Downloads/REPLACE_WITH_ASUS_EZ_FLASH_ARCHIVE.zip"
sha256sum "$BIOS_ZIP"
unzip -t "$BIOS_ZIP"
unzip -l "$BIOS_ZIP"
```

Проверь, что архив исправен и содержит образ прошивки для модели `B5402CBA`.
По имени и описанию файла выбери образ для ASUS EZ Flash.

## Подготовка USB

Для ASUS EZ Flash нужен FAT32-раздел. Конкретная схема флешки, включая
Ventoy, не является требованием ASUS. Имена устройств могут меняться, поэтому
перед монтированием заново найди раздел по размеру, файловой системе и метке:

```bash
lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS,RO,RM
```

Укажи FAT32-раздел и имя файла прошивки из архива, затем распакуй образ во
временный каталог. Выполняй эти команды в одном сеансе оболочки, чтобы
сохранить значения переменных:

```bash
USB_FAT32_DEVICE="/dev/REPLACE_WITH_FAT32_PARTITION"
BIOS_FILE="REPLACE_WITH_FIRMWARE_IMAGE_FILENAME"
BIOS_DIR="$(mktemp -d)"

unzip -j "$BIOS_ZIP" "$BIOS_FILE" -d "$BIOS_DIR"
```

Смонтируй найденный раздел. В выводе `findmnt` проверь источник, файловую
систему FAT32 (`vfat`) и опцию `rw`:

```bash
doas mkdir -p /mnt/bios-usb
doas mount -o rw,nosuid,nodev,noexec,uid=$(id -u),gid=$(id -g),umask=022 \
  "$USB_FAT32_DEVICE" /mnt/bios-usb
findmnt -no SOURCE,FSTYPE,OPTIONS /mnt/bios-usb
```

Скопируй файл и сравни источник с копией. `cmp` не должен вывести различий;
после этого отключи раздел:

```bash
cp "$BIOS_DIR/$BIOS_FILE" /mnt/bios-usb/
sync -f /mnt/bios-usb
cmp "$BIOS_DIR/$BIOS_FILE" "/mnt/bios-usb/$BIOS_FILE"
doas umount /mnt/bios-usb
```

## Обновление BIOS

На этой workstation ASUS Firmware Update отклонял заведомо корректный
официальный образ, пока Secure Boot с пользовательскими ключами `sbctl` был
включён. После временного отключения только Secure Boot тот же проверенный
образ был принят. Это наблюдение относится к этой машине: оно не доказывает
внутреннюю причину поведения прошивки и не является универсальным правилом
ASUS.

1. Войди в UEFI клавишей `F2`.
2. Если ASUS Firmware Update отклонит проверенный образ при включённом Secure
   Boot, временно отключи только Secure Boot. Сохрани настройку, перезагрузи
   систему и снова войди в UEFI клавишей `F2`.
3. Не очищай TPM, PK, KEK, `db` или `dbx`. Не загружай настройки UEFI по
   умолчанию.
4. Открой ASUS Firmware Update / EZ Flash и выбери проверенный образ с FAT32-
   раздела.
5. Подтверди обновление и не отключай питание до его завершения и
   перезагрузки.
6. После обновления верни Secure Boot в исходное включённое состояние и
   загрузи Gentoo.

## Проверка после обновления

После загрузки проверь версию BIOS, состояние Secure Boot и доступность TPM2:

```bash
cat /sys/class/dmi/id/bios_version
cat /sys/class/dmi/id/bios_date
sbctl status
systemd-cryptenroll --tpm2-device=list
systemctl --failed
```

Ожидаемый результат:

- версия BIOS соответствует выбранному образу;
- Secure Boot включён, Setup Mode выключен;
- TPM2 доступен системе;
- Gentoo загрузился обычным путём с ожидаемой разблокировкой корневого LUKS2
  через TPM2;
- нет новых failed units, связанных с обновлением.

## Восстановление

- Если TPM2-разблокировка не сработала, используй заранее проверенный пароль или recovery key LUKS.
- Если Secure Boot не принимает UKI, временно отключи его, загрузи систему и
  проверь ключи и подписи через `sbctl`.
- Не очищай TPM, PK, KEK, `db` или `dbx` как первый способ восстановления.

## Источники

- [BIOS для ASUS ExpertBook B5402CBA](https://www.asus.com/us/supportonly/b5402cba/helpdesk_bios/)
- [Обновление BIOS через ASUS Firmware Update/EZ Flash](https://www.asus.com/support/faq/1008859/)
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html)
