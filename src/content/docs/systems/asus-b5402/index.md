---
title: ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Это основная рабочая станция Gentoo. Здесь описаны состояние ASUS B5402 и
принятые для неё решения; общие руководства собраны в тематических разделах
сайта.

## Текущее состояние

- Gentoo hardened/systemd без multilib; основная цепочка сборки пользовательских
  пакетов — Clang/LLD, глобальные флаги оптимизации — `-O2` и ThinLTO.
- `sys-kernel/gentoo-kernel` собирается на `gentoo-builder-01` в GPKG и
  устанавливается на ноутбуке из private binrepo. Загрузка: systemd-boot → UKI,
  собранный Dracut → LUKS2/TPM2 → Btrfs.
- Рабочий стол — Umbriel + Noctalia; Niri остаётся запасной сессией. Вход —
  через greetd/tuigreet.
- Intel Iris Xe; текущий драйвер ядра — `i915`. Графический стек включает
  Mesa и Vulkan.
- Btrfs + Snapper; сборочные каталоги и кэши отделены от снимков корня.
  Второй NVMe: **PLAN — NOT APPLIED**.
- Сеть: NetworkManager + iwd, nftables и NetBird как основной mesh VPN.
- Защита: Secure Boot, интеграция TPM2/LUKS2, AppArmor и doas.
- Нативные приложения устанавливаются через Portage, в том числе из локальных
  оверлеев; для отдельных программ используются Flatpak и AppImage. Рабочая
  база KeePassXC хранится локально; синхронизация с Android и резервные копии
  организованы отдельно.

## Рабочий стол

- [Noctalia](desktop/noctalia/) — оболочка рабочего стола и уведомления.
- [Umbriel, Niri, порталы и GTK](desktop/environment/) — композитор, вход,
  порталы и запасная сессия Niri.

## Оборудование

- [ASUS NumberPad](hardware/numberpad/) — настройка цифровой клавиатуры
  тачпада.
- [ASUS ExpertBook B5402CBA](hardware/asus-expertbook/) — TLP, батарея и
  интеграция с ASUS WMI.
- [Микрофон гарнитуры](hardware/headset-microphone/) — ALC294 и локальный
  quirk; схема входа подтверждена, запись с совместимой CTIA-гарнитурой пока
  не подтверждена.
- [Индикатор статуса](hardware/user-status-indicator/) — интеграция ядра и
  пользовательской части, режимы `auto`/`busy`/`off` и Fn+1.
- [Оптимизация CPU: Intel Alder Lake](hardware/cpu-optimization/) — локальная
  политика оптимизации пользовательских программ, питание и планировщик.
- [Графический стек](hardware/graphics/) — текущий драйвер `i915`, Mesa и
  Vulkan; эксперимент с Xe описан на этой странице.
- [Второй NVMe](hardware/second-disk/) — **PLAN — NOT APPLIED**.
- [Сканер отпечатков ELAN](hardware/fingerprint/) — интеграция
  fprintd/libfprint и аутентификация.

## Загрузка и Portage

- [Загрузка и Portage](system/boot-and-portage/) — политика toolchain и
  пакетов, сборка GPKG ядра на builder, приватный binrepo и загрузка UKI с
  Secure Boot.
- [Обновление BIOS/UEFI](system/bios-update/) — проверенная процедура с
  учётом Secure Boot и TPM2.

## Хранилище

- [Btrfs и Snapper](filesystem/layout-and-snapshots/) — схема Btrfs, место
  для сборок и кэшей, политика снимков.

## Сеть

- [NetworkManager и Libvirt](networking/networkmanager-and-libvirt/) — Wi-Fi
  через NetworkManager/iwd, nftables, сети виртуальных машин и mesh VPN.

## Безопасность

- [Политика doas](security/doas/) — действующая политика повышения привилегий.

## Приложения

- [Приложения](applications/) — нативные программы и оверлеи Portage,
  отдельные Flatpak/AppImage, синхронизация и резервные копии KeePassXC.

## Общие руководства

- [Установка Umbriel](../../desktop/umbriel/)
- [Noctalia](../../desktop/noctalia-shell/)
- [Niri](../../desktop/niri/)

## Как пользоваться разделом

Каталог `systems/asus-b5402/` описывает состояние и решения для этого ноутбука.
Повторяемые процедуры вынесены в общие руководства. Планы явно отделены от
применённых настроек; перед разрушительными действиями заново проверь состояние
системы.
