---
title: Специфика ASUS ExpertBook B5402CBA
kind: system
scope: system
status: draft
last_verified: "2026-09-14"
verified_on: [asus-b5402]
---

## Current state

- Питанием управляет TLP; профили питания для Noctalia предоставляет `tlp-pd`.
- Заряд батареи ограничен 80%; батарея определяется как `BAT1`.
- В ядре включены `CONFIG_ASUS_WMI=m` и `CONFIG_ASUS_NB_WMI=m`;
  `CONFIG_ASUS_ARMOURY` отключён.
- Fn-клавиши и подсветка работают через asus-nb-wmi; обработка нажатий
  настроена binds в Niri.

## Управление питанием и батареей (TLP)

Питанием управляет `sys-power/tlp-1.10.1` с включёнными `ppd` и `rdw`.
`tlp-pd` предоставляет Noctalia стандартный интерфейс переключения профилей,
а `sys-power/upower` сообщает оболочке состояние батареи. Отдельный
`sys-power/power-profiles-daemon` не используется.

По умолчанию TLP выбирает `performance` от сети и `balanced` от батареи. Для
длительной автономной работы вручную доступен профиль `power-saver`.

Для продления ресурса аккумулятора при работе от сети заряд ограничен 80%.

Батарея в системе определяется как `BAT1`.

Файл: `/etc/tlp.d/99-custom.conf`

```conf
# Ограничение заряда для ASUS
STOP_CHARGE_THRESH_BAT1=80
```

Не задавать этот порог отдельно через UPower или напрямую через sysfs.

## Поддержка ASUS в ядре (Kconfig)

В сохранённой конфигурации Gentoo
(`/etc/portage/savedconfig/sys-kernel/gentoo-kernel`) включены:

- `CONFIG_ASUS_NB_WMI=m`: Основной драйвер для ноутбуков ASUS (горячие клавиши,
  Bluetooth, Wi-Fi).
- `CONFIG_ASUS_WMI=m`: Базовый WMI-драйвер ASUS; он также используется TLP для
  порога заряда батареи.
- `CONFIG_ASUS_WMI_DEPRECATED_ATTRS=y`: Требуется для совместимости с некоторыми
  старыми утилитами управления.

Исторический нюанс: `CONFIG_ASUS_ARMOURY` отключён. На этой модели драйвер не
предоставил полезных атрибутов управления питанием и выводил сообщение
`No matching power limits found for this system`. Изменение подействует после
следующей пересборки и загрузки нового ядра; `CONFIG_ASUS_WMI` остаётся
включённым.

## Функциональные клавиши и индикация

Работа клавиш Fn и системных индикаторов обеспечивается модулем asus-nb-wmi.

- **Подсветка клавиатуры**: Регулируется через
  `/sys/class/leds/asus::kbd_backlight`.
- **Мультимедиа клавиши**: В тайловом композиторе (Niri) обработка нажатий
  настроена через binds, вызывающие:
  - `light` — Для управления яркостью дисплея.
  - `wpctl` — Для управления звуковыми потоками Pipewire.

## Состояние аккумулятора

Показатели на 2026-09-14:

- **Design Capacity**: 5260 mAh
- **Full Charge Capacity**: 4301 mAh
- **Health (Capacity)**: 81.8%
- **Cycle Count**: 137

## Verification

```bash
doas tlp-stat -s
tlpctl list
doas tlp-stat -b
```

На 2026-09-14 `tlp-stat -b` подтверждает активный плагин `natacpi (asus_wmi)`,
значение `charge_control_end_threshold = 80` и состояние `Not charging` при
заряде 80.3%.

## Related docs

- [Niri](../../../../desktop/niri/) — обработка мультимедиа-клавиш.
- [Оптимизация CPU: Intel Alder Lake](../cpu-optimization/)
