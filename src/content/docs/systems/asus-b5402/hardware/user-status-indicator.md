---
title: User-status indicator ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Current state

По записи 2026-10-07 внешний оранжевый индикатор на крышке работает через
`/sys/class/leds/:status` на `7.2.9-bdsm`. Физический ON/OFF прошёл приёмку
2026-10-04. Локальный Gentoo patch совпадает по design с submitted upstream v1:
регистрация после успешного чтения состояния, без DMI whitelist и trigger.

### Локальный kernel patch

Файл: `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.9/10-asus-wmi-user-status-led.patch`

Патч добавляет `ASUS_WMI_DEVID_USER_STATUS_LED = 0x00040019` и бинарный LED
class device с `max_brightness = 1`, `brightness_set_blocking`, чтением через
`asus_wmi_get_devstate_simple()` и записью через `asus_wmi_set_devstate()`.
Регистрация требует `asus_wmi_get_devstate_simple(...) >= 0`.
ABI — `":" LED_FUNCTION_STATUS`.

### Upstream status

v1 submitted / awaiting review; принятие или merge не подтверждены.
[Submission и проверки](../../../../experiments/asus-user-status-indicator/#upstream-v1)
сохранены в исследовании. v2 готовится только по конкретному review feedback
или при обнаружении новой проблемы.

## Userspace на Gentoo

Ядро предоставляет бинарное управление LED (`0/1`); режимы `auto`, `busy` и
`off` реализованы отдельно в userspace. На этой системе работает
[`asus-user-status-led`](https://github.com/vovanbl411/asus-user-status-led):
`busy` включает индикатор, `off` выключает, а `auto` следует за активным
потребителем реального PipeWire `Audio/Source`. Подробная реализация,
архитектура и установка описаны в отдельном проекте; эта страница фиксирует
hardware/kernel path и его интеграцию на Gentoo.

Live functional acceptance на ASUS ExpertBook B5402CBA прошёл: ручные `busy` и
`off`; `auto` в простое; захват через `pw-record` с переходом ON → OFF;
отсутствие ложного срабатывания от Noctalia Spectrum; реальный вызов Vesktop
с включением LED, сохранением ON при mute приложения и выключением после
выхода из вызова; цикл режимов через Fn+1; исправление AUTO CPU feedback loop.
Fn+1 проходит через firmware event `0x61` → `KEY_SWITCHVIDEOMODE` →
`XF86Display` → Niri → `user-status-led`; одно физическое нажатие даёт один
переход режима. Сервис активен, а возврат в `auto` во время активного вызова
сразу повторно оценивает состояние PipeWire. Исправление CPU-loop проверено:
в простое работает один долгоживущий `pw-dump --monitor`, обычный `pw-dump`
не запускается непрерывно, CPU usage низкий.

Открыты две проверки: визуальная оценка restart-flicker и reboot/login
lifecycle. После входа ещё нужно подтвердить сохранённый режим, запуск user
service, udev permissions, обычный старт `auto`, отсутствие возврата CPU-loop
и работу Fn+1.

## Verification

Проверено на live-системе 2026-10-04:

| Параметр | Значение |
|----------|----------|
| Модель | ASUS ExpertBook B5402CBA |
| BIOS | `B5402CBA.314` |
| Kernel | `7.2.9-bdsm` |
| Пакет | `sys-kernel/gentoo-kernel-7.2.9` |
| Registration | `asus_wmi_get_devstate_simple(...) >= 0` |

После загрузки `7.2.9-bdsm` зарегистрирован `/sys/class/leds/:status`;
`orange:status` отсутствует. Проверка наличия и чтение состояния:

```bash
uname -r
ls -l /sys/class/leds/:status
cat /sys/class/leds/:status/max_brightness
cat /sys/class/leds/:status/brightness
```

Подтверждённая цель symlink:

```text
../../devices/platform/asus-nb-wmi/leds/:status
```

Live-значения: `max_brightness = 1`, `brightness = 0`. Команды ниже меняют
состояние физического индикатора; запись `0` выключает его.

Включение:

```bash
printf '1\n' | doas tee /sys/class/leds/:status/brightness
```

Выключение:

```bash
printf '0\n' | doas tee /sys/class/leds/:status/brightness
```

Физическая проверка 2026-10-04: `1` зажёг именно внешний оранжевый
User-status indicator на крышке; `0` погасил тот же индикатор.

| Live acceptance 2026-10-04 | Результат |
|----------------------------|-----------|
| `7.2.9-bdsm` boot | PASS |
| Registration `:status` | PASS |
| `orange:status` отсутствует | PASS |
| `max_brightness = 1` | PASS |
| DSTS state read | PASS |
| DEVS write `1` → physical LED ON | PASS |
| DEVS write `0` → physical LED OFF | PASS |

## Related docs

- [Специфика ASUS ExpertBook B5402CBA](../asus-expertbook/)
- [ASUS ExpertBook B5402](../../)
- [Идентификация firmware, Windows reference, выбор ABI и историческая диагностика](../../../../experiments/asus-user-status-indicator/)
