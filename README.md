---
kind: reference
scope: repository
status: current
last_verified: null
verified_on: []
---

# Gentoo Linux Documentation

Практические руководства по Gentoo Linux: hardened-профиль с systemd, LLVM
toolchain, Pure Wayland на Niri и Noctalia, systemd-boot и UKI через Dracut,
Btrfs и Snapper, Secure Boot, TPM 2.0 и LUKS2. Отдельные материалы посвящены
сканеру отпечатков ELAN и KeePassXC: резервным копиям и синхронизации
live-базы с Android через Syncthing и KeePassDX.

Примеры основаны на ASUS ExpertBook B5402, но общие руководства отделены от
[записанного состояния эталонной системы](src/content/docs/systems/asus-b5402/index.md).

> 🌐 [Открыть документацию как сайт](https://vovanbl411.github.io/gentoo-mydocs/)

## С чего начать

- [Установка Gentoo и базовая настройка](src/content/docs/installation/base-system.md)
- [Загрузка через systemd-boot и UKI](src/content/docs/installation/systemd-uki-setup.md)
- [Настроить рабочий стол на Niri](src/content/docs/desktop/niri.md)
- [Состояние эталонной системы ASUS B5402](src/content/docs/systems/asus-b5402/index.md)

## Руководства

### Установка и загрузка

- [Базовая настройка Gentoo](src/content/docs/installation/base-system.md) — LLVM toolchain, USE-флаги, ccache и lld.
- [systemd-boot и UKI через Dracut](src/content/docs/installation/systemd-uki-setup.md)
- [Secure Boot, TPM 2.0 и LUKS](src/content/docs/installation/secure-boot-tpm.md)

### Рабочий стол

- [Niri](src/content/docs/desktop/niri.md) — Wayland-композитор.
- [Noctalia Shell](src/content/docs/desktop/noctalia-shell.md) — оболочка для Niri.
- [Wayland portals](src/content/docs/desktop/wayland-portals.md) — скринкастинг и системные диалоги.
- [Приложения по умолчанию](src/content/docs/desktop/default-applications.md) — MIME-типы и URI-схемы.

### Файловая система

- [Btrfs](src/content/docs/filesystem/btrfs-setup.md) — субволюмы и параметры монтирования.
- [Snapper](src/content/docs/filesystem/snapper-backups.md) — автоматические снимки системы.

### Оборудование

- [Intel graphics](src/content/docs/hardware/intel-graphics.md) — графика и Vulkan (ANV).
- [ELAN fingerprint](src/content/docs/hardware/elan-fingerprint-04f3-0c77.md) — поддержка сканера отпечатков в Gentoo.

### Сеть

- [NetworkManager и iwd](src/content/docs/networking/networkmanager-iwd.md)
- [nftables firewall](src/content/docs/networking/nftables-firewall.md)
- [Wireless regulatory domain](src/content/docs/networking/wireless-regulatory.md)

### Безопасность

- [AppArmor](src/content/docs/security/app-armor.md)
- [auditd](src/content/docs/security/auditd.md)
- [doas](src/content/docs/security/doas-configuration.md)
- [Kernel hardening](src/content/docs/security/kernel-hardening.md)
- [USBGuard](src/content/docs/security/usbguard.md)

### Управление пакетами

- [Portage](src/content/docs/managed/portage.md) — управление пакетами и emerge.

### Настройки и приложения

- [Firefox](src/content/docs/settings/firefox.md)
- [Thunderbird](src/content/docs/settings/thunderbird.md)
- [Flatpak и Flatseal](src/content/docs/settings/flatpak.md)
- [GTK](src/content/docs/settings/gtk.md)
- [Резервные копии KeePassXC в Google Drive](src/content/docs/settings/keepassxc-backup.md)
- [Синхронизация KeePassXC с Android через Syncthing](src/content/docs/settings/keepassxc-phone-sync.md)
- [OBS Studio](src/content/docs/settings/obs-studio.md)
- [Perplexity](src/content/docs/settings/perplexity.md)
- [r2modman](src/content/docs/settings/r2modman.md)

### Troubleshooting

- [Android USB/MTP](src/content/docs/troubleshooting/android-usb-mtp.md)
- [Docker 29 и отсутствующий iptables](src/content/docs/troubleshooting/docker-29-iptables-missing.md)
- [Docker, Libvirt и nftables](src/content/docs/troubleshooting/docker-libvirt-nftables.md)
- [KeePassXC Quick Unlock и polkit](src/content/docs/troubleshooting/keepassxc-quick-unlock-polkit.md)
- [LUKS/TPM2 unlock после пересборки UKI](src/content/docs/troubleshooting/luks-tpm2-unlock-after-uki-rebuild.md)
- [NetworkManager, iwd и MAC randomization](src/content/docs/troubleshooting/networkmanager-iwd-mac-randomization.md)

### Эталонная система

- [ASUS ExpertBook B5402](src/content/docs/systems/asus-b5402/index.md) — записанное состояние эталонной машины.

## Внешние ресурсы

- [Gentoo Handbook](https://wiki.gentoo.org/wiki/Handbook:AMD64)
- [Gentoo Hardened](https://wiki.gentoo.org/wiki/Project:Hardened)
- [Niri documentation](https://www.mintlify.com/niri-wm/niri/development/documenting-niri)
- [Noctalia Shell](https://noctalia.dev/)
- [Dracut documentation](https://dracut-ng.github.io/dracut-ng/)
