---
title: Графический стек ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

## Current state

Production kernel driver — `i915`. Xe протестирован и отклонён для текущего
стека: в Niri/Wayland отображение на Xe стабильно ощущалось менее плавным.
Активной миграции на Xe нет. Повторный тест имеет смысл после существенного
изменения ядра, display stack Xe или firmware.

- GPU: Intel Alder Lake-P GT2 (Iris Xe Graphics), PCI `8086:46a6`
- Production kernel driver: `i915`
- OpenGL policy / override: `MESA_LOADER_DRIVER_OVERRIDE="iris"`
- VIDEO_CARDS (build policy): `intel zink`
- Vulkan driver ID: `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`
- Vulkan driver: Intel open-source Mesa driver, Mesa `26.2.2`

Это записанное состояние, а не новая проверка графического стека на живой
системе. OpenGL override — policy; runtime OpenGL renderer тогда напрямую
не был перепроверен.
Даты и границы проверок приведены в Verification.

## Kernel driver

- GPU фактически привязан к `i915` — `Kernel driver in use: i915`.
- Сама по себе загрузка `xe` не означает привязку GPU к нему.

Файл: `/etc/dracut.conf.d/10-drivers.conf`

```bash
#force_drivers+=" xe "
add_drivers+=" i915 "
add_drivers+=" nvme "
```

## Userspace graphics

Выбор Iris зафиксирован в `/etc/env.d/99mesa`:

```bash
MESA_LOADER_DRIVER_OVERRIDE="iris"
```

- Для OpenGL задана policy `MESA_LOADER_DRIVER_OVERRIDE="iris"`. Фактический
  runtime renderer 2026-09-23 напрямую не проверялся: `glxinfo` на системе
  отсутствует.
- Build policy для Mesa: `VIDEO_CARDS="intel zink"`.
- Vulkan сообщает `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`, имя
  `Intel open-source Mesa driver` и версию Mesa `26.2.2`.

## Xe experiment — 2026-09-27

До теста GPU был привязан к `i915`; были доступны оба модуля:
`Kernel modules: i915, xe`.

На ядре `7.2.8-bdsm` GPU `8086:46a6` переключили на Xe с параметрами
`xe.force_probe=46a6 i915.force_probe=!46a6` и ранней загрузкой `xe` через
Dracut (`force_drivers+=" xe "`). В записи проверки исходников upstream Linux
7.2.8 отмечено, что Alder Lake-P descriptor `adl_p_desc` содержит
`.require_force_probe = true`. Это наблюдение относится к версии из
эксперимента, а не к любому будущему ядру.

Проверка показала `Kernel driver in use: xe`; Xe инициализировался, сессия
Niri/Wayland работала. Из `sys-kernel/linux-firmware-20260916` загрузились
DMC `i915/adlp_dmc.bin` 2.20, GuC `i915/adlp_guc_70.bin` 70.49.4
и HuC `i915/tgl_huc.bin` 7.9.3.
Проверка firmware пройдена. Привязка GPU и firmware не были причиной отката.

При обычной работе отображение стабильно ощущалось менее плавным, чем на
`i915`. Отдельная проверка с `xe.enable_psr2_sel_fetch=0` не дала заметного
улучшения. После отката на `i915` нормальная плавность восстановилась.
Итог: базовая работа Xe подтверждена, но проверка плавности не пройдена;
production-драйвер остаётся `i915`. Параметр `xe.enable_psr2_sel_fetch=0`
не сохраняется. Повторная проверка Xe имеет смысл после существенного
изменения ядра, display stack Xe или firmware.

Общая процедура перехода описана в
[руководстве по графическому стеку Intel в Gentoo](../../../../hardware/intel-graphics/).

## Verification

- PCI ID, kernel driver, загруженные модули, Dracut, graphics policy и Vulkan
  сверены с системой 2026-09-23.
- Привязка к Xe, загрузка firmware, сессия Niri/Wayland, проверка плавности
  и возврат на `i915` подтверждены 2026-09-27 на `7.2.8-bdsm`.
- Runtime OpenGL renderer не перепроверен: `glxinfo` отсутствует.

## Related docs

- [Графический стек Intel в Gentoo: i915, Xe и Mesa](../../../../hardware/intel-graphics/)
