---
kind: reference
scope: general
status: current
last_verified: null
verified_on: [asus-b5402]
---

# Gentoo Linux Documentation

Практическая документация по настройке и эксплуатации Gentoo Linux с акцентом
на безопасность, производительность и современный Wayland-стек. Примеры
основаны на ASUS ExpertBook B5402, но фактическое состояние этой машины не
должно подменять общую инструкцию.

## Что здесь собрано

Опыт эксплуатации одной Gentoo-системы, оформленный как повторяемые
руководства:

- systemd и hardened-профиль, Portage на LLVM toolchain (Clang/LLD, ThinLTO);
- Wayland-окружение на Niri с оболочкой Noctalia;
- Btrfs со снапшотами Snapper, загрузка через systemd-boot + UKI (Dracut);
- безопасность: Secure Boot, TPM 2.0, LUKS2, AppArmor, auditd, USBGuard, doas;
- диагностика аппаратного и программного стека.

## С чего начать

- [Поставить и настроить базовую систему](src/content/docs/installation/base-system.md) —
  toolchain, USE-флаги, ccache, lld.
- [Посмотреть реальную конфигурацию ноутбука](src/content/docs/systems/asus-b5402/index.md) —
  записанное состояние эталонной машины.
- [Настроить рабочий стол](src/content/docs/desktop/niri.md) — Niri, Noctalia, порталы,
  приложения по умолчанию.
- [Разобраться с загрузкой и защитой](src/content/docs/installation/systemd-uki-setup.md) —
  UKI через Dracut, [Secure Boot и TPM2](src/content/docs/installation/secure-boot-tpm.md).
- [Найти решение проблемы](src/content/docs/troubleshooting/) — повторяемые разборы конкретных
  симптомов.

## Эталонная система

ASUS ExpertBook B5402CBA (Intel Core i7-1260P, Alder Lake) — основная машина,
на которой проверяются руководства. Её текущее состояние записано в
[systems/asus-b5402/](src/content/docs/systems/asus-b5402/index.md): Niri + Noctalia,
Clang/LLD, systemd-boot + UKI, Btrfs + Snapper, Secure Boot + TPM2.

## Визуальный обзор

| Рабочий стол | Панель | Система |
|------------|--------|--------|
| ![Desktop](screenshots/Screenshot%20from%202026-04-10%2015-31-19.png) | ![Shell](screenshots/Screenshot%20from%202026-04-10%2015-31-37.png) | ![Status](screenshots/Screenshot%20from%202026-04-10%2016-09-05.png) |

## Документация

### 🚀 Установка и загрузка

| Раздел | Описание |
|--------|----------|
| [installation/base-system](src/content/docs/installation/base-system.md) | Базовая настройка системы: LLVM toolchain, USE-флаги, ccache, lld |
| [installation/systemd-uki-setup](src/content/docs/installation/systemd-uki-setup.md) | Настройка Unified Kernel Image через Dracut |
| [installation/secure-boot-tpm](src/content/docs/installation/secure-boot-tpm.md) | Настройка Secure Boot и TPM 2.0 для автоматической расшифровки LUKS |

### 🖥️ Desktop Environment

| Раздел | Описание |
|--------|----------|
| [desktop/niri](src/content/docs/desktop/niri.md) | Тайловый Wayland-композитор Niri со скроллингом окон |
| [desktop/noctalia-shell](src/content/docs/desktop/noctalia-shell.md) | Нативная Wayland-оболочка Noctalia v5 для Niri |
| [desktop/wayland-portals](src/content/docs/desktop/wayland-portals.md) | Настройка XDG Desktop Portals для скринкастинга и диалогов |
| [desktop/default-applications](src/content/docs/desktop/default-applications.md) | Приложения по умолчанию, MIME-типы и URI-схемы через XDG |

### 💾 Файловая система

| Раздел | Описание |
|--------|----------|
| [filesystem/btrfs-setup](src/content/docs/filesystem/btrfs-setup.md) | Структура субволюмов и опции монтирования |
| [filesystem/snapper-backups](src/content/docs/filesystem/snapper-backups.md) | Настройка автоматических снимков системы |

### 🔧 Железо

| Раздел | Описание |
|--------|----------|
| [hardware/intel-graphics](src/content/docs/hardware/intel-graphics.md) | Драйвер Intel Xe и Vulkan (ANV) |

### 🌐 Сеть

