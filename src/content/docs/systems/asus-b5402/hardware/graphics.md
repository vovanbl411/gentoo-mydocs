---
title: Графический стек ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

## Current state

Сейчас GPU работает через `i915`. Переход на Xe пока не выполнен.

- GPU: Intel Alder Lake-P GT2 (Iris Xe Graphics), PCI `8086:46a6`
- Kernel driver: `i915`
- OpenGL policy / override: `MESA_LOADER_DRIVER_OVERRIDE="iris"`
- VIDEO_CARDS (build policy): `intel zink`
- Vulkan driver ID: `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`
- Vulkan driver: Intel open-source Mesa driver, Mesa `26.2.2`
- Kernel modules: `i915` и `xe` загружены; `xe` имеет usage `0` и не владеет
  GPU

## Kernel driver

- GPU фактически привязан к `i915` — `Kernel driver in use: i915`.
- В runtime загружены оба модуля — `i915` и `xe`. Сама по себе загрузка
  `xe` не означает переход GPU на Xe: driver in use остаётся `i915`.

Файл: `/etc/dracut.conf.d/10-drivers.conf`

```conf
#force_drivers+=" xe "
add_drivers+=" i915 "
add_drivers+=" nvme "
```

## Userspace graphics

- Для OpenGL задана policy `MESA_LOADER_DRIVER_OVERRIDE="iris"`. Фактический
  runtime renderer 2026-09-23 напрямую не проверялся: `glxinfo` на системе
  отсутствует.
- Build policy для Mesa: `VIDEO_CARDS="intel zink"`.
- Vulkan сообщает `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`, имя
  `Intel open-source Mesa driver` и версию Mesa `26.2.2`.

## Xe transition

Переход GPU с `i915` на Xe не выполнялся. Целевая конфигурация и процедура
находятся в [руководстве по Intel Graphics](../../../hardware/intel-graphics.md).

## Verification

- PCI ID, kernel driver, загруженные модули, Dracut, graphics policy и Vulkan
  сверены с системой 2026-09-23.
- Runtime OpenGL renderer не перепроверен: `glxinfo` отсутствует.

## Related docs

- [Intel Graphics: драйвер Xe и Vulkan](../../../hardware/intel-graphics.md)
