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
вручную включается и выключается из Linux. Идентификация hardware/firmware
`ASUS WMI DEVID 0x00040019 ↔ CFLD` и ручное бинарное управление —
**CLOSED / PASS** (2026-10-03).

**Gate 3D — Windows reference implementation: CLOSED / PASS**.
Статический анализ официальной ASUS Business Utility подтвердил
`0x00040019` как бинарный control физического LED. Трёхрежимная
Auto/Busy/Off policy хранится и применяется Windows userspace.

В Linux сейчас доступен только временный diagnostic LED class interface
`asus::cfld-test` из локального kernel patch. Следующий отдельный
Gate 4 — финальное kernel LED name/API и поддержка уровня upstream.

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

## Windows reference implementation

Gate 3D завершён 2026-10-03: официальные Windows packages для B5402CBA
исследованы статически. Основной компонент — ASUS Business Utility
`3.5.35.0`, содержащий `cceventapp.exe` и `confled.dll`.
FileDescription у `confled.dll` — `Conference LED support package`.
Это имя компонента, а не доказанная расшифровка firmware field `CFLD`.

```text
ASUS Business Utility
  ↓
confled.dll (Conference LED support package)
  ↓
mode 0/1/2 in HKCU
  ├─ Auto → audio-session-derived state
  ├─ Busy → LED ON
  └─ Off  → LED OFF
  ↓
DEVS(0x00040019, 0|1)
  ↓
CFLD
  ↓
physical LED
```

### Бинарное управление LED — PROVEN

`confled.dll` непосредственно использует `DSTS(0x00040019)` для проверки
presence/status и `DEVS(0x00040019, 0|1)` для включения/выключения.
Доказаны два transport path:

| Transport | Вызов |
|-----------|-------|
| ATKACPI | `DeviceIoControl` для `\\.\ATKACPI`, IOCTL `0x22240C`, payload `{'DEVS', 8, 0x00040019, status}` |
| WMI | `ExecMethod` через `AsusAtkWmi_WMNB`, instance `ACPI\PNP0C14\ATK_0`, `Device_ID = 0x00040019`, `Control_status = 0\|1` |

Это независимое подтверждение: найденный Linux firmware path совпадает
с официально используемым ASUS способом управления User-status / Conference LED.

### Mode policy в userspace — PROVEN

Состояние хранится как `REG_DWORD mode` в
`HKCU\Software\ASUS\ASUSBusinessUtility`. При старте значение читается
и ограничивается диапазоном `0..2`; default — `0`. При переключении
mode записывается обратно в registry.

`ConfLedService::onEvent` переключает `0 → 1 → 2 → 0`.
Поведение `ApplyMode` доказано; названия режимов восстановлены по
официальной документации ASUS и статическому поведению (**STRONG**).
Это reader-facing labels, а не найденные в binary C enum constants.

| mode | Поведение `ApplyMode` — PROVEN | Название — STRONG |
|------|-------------------------------|------------------|
| `0` | `SetStatus(session state)` | Auto |
| `1` | `SetStatus(true)` | Solid Orange / Busy / In a meeting |
| `2` | `SetStatus(false)` | Light off |

### Auto: доказанный механизм и граница вывода

**PROVEN:** Auto policy реализована в Windows userspace-компоненте
`confled.dll`. Используются `AudioSessionMonitor`,
`MeetingAudioSessionNotification`, `MeetingAudioSessionEvents` и
`IAudioSessionManager2`; отдельный monitoring thread ждёт примерно
`3000 ms`. Только в Auto mode LED получает session-derived state.

**STRONG:** автоматическое состояние определяется Windows Core Audio /
capture-session activity. Полный predicate определения capture session
не дизассемблирован до конца, поэтому это не полностью доказанное
универсальное правило. Process allowlist для Teams/Zoom/Discord/Meet не
найден; camera/WebRTC сами по себе не доказаны как criterion этого path.

В исследованном Windows control path физический LED управляется как
бинарная capability через `DSTS/DEVS(0x00040019)`, а Auto/Busy/Off policy
применяется userspace. Отдельный firmware mode interface в этом path не
найден. Это не исключает иных неизвестных mode-related capabilities или
control registers firmware.

### Fn+1 и маршрутизация событий

Ранее на Linux подтверждено: Fn+1 выдаёт ASUS WMI event `0x61`, который
штатный `asus-nb-wmi` сопоставляет с `KEY_SWITCHVIDEOMODE`.
В Windows `ConfLedService::onEvent(0x61)` обрабатывает событие и переключает
mode; также обрабатываются `0x62–0x64` и часть `0x10–0x1b`.

`confled.dll` — доказанный обработчик `0x61` для Conference LED path,
когда событие маршрутизировано в `ConfLedService`. Полный routing
`cceventapp.exe → FunctionCommandList / ExpertWidget assignments → plugin`
не восстановлен до конца. Поэтому прямую обработку любого Fn+1 этим
компонентом считать доказанной нельзя.

ExpertWidget предоставляет UI/resources и назначение функций Fn+1…Fn+4;
`ConfLedService` есть среди доступных команд. Это configuration surface,
а не доказанная реализация physical LED control. В исследованной ASUS
System Control Interface v3 code usage `0x00040019` не найден.

### Пакет и воспроизводимость

Источник — [официальная ASUS B5402CBA support/download page](https://www.asus.com/supportonly/b5402cba/helpdesk_download/).
Исследован пакет ASUS Business Utility `3.5.35.0`, опубликованный `2025-01-16`.
SHA-256 пакета:

```text
2d64897952378f2ed90a9a9c3b14c8e6295c46e52e1af7d1d84193b008974a9b
```

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

Идентификация hardware/firmware, ручное бинарное управление и Gate 3D
закрыты. ASUS Windows Auto policy исследована статически с описанными
выше границами; Linux implementation Auto отсутствует.

Следующий отдельный **Gate 4** — финальное kernel LED name/API и
production/upstream-quality Linux binary LED support. Диагностический
`asus::cfld-test` не является финальным именем, текущий patch не upstream-ready.
Fn+1 remapping и Linux userspace conference policy в Gate 4 не входят;
автоматическая интеграция с PipeWire, camera, microphone или conferencing
applications не реализована. Расшифровка `CFLD` остаётся неизвестной.

## Related docs

- [Специфика ASUS ExpertBook B5402CBA](../asus-expertbook/)
- [ASUS ExpertBook B5402](../../)
