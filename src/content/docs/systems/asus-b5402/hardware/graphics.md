---
title: Графический стек ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

Встроенная графика — Intel Alder Lake-P GT2 (Iris Xe Graphics, PCI
`8086:46a6`). Production driver — `i915`; GPU привязан к нему. Для Mesa задан
OpenGL override `iris`, а Portage собирает графические пакеты с
`VIDEO_CARDS="intel zink"`. Отдельные Vulkan override-переменные в
конфигурации не заданы.

## Kernel driver

Файл: `/etc/dracut.conf.d/10-drivers.conf`

```bash
#force_drivers+=" xe "
add_drivers+=" i915 "
add_drivers+=" nvme "
```

Модуль `xe` может быть загружен одновременно с `i915`; это не означает, что
GPU использует `xe`. Сейчас устройство привязано к `i915`, а `xe` не выбран
для ранней загрузки через Dracut.

## Mesa

Файл: `/etc/env.d/99mesa`

```bash
MESA_LOADER_DRIVER_OVERRIDE="iris"
```

Эта переменная задаёт выбор OpenGL-драйвера Mesa. Для сборки пакетов Portage
использует `VIDEO_CARDS="intel zink"` из `/etc/portage/make.conf`. Документ
не фиксирует runtime-версию Mesa и Vulkan renderer: они зависят от
установленного графического стека и доступного runtime-устройства.

## Xe experiment — 2026-09-27

На ядре `7.2.8-bdsm` GPU переключали на Xe параметрами
`xe.force_probe=46a6 i915.force_probe=!46a6`; сессия Niri/Wayland
запускалась. При обычной работе изображение ощущалось менее плавным, чем на
`i915`. Дополнительная проверка с `xe.enable_psr2_sel_fetch=0` это не
исправила; после возврата на `i915` нормальная плавность восстановилась.
Firmware загружалась, поэтому причиной возврата не были привязка GPU или
отсутствие firmware. Xe пока не используется как production driver.

Общая процедура настройки описана в
[руководстве по графическому стеку Intel в Gentoo](../../../../hardware/intel-graphics/).

## Related docs

- [Графический стек Intel в Gentoo: i915, Xe и Mesa](../../../../hardware/intel-graphics/)
