---
title: "Графический стек Intel: переход с i915 на Xe"
kind: guide
scope: general
status: draft
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

## Цель и текущее состояние

Документ описывает подготовку к переходу Intel GPU с текущего драйвера ядра
`i915` на целевой `xe`. Наличие модуля `xe` или настроенного Mesa stack не
подтверждает привязку GPU к `xe`: фактически привязанный kernel driver нужно
проверять отдельно.

На ASUS B5402 переход пока не выполнен. Актуальное состояние этой машины
записано в
[системном разделе](../systems/asus-b5402/hardware/graphics.md); значения из
него не являются универсальной конфигурацией для любого Intel GPU.

> **Важно**: не применяй переход автоматически только потому, что GPU
> произведён Intel. Сначала проверь конкретное устройство, поддержку `xe` и
> рабочий путь отката.

## Когда применять и что проверить заранее

До изменения драйвера проверь:

- точный PCI ID GPU;
- поддержку этого устройства драйвером `xe` в используемой версии ядра;
- наличие необходимых kernel options;
- как GPU driver попадает в initramfs через Dracut;
- наличие рабочей конфигурации с `i915`, к которой можно вернуться;
- какой boot artifact потребуется пересобрать после изменения Dracut.

Эта проверка определяет применимость перехода. Само наличие Intel GPU,
`VIDEO_CARDS="intel zink"` или модуля `xe` её не подтверждает.

## Целевой kernel driver: Xe

В целевом варианте `xe` собирается как модуль. Это позволяет управлять его
загрузкой через `modprobe.d` или Dracut.

В документе перечислены следующие kernel options:

- `CONFIG_DRM_XE=m` — основной модуль включен;
- `CONFIG_DRM_XE_DISPLAY=y` — поддержка вывода изображения, обязательная для
  ноутбука;
- `CONFIG_DRM_XE_DP_TUNNEL=y` — поддержка DisplayPort через Thunderbolt/USB4,
  важная для ASUS ExpertBook;
- `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT=y` — upstream Kconfig включает по
  умолчанию ограничение значений scheduler timeout для применимых
  пользователей.

Эта опция сама по себе не является защитой от GPU reset, не гарантирует общую
стабильность и не обещает прирост производительности.

Плавность Wayland-сессии и поведение Niri после такого изменения нужно
проверять практически. Этот раздел описывает процедуру перехода, а не текущее
состояние ASUS B5402.

## Переключение и пример Dracut

Существующий пример показывает промежуточное состояние до переключения:
`i915` добавлен в initramfs, а принудительная загрузка `xe` отключена.

Файл: `/etc/dracut.conf.d/10-drivers.conf`

```bash
# Драйвер Xe для графики Intel 12-го поколения (отключён до перехода)
#force_drivers+=" xe "

add_drivers+=" i915 "

add_drivers+=" nvme "
```

Одной принудительной загрузки `xe` недостаточно: загруженный модуль может не
владеть GPU. Переход выполняй в таком порядке:

1. Определи PCI ID устройства.
2. Проверь поддержку устройства в исходниках точной версии kernel, с которой
   будет загружаться система.
3. Проверь, требует ли эта версия Xe явный `force_probe` для устройства.
4. Если требует, задай согласованную пару kernel parameters:
   `xe.force_probe=<PCI-ID>` и `i915.force_probe=!<PCI-ID>`.
5. Обнови Dracut/initramfs и пересобери boot artifact в соответствии с
   используемым Dracut/UKI workflow.
6. Сохрани рабочий fallback с `i915`.
7. После reboot проверь `Kernel driver in use`.

Для PCI ID ASUS B5402 `46a6` такая пара выглядела бы как
`xe.force_probe=46a6 i915.force_probe=!46a6`. Актуальный upstream Linux
помечает Alder Lake-P как требующий force probe для Xe, но исходники именно
локального kernel `7.2.7-bdsm` в этом аудите не проверялись. Поэтому сначала
нужно подтвердить требование в этой версии, а не добавлять параметры
автоматически.

