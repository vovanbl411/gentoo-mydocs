---
title: "Графический стек Intel в Gentoo: i915, Xe и Mesa"
kind: guide
scope: general
status: draft
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

Настройки сборки Intel graphics stack от
фактического состояния GPU, как подготовить проверяемый переход с `i915`
на `xe`, если он применим к устройству. Переход не обязателен для
работающей системы и не гарантирует большей скорости или плавности.

## 1. Что входит в Intel graphics stack

| Слой | За что отвечает |
|------|------------------|
| Kernel driver | `i915` или `xe`: привязка к GPU, работа с устройством и вывод изображения при включённой display support. |
| Mesa userspace | OpenGL и Vulkan: Iris, ANV и Zink выполняют разные роли. |
| Build/package policy | `VIDEO_CARDS` определяет набор компонентов при сборке пакетов Gentoo. |
| Runtime | Драйвер, реально привязанный к GPU, renderer конкретного приложения и работа графической сессии. |

Настроенный Mesa stack не доказывает, что GPU использует `xe`.
Проверяй kernel driver и userspace отдельно.

## 2. Kernel driver: i915 и Xe

Выбор между `i915` и `xe` зависит от GPU и точной версии ядра. Наличие модуля
`xe` не подтверждает ни поддержку нужного устройства, ни привязку к нему.
Даже если оба модуля доступны или загружены, фактический driver определяется
для конкретного PCI device.

В процедуре ниже `xe` собирается как модуль: это позволяет управлять загрузкой
через `modprobe.d` или Dracut. Поддержку вывода изображения и дополнительные
возможности нужно проверить в конфигурации используемого ядра.

## 3. Mesa userspace: Iris, ANV и Zink

- **Iris** — OpenGL driver Mesa для поддерживаемых Intel GPU.
- **ANV** — Intel Vulkan driver Mesa. Его наличие не определяет, привязан ли
  GPU к `i915` или `xe`.
- **Zink** — OpenGL поверх Vulkan. Он может быть полезен для отладки или
  приложений, которым нужны специфические расширения, реализованные в Vulkan
  driver; на Intel таким driver может быть ANV.

Пример build policy, а не обязательная настройка любого Intel GPU.
Файл: `/etc/portage/make.conf`

```makefile
VIDEO_CARDS="intel zink"
```

`VIDEO_CARDS="intel zink"` задаёт семейства драйверов, но не заменяет USE-флаги
Mesa: в частности, сборка ANV также требует включённого `USE=vulkan`.

Этот набор предусматривает Intel userspace и Zink, но не подтверждает выбор
Iris или Zink в конкретном приложении. Выбор Mesa driver и локальные overrides
нужно отличать от измеренного runtime renderer; не копируй override с другой
машины как обязательную часть перехода на Xe.

## 4. Как определить фактическое runtime state

Начни с PCI ID и привязанного kernel driver:

```bash
lspci -nnk
```

Найди GPU и сравни поля: `Kernel driver in use` показывает привязку,
а `Kernel modules` — доступные модули. Список загруженных модулей также
не заменяет проверку привязки.

Для Vulkan при установленном `vulkaninfo`:

```bash
vulkaninfo --summary
```

Проверь нужный GPU, driver ID, имя driver и версию Mesa. OpenGL renderer
проверяй отдельно через диагностику приложения или подходящий для его
графического backend инструмент. Рабочий Vulkan не подтверждает OpenGL
renderer, а значение `VIDEO_CARDS` не является результатом runtime-проверки.

## 5. Когда рассматривать i915 → Xe

Рассматривай переход, если точная версия ядра поддерживает твой GPU и есть
задача проверить Xe на используемом графическом стеке. Сам факт наличия Intel
GPU не является основанием для смены driver.

Xe не даёт универсальной гарантии по latency, frame presentation или
стабильности Wayland-композитора. Результат оценивается на своей машине,
с обычными приложениями и дисплеями.

## 6. Подготовка перехода

До изменения драйвера проверь:

- точный PCI ID GPU и поддержку устройства в исходниках нужной версии ядра;
- необходимые kernel options и firmware;
- как GPU driver попадает в initramfs через Dracut;
- какой boot artifact потребуется пересобрать;
- рабочую конфигурацию с `i915` и доступный из boot menu fallback.

> **Важно**: смена driver может нарушить загрузку графической сессии.
> Подготовь рабочий fallback до изменения параметров и сохрани его до
> проверки загрузки и работы с `xe`.

Проверь следующие options в Kconfig своей версии ядра:

- `CONFIG_DRM_XE=m` — модуль Xe;
- `CONFIG_DRM_XE_DISPLAY=y` — поддержка вывода изображения, необходимая,
  если Xe должен обслуживать дисплей;
- `CONFIG_DRM_XE_DP_TUNNEL=y` — DisplayPort tunneling через Thunderbolt/USB4,
  если этот путь используется;
