---
title: Микрофон гарнитуры ASUS ExpertBook B5402CBA
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

ASUS ExpertBook B5402CBA использует кодек Realtek ALC294 с subsystem ID
`1043:1b2f`. Для текущей версии `sys-kernel/gentoo-kernel` применяется локальный
version-specific патч `20-asus-b5402-headset-mic.patch`, который назначает
существующий quirk `ALC2XX_FIXUP_HEADSET_MIC`. Постоянный `hda_model` override
не используется. В codec dump видны pin `0x19` с `IN VREF_80` и headset mic
topology; ALSA показывает controls `Headset Mic Jack`, `Capture` и
`Headset Mic Boost`, а PipeWire — источник `Stereo Microphone`. Это подтверждает
topology, но functional capture совместимой CTIA TRRS-гарнитуры пока не
подтверждён.

## Текущая конфигурация

Для ALC294 используется штатный драйвер `snd_hda_codec_alc269` с
`CONFIG_SND_HDA_CODEC_ALC269=m`. Локальный quirk выбирается автоматически по
SSID `1043:1b2f`; параметр `snd_sof_intel_hda_generic.hda_model` в production
cmdline отсутствует. `HWDEP`, `RECONFIG` и `PATCH_LOADER` для этого quirk не
требуются.

## Локальный патч

Файл: `/etc/portage/patches/sys-kernel/gentoo-kernel-<version>/20-asus-b5402-headset-mic.patch`

Значение `<version>` должно совпадать с выбранной версией
`sys-kernel/gentoo-kernel`. Порядок сборки GPKG на builder и установки ядра
описан в [разделе «Загрузка и Portage»](../../system/boot-and-portage/).

В патче добавлена запись в таблицу quirk драйвера
`sound/hda/codecs/realtek/alc269.c`:

```c
SND_PCI_QUIRK(0x1043, 0x1b2f,
              "ASUS ExpertBook B5402CBA",
              ALC2XX_FIXUP_HEADSET_MIC),
```

Запись сопоставляет subsystem ID ноутбука с уже существующим fixup Realtek.
Она не добавляет собственного алгоритма настройки кодека. Патч привязан к
версии ebuild ядра.

## Почему нужен quirk

Quirk был выбран после диагностики:

- Firmware init config для pin `0x19` (`0x411111f0`, N/A) не создавал рабочую
  headset mic topology.
- Одного включения специализированного драйвера ALC294 было недостаточно.
- Диагностический `hda_model=headset-mode` не добавил вход микрофона.
- `hda_model=alc2xx-fixup-headset-mic` добавил headset mic в topology.

Поэтому production-конфигурация применяет тот же существующий fixup
автоматически по SSID, без постоянного диагностического override.

## Пример в upstream

В Linux quirk `ALC2XX_FIXUP_HEADSET_MIC` применяется для ASUS Vivobook S14
S5406SA с ALC294 и сходной проблемой:
[commit f2d08f3651fb12634347fef2c41687a807a7dcba](https://github.com/torvalds/linux/commit/f2d08f3651fb12634347fef2c41687a807a7dcba).
Это precedent для выбора fixup на другом устройстве, а не подтверждение
upstream-поддержки B5402. Документированное включение B5402 в upstream здесь
не подтверждается; локальная конфигурация продолжает использовать
version-specific patch.

## Что ещё не подтверждено

Наличие topology и источника `Stereo Microphone` не доказывает, что combo jack
получает сигнал от внешнего микрофона. Functional capture с заведомо
совместимой CTIA TRRS-гарнитурой или адаптером пока не проверен. Предыдущая
попытка с доступным устройством не дала сигнала, но совместимость этого
устройства с combo jack не была подтверждена, поэтому результат не доказывает
неисправность quirk.

## Проверка текущего состояния

Команды ниже только читают состояние системы. Номер ALSA-карты сначала определи
по `/proc/asound/cards`.

```bash
uname -r
cat /proc/cmdline
cat /sys/module/snd_sof_intel_hda_generic/parameters/hda_model
cat /proc/asound/cards

for f in /proc/asound/card*/codec#*; do
    [ -r "$f" ] || continue
    echo "== $f =="
    grep -n -A14 -B2 'Node 0x19' "$f" || true
done

amixer -c <card-number> scontrols
amixer -c <card-number> contents | rg -n 'Headset Mic|Mic Jack|Capture|Boost'
wpctl status
```

В codec dump проверь `Codec: Realtek ALC294`, `Subsystem Id: 0x10431b2f`,
параметры pin `0x19` и `Pin-ctls`. В `wpctl status` ищи `Stereo Microphone`.
Значение `(null)` у `hda_model` означает, что override не задан.

## Будущий тест внешнего микрофона

Проводить тест имеет смысл с заведомо совместимой CTIA TRRS-гарнитурой или
адаптером. Проверь обнаружение подключения и состояние `Headset Mic Jack` в
ALSA, затем выбери ID источника `Stereo Microphone` из `wpctl status` и запиши
несколько слов:

```bash
pw-record --target <source-id> /tmp/headset-mic-test.wav
# Скажи несколько слов и останови запись Ctrl+C.
pw-play /tmp/headset-mic-test.wav
```

Успех — на записи слышен именно внешний микрофон гарнитуры.

## Откат

Чтобы отменить quirk, убери файл
`20-asus-b5402-headset-mic.patch` из применяемого version-specific каталога
патчей и пересобери workstation kernel по [принятой GPKG-процедуре](../../system/boot-and-portage/).
При regression загрузи предыдущий рабочий kernel. Настройку
`CONFIG_SND_HDA_CODEC_ALC269=m` оставь включённой.