После этой проверки для ранней загрузки Xe можно включить
`force_drivers+=" xe "`. Не удаляй `i915` из initramfs, пока не подготовлен и
не проверен рабочий fallback.

## Mesa, OpenGL и Vulkan

Mesa/OpenGL/Vulkan — отдельная часть graphics stack. Её настройки не следует
смешивать с выбором kernel driver при переходе `i915` → `xe`.

В примере build policy в `make.conf` указан следующий набор:

```makefile
VIDEO_CARDS="intel zink"
```

Он включает два подхода к рендерингу OpenGL:

- **Iris** — основной OpenGL driver в приведённом примере;
- **Zink** — альтернатива, которая транслирует вызовы OpenGL в Vulkan. Она
  полезна для отладки или приложений, которым нужны специфические расширения,
  реализованные в Vulkan-драйвере ANV;
- **ANV** — Intel Vulkan driver в Mesa userspace. Его наличие не определяет,
  к какому kernel driver привязан GPU: `i915` или `xe` нужно проверять
  отдельно.

На ASUS B5402 выбор Iris дополнительно зафиксирован в
`/etc/env.d/99mesa`:

```bash
MESA_LOADER_DRIVER_OVERRIDE="iris"
```

Подтверждённую policy и отдельно измеренное runtime-состояние ASUS B5402 смотри
в системном документе.

## Niri и Wayland

Переход на `xe` не даёт универсальной гарантии по latency, frame presentation
или стабильности Niri. После переключения проверь на практике rendering,
latency и interactive behaviour, frame presentation, suspend/resume, внешние
дисплеи и стабильность сессии Niri.

## Verification после переключения

После загрузки проверь:

- какой kernel driver фактически привязан к GPU;
- работает ли Mesa/OpenGL с ожидаемым драйвером;
- работает ли Vulkan через ANV;
- корректны ли rendering, latency/interactive behaviour и frame presentation;
- работают ли suspend/resume и внешние дисплеи;
- стабильно ли запускается и работает Wayland-композитор Niri;
- нет ли проблем с загрузкой или графической сессией, требующих отката.

Не считай переход завершённым только по наличию загруженного модуля `xe`.

## Rollback

Если после переключения система не загружается или не запускается графическая
сессия:

1. Если были добавлены kernel parameters, удали или отмени оба:
   `xe.force_probe=<PCI-ID>` и `i915.force_probe=!<PCI-ID>`.
2. Верни рабочую конфигурацию Dracut с `i915` и убери или снова закомментируй
   принудительную загрузку `xe`.
3. Пересобери соответствующий boot artifact.
4. После загрузки проверь `Kernel driver in use: i915`.

Одного возврата `i915` в initramfs недостаточно, пока активен параметр
`i915.force_probe=!<PCI-ID>`.

Порядок сборки Dracut/initramfs и UKI описан в
[руководстве по systemd-boot и UKI](../installation/systemd-uki-setup.md).
Рабочий fallback необходимо сохранить до проверки загрузки и графической
сессии с `xe`.

## References

- [Linux kernel: `Kconfig.profile`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/Kconfig.profile) —
  `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT`.
- [Linux kernel: `xe_pci.c`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/xe_pci.c) —
  `adl_p_desc` и `require_force_probe`.
- [Linux kernel: Xe merge acceptance plan](https://docs.kernel.org/6.7/gpu/rfc/xe.html) —
  согласованная пара `i915.force_probe=!<PCI-ID>` и
  `xe.force_probe=<PCI-ID>` при переходе.
- [Mesa: ANV](https://docs.mesa3d.org/drivers/anv.html) — Intel userspace
  Vulkan driver.

## Related docs

- [Графический стек ASUS B5402](../systems/asus-b5402/hardware/graphics.md) — текущее подтверждённое состояние машины.
- [Ядро и загрузка: UKI](../installation/systemd-uki-setup.md) — Dracut, пересборка boot artifact и fallback.