- `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT=y` — upstream Kconfig по умолчанию
  включает ограничение scheduler timeout для применимых пользователей.

Последняя опция сама по себе не защищает от GPU reset, не гарантирует общей
стабильности и не обещает прироста производительности.

## 7. force_probe и выбор driver

Необходимость `force_probe` зависит от GPU и точной версии ядра. Перед
переходом проверь актуальное upstream support state для устройства, включая
`require_force_probe` в исходниках этой версии. Загрузка модуля сама по себе
не меняет эти условия.

Если устройство требует явного выбора Xe, используется согласованная пара
kernel parameters:

```text
xe.force_probe=<PCI-ID> i915.force_probe=!<PCI-ID>
```

`<PCI-ID>` здесь — device ID GPU в ожидаемом driver формате, а не PCI address.
Пара разрешает probe для Xe и запрещает его для i915 на указанном устройстве.
Не применяй её без проверки поддержки. Место записи параметров зависит от
твоего boot workflow; для UKI смотри
[руководство по systemd-boot и UKI](../../installation/systemd-uki-setup/).

## 8. Dracut/initramfs и boot artifact

Минимальный пример содержит только GPU drivers. Выбери отдельный файл
конфигурации Dracut, например `/etc/dracut.conf.d/20-intel-graphics.conf`:

```bash
#force_drivers+=" xe "
add_drivers+=" i915 "
```

В этом варианте `i915` добавлен в initramfs, принудительная загрузка Xe
отключена. После проверки поддержки для ранней загрузки Xe можно включить
`force_drivers+=" xe "`. Не удаляй `i915` из initramfs, пока не подготовлен
и не проверен рабочий fallback.

Обнови initramfs и пересобери boot artifact по своему Dracut/UKI workflow.
Изменённый конфиг Dracut не меняет уже созданный initramfs или UKI.
Порядок сборки — в [руководстве по UKI](../../installation/systemd-uki-setup/).
После reboot проверь фактическую привязку GPU.

## 9. Verification

Повтори проверки runtime из раздела 4 и проверь практически:

- `Kernel driver in use` соответствует целевому driver;
- Mesa/OpenGL использует ожидаемый driver, Vulkan работает через ANV;
- rendering, latency/interactive behaviour и frame presentation приемлемы;
- suspend/resume и внешние дисплеи работают;
- Wayland-композитор, например Niri, стабильно запускается и работает;
- нет проблем с загрузкой или сессией, требующих отката.

Не считай переход завершённым только по загруженному модулю `xe`.
Сохрани результаты привязки, firmware, userspace и проверки сессии отдельно:
успех одного слоя не доказывает успех остальных.

## 10. Rollback

Если система не загружается, сессия не запускается или её работа не проходит
проверку, используй подготовленный рабочий fallback. Для возврата изменённого
boot artifact:

1. Если были добавлены kernel parameters, удали или отмени оба:
   `xe.force_probe=<PCI-ID>` и `i915.force_probe=!<PCI-ID>`.
2. Верни рабочую конфигурацию Dracut с `i915` и убери или снова закомментируй
   принудительную загрузку `xe`.
3. Пересобери соответствующий boot artifact.
4. После загрузки проверь `Kernel driver in use: i915`.

Одного возврата `i915` в initramfs недостаточно, пока активен параметр
`i915.force_probe=!<PCI-ID>`.

## 11. Reference-system example

Переход практически проверен на ASUS B5402: Xe успешно привязался к GPU,
сессия Niri/Wayland работала. После runtime acceptance production system
вернулась на `i915`. Параметры, результаты и причины решения находятся в
[системном документе](../../systems/asus-b5402/hardware/graphics/).

## 12. References / Related docs

- [Linux kernel: Xe](https://docs.kernel.org/gpu/xe/index.html) — kernel driver.
- [Linux kernel: `Kconfig`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/Kconfig) — display support и DP tunneling.
- [Linux kernel: `Kconfig.profile`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/Kconfig.profile) — `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT`.
- [Linux kernel: `xe_pci.c`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/xe_pci.c) — поддержка GPU и `require_force_probe`.
- [Linux kernel: Xe merge acceptance plan](https://docs.kernel.org/6.7/gpu/rfc/xe.html) — согласованная пара `i915.force_probe=!<PCI-ID>` и `xe.force_probe=<PCI-ID>`.
- [Mesa: ANV](https://docs.mesa3d.org/drivers/anv.html) — Intel Vulkan driver.
- [Mesa: Zink](https://docs.mesa3d.org/drivers/zink.html) — OpenGL поверх Vulkan.
- [Графический стек ASUS B5402](../../systems/asus-b5402/hardware/graphics/) — состояние машины и результаты эксперимента.
- [Ядро и загрузка: UKI](../../installation/systemd-uki-setup/) — Dracut, пересборка boot artifact и fallback.
