---
title: Специфика ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- Питанием управляет TLP. `tlp-pd` предоставляет интерфейс профилей питания
  для Noctalia; оба сервиса запущены.
- Порог зарядки `BAT1` задан на 80% в `/etc/tlp.d/99-custom.conf`.
- В работающем ядре включены `CONFIG_ASUS_WMI=m`,
  `CONFIG_ASUS_NB_WMI=m` и `CONFIG_ASUS_WMI_DEPRECATED_ATTRS=y`.
- Основной рабочий стол — Umbriel. Его конфигурация обрабатывает клавиши
  яркости через `brightnessctl`, клавиши звука через `wpctl`, а `XF86Display`
  запускает переключение режима User-status indicator.
- Kernel User-status LED ABI и userspace-режимы описаны на [отдельной
  странице](../user-status-indicator/).

## Питание и батарея

TLP управляет профилями питания и порогом зарядки. `tlp-pd` предоставляет
Noctalia интерфейс переключения профилей; состояние батареи оболочка получает
через `sys-power/upower`. Отдельный `sys-power/power-profiles-daemon` не
используется.

В `/etc/tlp.d/99-custom.conf` для AC и обычного режима батареи включён Intel
HWP dynamic boost. Для профиля `power-saver` он отключён. Порог заряда
ограничивает заряд `BAT1` значением 80%.

Файл: `/etc/tlp.d/99-custom.conf`

```conf
STOP_CHARGE_THRESH_BAT1=80
CPU_HWP_DYN_BOOST_ON_AC=1
CPU_HWP_DYN_BOOST_ON_BAT=1
CPU_HWP_DYN_BOOST_ON_SAV=0
```

Не задавай этот порог отдельно через UPower или напрямую через sysfs.

## Поддержка ASUS в ядре

В конфигурации работающего ядра включены:

- `CONFIG_ASUS_WMI=m` — базовый ASUS WMI-драйвер; его использует TLP для
  порога зарядки.
- `CONFIG_ASUS_NB_WMI=m` — драйвер ноутбуков ASUS, включая горячие клавиши и
  системные индикаторы.
- `CONFIG_ASUS_WMI_DEPRECATED_ATTRS=y` — атрибуты совместимости для старых
  утилит управления.

`CONFIG_ASUS_ARMOURY` не используется: для этой модели он не предоставляет
нужных атрибутов управления питанием.

## Клавиши и индикаторы

Umbriel использует `~/.config/umbriel/keybinds.toml` для обработки
multimedia/Fn-клавиш:

- `XF86MonBrightnessUp` и `XF86MonBrightnessDown` меняют яркость через
  `brightnessctl --class=backlight`.
- Клавиши громкости и mute вызывают `wpctl`; управление воспроизведением
  передано `playerctl`.
- `XF86Display` запускает `~/.local/bin/user-status-led cycle`; нажатие Fn+1
  переключает режимы индикатора через эту привязку.
- Подсветка клавиатуры доступна через
  `/sys/class/leds/asus::kbd_backlight`.

Umbriel — [основной рабочий стол](../../desktop/environment/); установка и
конфигурация описаны в [руководстве Umbriel](../../../../desktop/umbriel/).

## Проверка состояния

```bash
doas tlp-stat -s
doas tlp-stat -c
doas tlp-stat -b
cat /sys/devices/system/cpu/intel_pstate/hwp_dynamic_boost
```

Проверь, что TLP и `tlp-pd` запущены, `BAT1` использует порог 80%, а значение
`hwp_dynamic_boost` соответствует текущему профилю питания.

## Связанные документы

- [User-status indicator](../user-status-indicator/)
- [Загрузка и Portage](../../system/boot-and-portage/) — сборка version-specific
  kernel GPKG на builder и установка на ноутбук из binrepo.
- [Оптимизация CPU: Intel Alder Lake](../cpu-optimization/)
