---
title: User-status indicator ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-10-03"
verified_on: [asus-b5402]
---

## Current state

Внешний оранжевый User-status indicator на крышке ASUS ExpertBook B5402CBA
вручную включается и выключается из Linux. Физическая проверка 2026-10-03
подтвердила соответствие `ASUS WMI DEVID 0x00040019 ↔ CFLD`.
Идентификация hardware/firmware и ручное управление — **CLOSED / PASS**.

Сейчас доступен временный LED class interface `asus::cfld-test`, добавленный
диагностическим локальным kernel patch. Это механизм проверки; финальное
имя и полноценная поддержка ещё не приняты как решение.

## Аппаратный и firmware путь

```text
ASUS ExpertBook B5402CBA User-status indicator
        ↕
ASUS WMI DEVID 0x00040019
        ↕
firmware field CFLD
        ↕
asus-wmi DEVS / DSTS
```

Поле `CFLD` находится в EC/platform-backed области DSDT рядом с `KBLS` и
`MICS`. DSTS читает состояние, DEVS записывает его при доступном EC.
Точная расшифровка имени `CFLD` не найдена.

## Почему штатный Linux не показывал индикатор

В Linux stable 7.2.8 файл `include/linux/platform_data/x86/asus-wmi.h`
содержит известные DEVID:

| Define | DEVID |
|--------|-------|
| `ASUS_WMI_DEVID_MICMUTE_LED` | `0x00040017` |
| `ASUS_WMI_DEVID_LIGHTBAR` | `0x00050025` |
| `ASUS_WMI_DEVID_CAMERA_LED` | `0x00060079` |

Upstream-драйвер не знает `0x00040019` и не создаёт для него LED class device.
До эксперимента в `/sys/class/leds/` были `platform::micmute` и
`asus::kbd_backlight`, но отдельного User-status LED не было.

## Firmware evidence

В DSDT BIOS `B5402CBA.314` для `0x00040019` реализовано чтение через DSTS:

```text
If ((IIA0 == 0x00040019))
{
    Local0 = 0x00010000
    If (^^PC00.LPCB.EC0.CFLD)
    {
        Local0 |= One
    }

    Return (Local0)
}
```

`0x00010000` — `ASUS_WMI_DSTS_PRESENCE_BIT`; младший status bit сообщает
текущее состояние. Запись через DEVS:

```text
If ((IIA0 == 0x00040019))
{
    If (^^PC00.LPCB.ECOK ())
    {
        If ((IIA1 == One))
        {
            ^^PC00.LPCB.EC0.CFLD = One
        }
        Else
        {
            ^^PC00.LPCB.EC0.CFLD = Zero
        }

        Return (One)
    }
}
```

Это отдельный read/write contract: соседнее поле `MICS` используется
известным `ASUS_WMI_DEVID_MICMUTE_LED = 0x00040017`.

Две публично сохранённые DSDT для `ASUS EXPERTBOOK B5402CBA_B5402CBA` также
содержат механизм `0x00040019 ↔ CFLD`. Capability не ограничена единственной
проверенной DSDT BIOS 314; физическое управление подтверждено на системе,
указанной в Verification.

