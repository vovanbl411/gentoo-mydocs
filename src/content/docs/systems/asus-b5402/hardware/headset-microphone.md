---
title: Микрофон гарнитуры ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-10-10"
verified_on: [asus-b5402]
---

## Текущее состояние

На ASUS ExpertBook B5402CBA с ядром `7.2.9-bdsm` локальный quirk для
`1043:1b2f` успешно применяется без `hda_model`. Realtek ALC294 получает
`Headset Mic=0x19`; pin `0x19` реально активирован как `IN VREF_80`.
В PipeWire появляется `Stereo Microphone`: подтверждена настройка pin
кодека, а не только наличие источника в PipeWire.

Окончательная functional acceptance внешнего микрофона **не пройдена**:
с текущим подключённым устройством `Headset Mic Jack=off`, direct ALSA
capture через `plughw:0,0` даёт тишину, VU не реагирует. Проверка отложена
до появления заведомо совместимой CTIA TRRS-гарнитуры или адаптера.
Состояние подтверждено 2026-10-10.

Постоянная конфигурация — штатный драйвер `snd_hda_codec_alc269` и локальный
патч, применяющий существующий `ALC2XX_FIXUP_HEADSET_MIC` к codec subsystem
ID `0x10431b2f` (`1043:1b2f`). После перезагрузки с патчем временный
`hda_model` полностью удалён из cmdline; параметр модуля показывает `(null)`.
Quirk B5402 пока локальный; его включение в upstream не подтверждено.

## Постоянная конфигурация и локальный quirk

### Драйвер и production kernel config

Для ALC294 необходима штатная поддержка `CONFIG_SND_HDA_CODEC_ALC269=m`.
В оптимизированной конфигурации ядра эта опция первоначально отсутствовала.
Её включение обеспечило специализированный драйвер ALC294, но само по себе
не добавило headset mic в topology. Локальный quirk ниже добавляет этот вход;
получение сигнала с внешнего микрофона пока не подтверждено.

Подтверждённый production HDA config:

```makefile
# CONFIG_SND_HDA_HWDEP is not set
# CONFIG_SND_HDA_RECONFIG is not set
# CONFIG_SND_HDA_PATCH_LOADER is not set
CONFIG_SND_HDA_GENERIC_LEDS=y
CONFIG_SND_HDA_GENERIC=m
CONFIG_SND_HDA_CODEC_REALTEK=m
CONFIG_SND_HDA_CODEC_REALTEK_LIB=m
CONFIG_SND_HDA_CODEC_ALC269=m
```

`HWDEP`, `RECONFIG` и `PATCH_LOADER` использовались или рассматривались
только для диагностики. Локальный quirk от них не зависит; в
production они отключены. Это отличается от `CONFIG_SND_HDA_CODEC_ALC269`,
который необходим для штатной поддержки кодека.

### Локальный Gentoo patch

Файл: `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.9/20-asus-b5402-headset-mic.patch`

Патч добавляет в таблицу quirk драйвера
`sound/hda/codecs/realtek/alc269.c` запись для SSID этой машины:

```c
SND_PCI_QUIRK(0x1043, 0x1b2f,
              "ASUS ExpertBook B5402CBA",
              ALC2XX_FIXUP_HEADSET_MIC),
```

Применение quirk подтверждено после сборки ядра с локальным патчем и
перезагрузки без диагностического `snd_sof_intel_hda_generic.hda_model`
в cmdline. Это подтверждение topology, а не окончательная проверка capture.
Каталог патча привязан к `gentoo-kernel-7.2.9`: при обновлении ядра нужно
проверить наличие quirk в новых исходниках и необходимость переноса патча,
затем повторить проверку capture.

Перед повторной сборкой сохрани рабочий boot entry/UKI для отката.
Сборка и загрузка описаны в [системном разделе Boot и Portage](../../system/boot-and-portage/)
и [руководстве по UKI через Dracut](../../../../installation/systemd-uki-setup/).

## Технические детали и диагностика

| Параметр | Подтверждённое значение |
|----------|------------------------|
| Машина | ASUS ExpertBook B5402CBA |
| Проверенное ядро | `7.2.9-bdsm` |
| Стек | SOF/HDA |
| Кодек / драйвер | Realtek ALC294 / `snd_hda_codec_alc269` |
| Codec subsystem ID | `0x10431b2f` / `1043:1b2f` |
| Firmware init pin config `0x19` | `0x411111f0` — N/A |
| Активный pin `0x19` с quirk | `IN VREF_80` |
| Pin `0x21` | Корректно определяется как headphone pin |

