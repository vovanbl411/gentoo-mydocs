# Управление приложениями: Flatpak & Flatseal
В нашей системе GUI-приложения (мессенджеры, игры) устанавливаются через Flatpak. Это решает проблему зависимостей и обеспечивает безопасность за счет песочницы.
### 1. Установка и базовая настройка
Для работы Flatpak в Gentoo необходим пакет sys-apps/flatpak с включенным USE-флагом systemd.
# Добавление репозитория Flathub
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

### 2. Flatseal: Тонкая настройка прав
Flatseal — это графическая утилита для управления разрешениями Flatpak-пакетов.
Критически важные настройки для нашего сетапа (Wayland + Niri):
 * Socket: Отключаем x11 и fallback-x11, оставляем только wayland. Это гарантирует, что приложение не будет пытаться запустить XWayland.
 * Filesystem: Для приложений вроде Discord или Obsidian разрешаем доступ только к нужным папкам (например, xdg-run/app/com.discordapp.Discord), а не ко всему home.
 * Environment: Прописываем переменные для принудительного Wayland (например, MOZ_ENABLE_WAYLAND=1 для Firefox).
## 📄 Наполнение: applications/steam-multilib.ru.md
# Steam и Игры
Steam — одно из немногих приложений, которое может требовать multilib (32-бит) и специфичного доступа к железу.
### 1. Особенности запуска в Flatpak
Установка Steam через Flatpak избавляет от необходимости включать 32-битную архитектуру глобально в системе (в профиле Gentoo).
flatpak install flathub com.valvesoftware.Steam

### 2. Оптимизация производительности
В Flatseal для Steam необходимо разрешить:
 * Device: Доступ к /dev/dri (прямой рендеринг) и игровым контроллерам.
 * Shaders: Разрешить фоновую обработку шейдеров (актуально для Intel Xe).
 * MangoHud: Для мониторинга FPS установите Flatpak-версию MangoHud и пропишите в параметрах запуска игры: mangohud %command%.
