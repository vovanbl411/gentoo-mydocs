---
title: Исследование ASUS User-status indicator
kind: reference
scope: system
status: historical
last_verified: "2026-10-04"
verified_on: [asus-b5402]
---

## Краткий итог

Индикатор на крышке управляется из Linux через
`ASUS WMI DEVID 0x00040019 ↔ CFLD`. Анализ DSDT, статическое исследование ASUS
Business Utility и физическая проверка ON/OFF установили один и тот же
бинарный control path. Итоговый kernel design экспонирует `:status` после
успешного чтения состояния, без DMI whitelist и trigger. Upstream v1 отправлен;
принятие или merge в записанном состоянии не подтверждены.

## Вопрос и результат

Как управлять User-status indicator из Linux без отключения Secure Boot и
lockdown и какой интерфейс подходит generic driver? Штатный Linux 7.2.8 не
создавал для него LED device. При исследовании firmware найдены DSTS/DEVS
branches для `0x00040019`; diagnostic patch позволил проверить физический
индикатор. Auto/Busy/Off — userspace policy поверх бинарного управления LED;
firmware mode interface в исследованном path не найден.

Текущая Gentoo-интеграция и незавершённые lifecycle-проверки описаны на
[системной странице](../../systems/asus-b5402/hardware/user-status-indicator/).

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
указанной в [проверке итогового ABI](#физическая-проверка-итогового-abi).

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

## Выбор Linux implementation

Файл: `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.9/10-asus-wmi-user-status-led.patch`

Production-style local Gentoo user patch добавляет:

- `ASUS_WMI_DEVID_USER_STATUS_LED = 0x00040019`;
- `struct led_classdev user_status_led`;
- чтение через существующий `asus_wmi_get_devstate_simple()` и запись
  через `asus_wmi_set_devstate()`;
- регистрацию только после успешного чтения состояния:
  `asus_wmi_get_devstate_simple(...) >= 0`;
- LED ABI `":" LED_FUNCTION_STATUS`;
- `max_brightness = 1`, `brightness_set_blocking`;
- без trigger и без DMI quirk.

Архитектура patch:

```text
ASUS WMI DEVID 0x00040019
        ↓
DSTS successful state read
        ↓
asus-wmi
        ↓
:status
        ↓
brightness 0/1
```

После rebuild `sys-kernel/gentoo-kernel-7.2.9` и загрузки `7.2.9-bdsm`
`/sys/class/leds/:status` прошёл live acceptance 2026-10-04. Текущая локальная
реализация совпадает по design с submitted upstream v1;
[физическая проверка](#физическая-проверка-итогового-abi) приведена ниже.

## Почему `:status`

Linux LED class использует стандартную семантику `color:function`.
Оранжевый цвет физически подтверждён только на B5402CBA. Текущая локальная
реализация и upstream v1 используют `:status`: generic driver не должен
объявлять цвет других моделей без evidence. `LED_FUNCTION_STATUS` уже
существует; `CFLD` — firmware field с неизвестной расшифровкой и не должен
становиться Linux ABI.

## Capability discovery и DMI

Текущий локальный патч и upstream v1 используют successful state-read
gate: `asus_wmi_get_devstate_simple(...) >= 0`.
`ASUS_WMI_UNSUPPORTED_METHOD (0xFFFFFFFE)` содержит
`ASUS_WMI_DSTS_PRESENCE_BIT`, поэтому generic registration через
`asus_wmi_dev_is_present()` может дать ложную presence на некоторых firmware.
Успешное чтение состояния — более безопасный registration gate для этого DEVID.

### DSDT survey разных моделей

| Результат | DSDT entries | Unique model names |
|-----------|--------------|--------------------|
| REAL | 27 | 14 |
| REJECT | 69 | 33 |
| ZERO | 78 | 29 |
| TOTAL | 174 | 76 |

DSDT entries — записи, а не количество моделей. `0x00040019` встречается
за пределами B5402CBA: реальные реализации есть у нескольких ASUS model
families, но есть и firmware, возвращающие reject/zero. Поэтому DMI
whitelist без отдельной необходимости не выбран; generic color survey
не подтверждает. DMI whitelist отсутствует и в live local patch, и в
upstream v1.

## Upstream v1

Generic upstream candidate отправлен после проверки design (2026-10-04):

- `ASUS_WMI_DEVID_USER_STATUS_LED = 0x00040019`;
- LED ABI `:status`;
- registration при `asus_wmi_get_devstate_simple(...) >= 0`;
- без DMI whitelist и trigger;
- userspace Auto/Fn+1 policy — вне scope.

| Submission | Значение |
|------------|----------|
| Subject | `[PATCH] platform/x86: asus-wmi: Add user-status LED support` |
| Submitted commit | `374608bde83a23c6bb2c80422dcd1b751444dacf` |
| Base | `pdx86/platform-drivers-x86 for-next`, `fe5030c8cc7156223f48530e9b49aa87c0305bcd` |
| Message-ID | `<20261003220653.123909-1-vov4ik533@gmail.com>` ([lore.kernel.org](https://lore.kernel.org/all/20261003220653.123909-1-vov4ik533@gmail.com/)) |

Commit trailers:

```text
Assisted-by: LLM
Signed-off-by: Vovan Nikolaevich <vov4ik533@gmail.com>
```

Final submission validation:

| Проверка | Результат |
|----------|-----------|
| `W=1` build `drivers/platform/x86/asus-wmi.o` | PASS; warnings/errors: 0 |
| `git diff --check` | PASS |
| `checkpatch.pl --strict` | 0 errors / 0 warnings / 0 checks |
| `get_maintainer.pl` | expected ASUS + platform-driver-x86 maintainers/lists |
| `git send-email` SMTP submission | PASS; `250`, письмо подтверждено в публичном archive |

Статус — v1 submitted / awaiting review; принятие или merge не подтверждены.

## Ограничения

Физическое управление LED и оранжевый цвет проверены на B5402CBA с
BIOS `B5402CBA.314`; DSDT survey устанавливает наличие firmware implementations,
но не физическую работоспособность или цвет на каждой модели. Расшифровка
`CFLD` неизвестна. Windows Auto и routing событий исследованы статически,
с границами выводов, указанными ниже. Userspace Auto/Fn+1 остаётся вне scope
upstream kernel patch. v2 готовится только по конкретному review feedback
или при обнаружении новой проблемы.

## Подробные данные и историческая диагностика

### Windows reference implementation

2026-10-03 официальные Windows packages для B5402CBA
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

#### Бинарное управление LED — PROVEN

`confled.dll` непосредственно использует `DSTS(0x00040019)` для проверки
presence/status и `DEVS(0x00040019, 0|1)` для включения/выключения.
Доказаны два transport path:

| Transport | Вызов |
|-----------|-------|
| ATKACPI | `DeviceIoControl` для `\\.\ATKACPI`, IOCTL `0x22240C`, payload `{'DEVS', 8, 0x00040019, status}` |
| WMI | `ExecMethod` через `AsusAtkWmi_WMNB`, instance `ACPI\PNP0C14\ATK_0`, `Device_ID = 0x00040019`, `Control_status = 0\|1` |

Это независимое подтверждение: найденный Linux firmware path совпадает
со способом управления User-status / Conference LED, реализованным
в официальном ASUS software.

#### Mode policy в userspace — PROVEN

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

#### Auto: доказанный механизм и граница вывода

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

#### Fn+1 и маршрутизация событий

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

#### Пакет и воспроизводимость

Источник — [официальная ASUS B5402CBA support/download page](https://www.asus.com/supportonly/b5402cba/helpdesk_download/).
Исследован пакет ASUS Business Utility `3.5.35.0`, опубликованный `2025-01-16`.
SHA-256 пакета:

```text
2d64897952378f2ed90a9a9c3b14c8e6295c46e52e1af7d1d84193b008974a9b
```

### Diagnostic patch

Первоначальный diagnostic patch `10-asus-wmi-cfld-test.patch` регистрировал
LED `asus::cfld-test` (чтение через `asus_wmi_get_devstate()`, намеренно
временное имя) и служил этапом identification/physical validation. После
физической проверки он удалён и заменён production-style patch; interface
`asus::cfld-test` в текущем ядре отсутствует.

Writable ASUS debugfs interface был недоступен из-за kernel lockdown
`integrity`. Secure Boot и lockdown ради исследования не отключались.

### Историческая проверка на 7.2.8

Предыдущий local production patch использовал `orange:status` и
`asus_wmi_dev_is_present()` на `7.2.8-bdsm`:

`/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.8/10-asus-wmi-user-status-led.patch`

Это known-good rollback state, а не текущая live implementation.

Физическая приёмка пройдена 2026-10-03. На эталонной системе diagnostic
`asus::cfld-test` заменён production-style local patch. После rebuild новый
`asus-wmi` interface `/sys/class/leds/orange:status` прошёл live acceptance:
state read и физический ON/OFF через brightness `0/1` работают.

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

После пересборки пакета с production-style patch и загрузки `7.2.8-bdsm`
зарегистрирован `/sys/class/leds/orange:status`; прежний diagnostic
interface `asus::cfld-test` в `/sys/class/leds/` отсутствует.
Проверка наличия и чтение:

```bash
ls -l /sys/class/leds/orange:status
cat /sys/class/leds/orange:status/max_brightness
cat /sys/class/leds/orange:status/brightness
```

Подтверждённая цель symlink:

```text
../../devices/platform/asus-nb-wmi/leds/orange:status
```

Live-значения: `max_brightness = 1`, `brightness = 0`. Команды ниже меняют
состояние физического индикатора; запись `0` выключает его.

Включение:

```bash
printf '1\n' | doas tee /sys/class/leds/orange:status/brightness
```

Выключение:

```bash
printf '0\n' | doas tee /sys/class/leds/orange:status/brightness
```

Физическая проверка 2026-10-03: `1` зажёг именно внешний оранжевый
User-status indicator на крышке; `0` погасил тот же индикатор.

| Историческая проверка | Результат |
|------------------|-----------|
| Registration `orange:status` | PASS |
| `max_brightness = 1` | PASS |
| DSTS state read | PASS |
| DEVS write `0/1` | PASS |
| Physical ON/OFF | PASS |
| Diagnostic ABI `asus::cfld-test` отсутствует | PASS |

## Физическая проверка итогового ABI

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