Firmware/BIOS не предоставляет рабочую pin configuration для headset mic
pin `0x19`. Без quirk в dmesg список `inputs:` оставался пустым даже со
специализированным драйвером. Применение существующего
`ALC2XX_FIXUP_HEADSET_MIC` добавляет headset mic в topology и активирует
pin `0x19`. Эти наблюдения не устанавливают более глубокую причину поведения
firmware/BIOS и не подтверждают получение сигнала с внешнего микрофона.

Причина оставшегося отсутствия сигнала пока не установлена. Возможны
физическая несовместимость подключённого устройства с combo jack либо
недостаточность выбранного codec fixup; ни один вариант пока не подтверждён.

Проверенные диагностические overrides:

| Параметр cmdline | Результат |
|-----------------|-----------|
| `snd_sof_intel_hda_generic.hda_model=headset-mode` | Не исправил проблему: `inputs:` оставался пустым |
| `snd_sof_intel_hda_generic.hda_model=alc2xx-fixup-headset-mic` | Появились `Headset Mic=0x19`, ALSA controls `Headset Mic Jack`, `Capture`, `Headset Mic Boost` и PipeWire source `Stereo Microphone`; функциональная работа внешнего микрофона не подтверждена |

Override подтвердил изменение topology на этой машине. В постоянной
конфигурации его заменяет автоматический выбор quirk по SSID.

Linux upstream уже применяет `ALC2XX_FIXUP_HEADSET_MIC` для ASUS Vivobook S14
S5406SA с ALC294 и аналогичной проблемой микрофона гарнитуры:
[commit f2d08f3651fb12634347fef2c41687a807a7dcba](https://github.com/torvalds/linux/commit/f2d08f3651fb12634347fef2c41687a807a7dcba).
Это precedent для выбора существующего fixup, а не upstream patch B5402.

## Проверка

После загрузки ядра с локальным патчем:

```bash
uname -r
cat /proc/cmdline
cat /sys/module/snd_sof_intel_hda_generic/parameters/hda_model
doas dmesg | rg 'snd_hda_codec_alc269.*(inputs:|Headset Mic)'
wpctl status
```

Подтверждённое применение quirk и состояние topology:

- `uname -r`: `7.2.9-bdsm`.
- В cmdline отсутствует `snd_sof_intel_hda_generic.hda_model`.
- Параметр `hda_model`: `(null)`.
- В dmesg драйвер `snd_hda_codec_alc269` показывает `inputs:` и
  `Headset Mic=0x19`.
- Pin `0x19` активирован как `IN VREF_80`.
- В `wpctl status` присутствует `Stereo Microphone`.

Результат проверки текущего подключённого микрофона:

- `Headset Mic Jack=off`.
- Direct ALSA capture через `plughw:0,0` даёт тишину.
- VU не реагирует.

Наличие источника и активного pin не заменяет проверку звука. Окончательная
проверка отложена до появления заведомо совместимой CTIA TRRS-гарнитуры или
адаптера. С ним нужно повторить проверку jack detection, direct ALSA capture
и VU, затем выбрать ID источника `Stereo Microphone` из `wpctl status`.
В примере замени `<source-id>` этим ID:

```bash
pw-record --target <source-id> /tmp/headset-mic-test.wav
# Произнеси несколько слов и заверши запись Ctrl+C.
pw-play /tmp/headset-mic-test.wav
```

Критерий успеха — слышимая запись именно внешнего микрофона гарнитуры.
Приведённые команды предназначены для будущей проверки на машине.
Прежняя запись через `pw-record` и воспроизведение через `pw-play` не служат
доказательством захвата именно внешнего микрофона.

## Откат

При проблемах с новым ядром загрузи сохранённый рабочий boot entry/UKI.
Чтобы отменить локальный quirk, убери указанный patch из применяемого
Portage каталога, пересобери ядро и UKI по принятой процедуре и перезагрузись.
Сохрани `CONFIG_SND_HDA_CODEC_ALC269=m`: отмена quirk не требует отключать
штатный драйвер ALC294.

Без quirk и без диагностического override микрофон гарнитуры ранее
отсутствовал; после отката нужно проверить topology и capture заново.
`hda_model=alc2xx-fixup-headset-mic` остаётся проверенным диагностическим
вариантом, но в принятой production-конфигурации он не используется.
