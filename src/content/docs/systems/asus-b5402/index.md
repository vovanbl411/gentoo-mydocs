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

- Gentoo hardened/systemd (no-multilib); основной toolchain Clang/LLD 22,
  глобально `-O2` + ThinLTO.
- Intel Core i7-1260P (Alder Lake, гибридные P/E-ядра).
- Графика Intel Iris Xe — драйвер ядра i915, Mesa iris, Vulkan ANV.
- Рабочий стол — Niri (чистый Wayland) + Noctalia v5; вход через
  greetd/tuigreet.
- Ядро `7.2.7-bdsm` — собирается LLVM 23.1.1; загрузка systemd-boot → UKI
  (Dracut) → LUKS2/TPM2 → Btrfs.
- Хранилище — Btrfs + Snapper; второй NVMe: состояние проверено, план
  backup/data не применён (осталась старая разметка Arch/LUKS).
- Питание — TLP, заряд батареи ограничен 80%.
- Сеть — NetworkManager + iwd (Intel AX201), nftables, mesh-VPN NetBird.
- Безопасность — Secure Boot, TPM 2.0, AppArmor, doas.

## Desktop

- [Noctalia v5](desktop/noctalia/) — установленная версия, источник пакета
  и локальная keyword-политика.
- [Niri, порталы и GTK](desktop/environment/) — записанное состояние
  рабочего окружения и polkit-агент.

## Hardware

- [ASUS ExpertBook B5402CBA](hardware/asus-expertbook/) — драйверы ядра,
  TLP и батарея.
- [Intel Alder Lake i7-1260P](hardware/cpu-optimization/) — флаги
  компиляции, планировщик, аппаратная безопасность.
- [Intel Graphics](hardware/graphics/) — i915/xe, Mesa, Vulkan.
- [Второй NVMe и резервные копии](hardware/second-disk/) — состояние диска
  проверено 2026-09-22, план применения не выполнен.

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

- [Noctalia v5 для Niri](../../desktop/noctalia-shell/)
- [Niri](../../desktop/niri/)

## О полноте записей

Каталог заполняется поэтапно: отсутствие записи не означает, что компонент
не установлен или не настроен. Частичная сверка с системой проведена
2026-09-22, точные даты — в `last_verified` отдельных документов. Дату
`last_verified` следует заполнять только после новой фактической проверки.