Источники в [asus-linux-drivers/asus-dsdt-tables](https://github.com/asus-linux-drivers/asus-dsdt-tables), ссылки закреплены на commit:

- [ASUS_EXPERTBOOK_B5402CBA_B5402CBA_14717d7a8234.dsl](https://github.com/asus-linux-drivers/asus-dsdt-tables/blob/b1058fccee0d43f373e3b06c03ca5dac9fab7418/data/ASUS_EXPERTBOOK_B5402CBA_B5402CBA_14717d7a8234.dsl)
- [ASUS_EXPERTBOOK_B5402CBA_B5402CBA_1a4ea24a479d.dsl](https://github.com/asus-linux-drivers/asus-dsdt-tables/blob/b1058fccee0d43f373e3b06c03ca5dac9fab7418/data/ASUS_EXPERTBOOK_B5402CBA_B5402CBA_1a4ea24a479d.dsl)

Другие проверенные кандидаты:

- `ASUS_WMI_DEVID_LIGHTBAR = 0x00050025` и
  `ASUS_WMI_DEVID_CAMERA_LED = 0x00060079` не имеют явных DSTS/DEVS branches
  в исследованном `WMNB` и не экспонировались штатным `asus-wmi` на этой
  системе; они не подтвердились как механизм User-status indicator.
  В `WMNB` есть generic fallback через `WCHK → W15H`, поэтому отсутствие
  явной ветки само по себе не доказывает отсутствие поддержки firmware.
- `0x00060078` отвергается firmware с `0xFFFFFFFE`.
- `0x00050027` и `0x00060074` имеют явные ветки, возвращающие `Zero`;
  применимая семантика управления User-status indicator по ним не установлена.
  Значение `Return (Zero)` зависит от вызываемого WMI method/context.
- `LBLV` / `LBLS` только объявлены и не используются;
  `WLED` / `BLED` — stubs, возвращающие `Zero`.

## Diagnostic kernel patch

Файл: `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.8/10-asus-wmi-cfld-test.patch`

Минимальный Gentoo user patch добавляет:

- временный define для DEVID `0x00040019`;
- `struct led_classdev cfld_led`;
- чтение через `asus_wmi_get_devstate()` и запись через
  `asus_wmi_set_devstate()`;
- регистрацию только при подтверждении capability через
  `asus_wmi_dev_is_present()`;
- диагностическое имя `asus::cfld-test`.

Имя намеренно временное, чтобы не закреплять семантику до отдельного решения.
Patch использован для validation и не считается готовым к upstream.

Writable ASUS debugfs interface был недоступен из-за kernel lockdown
`integrity`. Secure Boot и lockdown ради исследования не отключались.

## Verification

Проверено на live-системе 2026-10-03:

| Параметр | Значение |
|----------|----------|
| Модель | ASUS ExpertBook B5402CBA |
| BIOS | `B5402CBA.314` |
| Kernel | `7.2.8-bdsm` |
| Пакет | `sys-kernel/gentoo-kernel-7.2.8` |
| ASUS WMI | `CONFIG_ASUS_WMI=m`, `CONFIG_ASUS_NB_WMI=m` |
| Secure Boot | включён |
| Kernel lockdown | `integrity` |

После пересборки пакета с диагностическим patch и загрузки `7.2.8-bdsm`
зарегистрирован `/sys/class/leds/asus::cfld-test`. Проверка наличия и чтение:

```bash
ls -l /sys/class/leds/asus::cfld-test
cat /sys/class/leds/asus::cfld-test/max_brightness
cat /sys/class/leds/asus::cfld-test/brightness
```

Подтверждённая цель symlink:

```text
../../devices/platform/asus-nb-wmi/leds/asus::cfld-test
```

Прочитаны `max_brightness = 1` и `brightness = 0`.
Команды ниже применимы к системе с этим patch и зарегистрированным LED.
Они меняют состояние физического индикатора; запись `0` выключает его.

Включение:

```bash
printf '1\n' | doas tee /sys/class/leds/asus::cfld-test/brightness
```

Выключение:

```bash
printf '0\n' | doas tee /sys/class/leds/asus::cfld-test/brightness
```

Физическая проверка 2026-10-03: `1` зажёг именно внешний оранжевый
User-status indicator на крышке; `0` погасил тот же индикатор. **ON/OFF — PASS**.

## Ограничения и следующий этап

Идентификация hardware/firmware и ручное управление закрыты.
Отдельным следующим этапом остаются финальное имя LED и решение о
поддержке upstream. Диагностический patch не является upstream-ready interface.

Автоматическая связь с PipeWire, camera, microphone или conferencing
applications не реализована. Поведение `auto` mode не исследовано и не
реализовано. Расшифровка `CFLD` остаётся неизвестной.

## Related docs

- [Специфика ASUS ExpertBook B5402CBA](../asus-expertbook/)
- [ASUS ExpertBook B5402](../../)