| Раздел | Описание |
|--------|----------|
| [networking/networkmanager-iwd](src/content/docs/networking/networkmanager-iwd.md) | NetworkManager + iwd backend |
| [networking/nftables-firewall](src/content/docs/networking/nftables-firewall.md) | Настройка nftables файрвола |
| [networking/wireless-regulatory](src/content/docs/networking/wireless-regulatory.md) | Регуляторный домен для Wi-Fi |

### 🛡️ Безопасность

| Раздел | Описание |
|--------|----------|
| [security/app-armor](src/content/docs/security/app-armor.md) | Настройка AppArmor для ограничения приложений |
| [security/auditd](src/content/docs/security/auditd.md) | Система аудита событий безопасности |
| [security/usbguard](src/content/docs/security/usbguard.md) | Контроль USB-устройств и защита от BadUSB |
| [security/kernel-hardening](src/content/docs/security/kernel-hardening.md) | Защита ядра: sysctl, hardened flags |
| [security/doas-configuration](src/content/docs/security/doas-configuration.md) | Замена sudo на doas |

### ⚙️ Управление пакетами

| Раздел | Описание |
|--------|----------|
| [managed/portage](src/content/docs/managed/portage.md) | Полное руководство по Portage и emerge |

### ⚡ Настройки

| Раздел | Описание |
|--------|----------|
| [settings/gtk](src/content/docs/settings/gtk.md) | Настройка GTK4 тем для Niri |
| [settings/r2modman](src/content/docs/settings/r2modman.md) | Интеграция r2modman со Steam (Flatpak) |
| [settings/obs-studio](src/content/docs/settings/obs-studio.md) | OBS Studio, FFmpeg и настройка кодеков |
| [settings/perplexity](src/content/docs/settings/perplexity.md) | Интеграция Perplexity AppImage в меню приложений |
| [settings/firefox](src/content/docs/settings/firefox.md) | Firefox: Clang, PGO, Wayland, Profile-sync-daemon |
| [settings/flatpak](src/content/docs/settings/flatpak.md) | Flatpak и Flatseal для изоляции приложений |

### 🔍 Решение проблем

| Раздел | Описание |
|--------|----------|
| [troubleshooting/android-usb-mtp](src/content/docs/troubleshooting/android-usb-mtp.md) | Диагностика проблем USB/MTP при подключении Android-телефона |
| [troubleshooting/docker-29-iptables-missing](src/content/docs/troubleshooting/docker-29-iptables-missing.md) | Docker 29 не запускается из-за отсутствия команды `iptables` |
| [troubleshooting/docker-libvirt-nftables](src/content/docs/troubleshooting/docker-libvirt-nftables.md) | Решение конфликта Docker и Libvirt в nftables |
| [troubleshooting/networkmanager-iwd-mac-randomization](src/content/docs/troubleshooting/networkmanager-iwd-mac-randomization.md) | MAC-рандомизация с NetworkManager и iwd |
| [troubleshooting/luks-tpm2-unlock-after-uki-rebuild](src/content/docs/troubleshooting/luks-tpm2-unlock-after-uki-rebuild.md) | Диагностика TPM2/PCR mismatch после изменений загрузочной цепочки |

## ⚙️ Управление конфигурацией

Конфигурационные файлы управляются через `chezmoi`
([vovanbl411/dotfiles](https://github.com/vovanbl411/dotfiles)):

```bash
emerge -av app-admin/chezmoi
chezmoi init --apply https://github.com/vovanbl411/dotfiles
```

## О репозитории

- [Политика документации](DOCUMENTATION_POLICY.md) разделяет общие
  руководства, состояние эталонной системы, troubleshooting и историю.
- [Правила участия](CONTRIBUTING.md) содержат шаблон метаинформации и порядок
  проверки изменений.
- [Инвентаризация](DOCUMENTATION_INVENTORY.md) фиксирует исходную
  классификацию и результат миграции.
- Записи с `last_verified: null` нельзя считать результатом текущего аудита.

*Документация поддерживается вручную и обновляется по мере изменения
конфигурации системы.*

## Быстрые ссылки

- [Gentoo Handbook](https://wiki.gentoo.org/wiki/Handbook:AMD64)
- [Gentoo Hardened](https://wiki.gentoo.org/wiki/Project:Hardened)
- [Niri Wiki](https://www.mintlify.com/niri-wm/niri/development/documenting-niri)
- [Noctalia Shell](https://noctalia.dev/)
- [Dracut Documentation](https://dracut-ng.github.io/dracut-ng/)
- [BOLT Documentation](https://github.com/llvm/llvm-project/tree/main/bolt)
