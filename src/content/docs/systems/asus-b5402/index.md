---
title: ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Основная Gentoo-система и эталон для руководств этого репозитория. Каталог
хранит записанное состояние машины отдельно от общих инструкций.

## Сейчас

- Gentoo hardened/systemd (no-multilib); сборка через Clang/LLD,
  глобально `-O2` + ThinLTO.
- Intel Core i7-1260P (Alder Lake, гибридные P/E-ядра).
- Графика Intel Iris Xe — драйвер ядра i915, Mesa iris, Vulkan ANV.
- Рабочий стол — Umbriel + Noctalia; Niri сохранён как fallback; вход через
  greetd/tuigreet.
- Ядро — `sys-kernel/gentoo-kernel` с собственной конфигурацией; загрузка systemd-boot → UKI
  (Dracut) → LUKS2/TPM2 → Btrfs.
- Хранилище — Btrfs + Snapper; второй NVMe: состояние проверено, план
  backup/data не применён (осталась старая разметка Arch/LUKS).
- Питание — TLP, заряд батареи ограничен 80%.
- Сеть — NetworkManager + iwd (Intel AX201), nftables, mesh-VPN NetBird.
- Безопасность — Secure Boot, TPM 2.0, AppArmor, doas.

## Desktop

- [Noctalia](desktop/noctalia/) — настройки оболочки и уведомлений.
- [Umbriel, Niri, порталы и GTK](desktop/environment/) — записанное состояние
  рабочего окружения и polkit-агент.

## Hardware

- [ASUS NumberPad](hardware/numberpad/) — настройка цифровой клавиатуры тачпада.
- [ASUS ExpertBook B5402CBA](hardware/asus-expertbook/) — драйверы ядра,
  TLP и батарея.
- [Микрофон гарнитуры](hardware/headset-microphone/) — ALC294: локальный quirk
  активирует вход микрофона. Для проверки нужна совместимая CTIA TRRS-гарнитура
  или адаптер.
- [User-status indicator](hardware/user-status-indicator/) — управление внешним индикатором,
  режимы `auto/busy/off` и переключение через Fn+1. Устройство прошивки
  и выбор интерфейса Linux описаны в
  [исследовании](../../experiments/asus-user-status-indicator/).
- [Intel Alder Lake i7-1260P](hardware/cpu-optimization/) — флаги
  компиляции, планировщик, аппаратная безопасность.
- [Intel Graphics](hardware/graphics/) — i915/xe, Mesa, Vulkan.
- [Второй NVMe и резервные копии](hardware/second-disk/) — план использования диска;
  не применяй разметку без проверки содержимого.
- [Сканер отпечатков ELAN](hardware/fingerprint/) — настройка входа
  и подтверждения привилегированных действий.

## Boot и Portage

- [Загрузка и Portage](system/boot-and-portage/) — toolchain,
  оптимизация, package.env, ядро и UKI.
- [Обновление BIOS/UEFI](system/bios-update/) — проверенная процедура для
  Secure Boot, `sbctl`, LUKS2 и TPM2.

## Хранилище

- [Btrfs и Snapper](filesystem/layout-and-snapshots/) — субволюмы, опции
  монтирования, лимиты снимков.

## Сеть

- [NetworkManager, Docker и Libvirt](networking/networkmanager-and-libvirt/)
  — Wi-Fi, nftables, mesh-VPN.

## Безопасность

- [Политика doas](security/doas/)

## Приложения

- [Приложения](applications/) — Firefox, Flatpak, OBS, AppImage.

## Общие руководства

- [Установка Umbriel](../../desktop/umbriel/)
- [Noctalia](../../desktop/noctalia-shell/)
- [Niri](../../desktop/niri/)

## Как пользоваться разделом

Общие руководства объясняют установку и настройку, а этот раздел хранит
выбранные параметры ноутбука. Планы, например использование второго NVMe,
отмечены отдельно от применённых настроек. Перед действиями с дисками
сверяй устройства и содержимое с собственной системой.
