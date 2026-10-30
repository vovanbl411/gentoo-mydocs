---
title: User-status indicator ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

Внешний User-status indicator на крышке доступен через бинарный kernel LED
ABI `/sys/class/leds/:status` (`0` — выключен, `1` — включён). Для ASUS WMI
устройства с ID `0x00040019` используется локальный version-specific patch
`/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.13/10-asus-wmi-user-status-led.patch`.
Ядро ноутбука собирается на `gentoo-builder-01` как GPKG и устанавливается из
binrepo; порядок обновления описан в [руководстве по загрузке и Portage](../../system/boot-and-portage/).

Userspace-контроллер [`asus-user-status-led`](https://github.com/vovanbl411/asus-user-status-led)
реализует режимы `auto`, `busy` и `off`. Сервис `user-status-led.service`
запускает `~/.local/bin/user-status-led`. Режим `auto` включает индикатор при
активном PipeWire capture, когда активная связь соединяет `Audio/Source` с
работающим `Stream/Input/Audio`; `busy` включает его постоянно, `off` выключает.

В конфигурации Umbriel клавиша `XF86Display` вызывает
`~/.local/bin/user-status-led cycle`; Fn+1 переключает режимы через эту
привязку.

## Локальный kernel patch

Патч добавляет ASUS WMI device ID `0x00040019` как бинарное LED-устройство с
`max_brightness = 1`. Чтение и запись состояния идут через ASUS WMI. Устройство
регистрируется только после успешного чтения текущего состояния. В результате
появляется ABI `/sys/class/leds/:status`.

Патч привязан к версии `sys-kernel/gentoo-kernel`. При обновлении ядра переноси
его в новый version-specific каталог только после проверки применимости к
новым исходникам и проверки, не появилась ли поддержка upstream. История
исследования и upstream submission сохранена в
[исследовании User-status indicator](../../../../experiments/asus-user-status-indicator/).

## Проверка состояния

```bash
uname -r
ls -l /sys/class/leds/:status
cat /sys/class/leds/:status/max_brightness
cat /sys/class/leds/:status/brightness
systemctl --user status user-status-led.service --no-pager
```

Для текущего ядра ожидается LED ABI `:status` с `max_brightness` равным `1`;
user service запускает `~/.local/bin/user-status-led daemon`.

## Связанные документы

- [Специфика ASUS ExpertBook B5402CBA](./asus-expertbook/)
- [Загрузка и Portage](../../system/boot-and-portage/) — сборка version-specific
  kernel GPKG на builder и установка на ноутбук из binrepo.
- [Исследование ASUS User-status indicator](../../../../experiments/asus-user-status-indicator/)
