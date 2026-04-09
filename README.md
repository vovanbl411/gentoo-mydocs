# Gentoo Linux Documentation

Моя персональная документация по настройке и эксплуатации Gentoo Linux с акцентом на безопасность, производительность и современные технологии.

## Философия системы

Данная система построена на принципах:
- **Pure Wayland** — полный отказ от X11 в пользу нативного Wayland
- **LLVM/LTO** — использование clang с оптимизациями для максимальной производительности
- **Безопасность** — Secure Boot + TPM 2.0 + LUKS + AppArmor
- **Современный стек** — systemd, PipeWire, Dracut, Btrfs

## Структура документации

### 🚀 Установка и загрузка

| Раздел | Описание |
|--------|----------|
| [installation/base-system](installation/base-system.md) | Базовая настройка системы: LLVM toolchain, USE-флаги, ccache, mold |
| [installation/systemd-uki-setup](installation/systemd-uki-setup.md) | Настройка Unified Kernel Image через Dracut |
| [installation/secure-boot-tpm](installation/secure-boot-tpm.md) | Настройка Secure Boot и TPM 2.0 для автоматической расшифровки LUKS |

### 🖥️ Desktop Environment

| Раздел | Описание |
|--------|----------|
| [desktop/niri](desktop/niri.md) | Тайловый Wayland-композитор Niri со скроллингом окон |
| [desktop/noctalia-shell](desktop/noctalia-shell.md) | Кастомная панель на базе quickshell |
| [desktop/wayland-portals](desktop/wayland-portals.md) | Настройка XDG Desktop Portals для скринкастинга и диалогов |

### 💾 Файловая система

| Раздел | Описание |
|--------|----------|
| [filesystem/btrfs-setup](filesystem/btrfs-setup.md) | Структура субволюмов и опции монтирования |
| [filesystem/snapper-backups](filesystem/snapper-backups.md) | Настройка автоматических снимков системы |

### 🔧 Железо

| Раздел | Описание |
|--------|----------|
| [hardware/asus-expertbook](hardware/asus-expertbook.md) | Специфика ноутбука ASUS ExpertBook B5402 |
| [hardware/intel-grapgics](hardware/intel-grapgics.md) | Драйвер Intel Xe и Vulkan (ANV) |
| [hardware/cpu-optimization](hardware/cpu-optimization.md) | Оптимизация для Intel Alder Lake (P-cores + E-cores) |

### 🌐 Сеть

| Раздел | Описание |
|--------|----------|
| [networking/networkmanager-iwd](networking/networkmanager-iwd.md) | NetworkManager + iwd backend |
| [networking/nftables-firewall](networking/nftables-firewall.md) | Настройка nftables файрвола |
| [networking/wireless-regulatory](networking/wireless-regulatory.md) | Регуляторный домен для Wi-Fi |

### 🛡️ Безопасность

| Раздел | Описание |
|--------|----------|
| [security/kernel-hardening](security/kernel-hardening.md) | Защита ядра (в разработке) |
| [security/doas-configuration](security/doas-configuration.md) | Замена sudo на doas |

### ⚙️ Управление пакетами

| Раздел | Описание |
|--------|----------|
| [managed/portage](managed/portage.md) | Полное руководство по Portage и emerge |

### 📦 Приложения

| Раздел | Описание |
|--------|----------|
| [applications/flatpak](applications/flatpak.md) | Flatpak и Flatseal для изоляции приложений |

### ⚡ Настройки

| Раздел | Описание |
|--------|----------|
| [settings/gtk](settings/gtk.md) | Настройка GTK4 тем для Niri |
| [settings/nm-iwd](settings/nm-iwd.md) | MAC-рандомизация и iwd |
| [settings/r2modman](settings/r2modman.md) | Интеграция r2modman со Steam (Flatpak) |
| [settings/scanner-driver](settings/scanner-driver.md) | Настройка сканера отпечатков Elan 04f3:0c77 |
| [settings/obs-studio.md](settings/obs-studio.md) | Полное руководство по OBS Studio, FFmpeg и настройке кодеков |

## Ключевые компоненты системы

### Ядро и загрузка
- **Gentoo Kernel** с savedconfig для кастомной оптимизации
- **Dracut** для генерации initramfs и UKI
- **systemd-boot** как загрузчик
- **Secure Boot** с собственными ключами (sbctl)

### Графика
- **Niri** — тайловый Wayland-композитор
- **Intel Xe** — современный драйвер для графики Alder Lake
- **Zink** — OpenGL через Vulkan
- **Mesa** с поддержкой VAAPI и Vulkan

### Звук
- **PipeWire** — современный звуковой сервер
- **WirePlumber** — управление PipeWire

### Безопасность
- **LUKS2** — шифрование диска
- **TPM 2.0** — автоматическая расшифровка
- **AppArmor** — Mandatory Access Control

## Быстрые ссылки

- [Gentoo Handbook](https://wiki.gentoo.org/wiki/Handbook:AMD64)
- [Niri Wiki](https://github.com/YaLTeR/niri)
- [Noctalia Shell](https://github.com/quickget/quickget)
- [Dracut Documentation](https://github.com/dracutdevs/dracut)

---

*Документация поддерживается вручную и обновляется по мере изменения конфигурации системы.*
