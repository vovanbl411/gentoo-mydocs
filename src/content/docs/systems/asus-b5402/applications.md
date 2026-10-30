---
title: Приложения ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Приложения

- Zed — редактор кода, пакет `app-editors/zed` из
  [zed-overlay](https://github.com/vovanbl411/zed-overlay).
- spotatui — терминальный клиент Spotify, пакет `media-sound/spotatui` из
  [spotatui-overlay](https://github.com/vovanbl411/spotatui-overlay).
  Для воспроизведения Spotify нужна подписка Premium. Включены USE-флаги
  `cover`, `mpris`, `visualizer`, `local-files` и `youtube`.
- Firefox — пакет Gentoo с поддержкой Wayland, PGO и аппаратного ускорения.
  Профиль обслуживает profile-sync-daemon в режиме overlayfs.
- Steam — Flatpak из Flathub. Разрешения приложений Flatpak настраиваются
  через Flatseal с предпочтением Wayland.
- ChatGPT Desktop — системный Flatpak `com.openai.ChatGPT`, ветка `master`.
  Установка и разрешения описаны в
  [руководстве ChatGPT Desktop](../../../settings/chatgpt-desktop/).
- OBS Studio — Flatpak `com.obsproject.Studio`.
- Perplexity — AppImage с файлом запуска
  `~/.local/share/applications/perplexity.desktop`; для ссылок приложения
  зарегистрирована схема `perplexity-app://`.
- r2modman — AppImage. Запускает Flatpak-версию Steam через
  `~/.local/bin/steam.sh`: `flatpak run com.valvesoftware.Steam "$@"`.
- KeePassXC — пакет Gentoo `app-admin/keepassxc`. База открывается с локального
  диска; Syncthing синхронизирует её с телефоном, rclone доставляет резервные
  копии в Google Drive. Подробности — ниже.
- Thunderbird — пакет Gentoo с поддержкой Wayland, WebRender и звука через
  PipeWire/Pulse. Настройки почты и уведомлений описаны ниже и в
  [руководстве Thunderbird](../../../settings/thunderbird/).

## KeePassXC: база, синхронизация и резервные копии

Рабочая база находится в `~/Documents/KeePassSync/`. В этом каталоге должна
быть ровно одна база `*.kdbx`: обычный файл, не символическая ссылка, с правами
`0600`. Скрипт резервного копирования ищет файл только в самом каталоге,
без вложенных папок. Если обнаружено несколько баз, например копия конфликта
Syncthing, он останавливается, чтобы не сохранить случайно выбранный файл.

Syncthing (`net-p2p/syncthing`) работает как пользовательская служба systemd.
Папка `keepassxc-live` синхронизирует только `~/Documents/KeePassSync/`
с `Documents/KeePassSync` на Android, где используются Syncthing-Fork
и KeePassDX. Другие каталоги с резервными копиями в синхронизацию не входят.
Если на двух устройствах появились разные изменения, порядок сохранения
копий и слияния описан в
[руководстве по синхронизации](../../../settings/keepassxc-phone-sync/).

KeePassXC создаёт копию с отметкой времени перед сохранением. Дополнительно
`keepassxc-backup.timer` ежедневно в 20:00 по местному времени запускает
`keepassxc-backup.service`: служба создаёт копию базы в `~/Backups/KeePassXC/`,
доставляет копии в `gdrive:Backups/KeePassXC/` и после успешной доставки
удаляет локальные копии возрастом 90 дней и старше. При ошибке передачи
локальные копии сохраняются. Из Google Drive файлы автоматически не удаляются.

Для таймера задано `Persistent=true`: пропущенный запуск выполняется, когда
пользовательская служба systemd снова становится активной. `Linger=no`, поэтому
без пользовательской сессии отдельного фонового запуска нет. Эти настройки
также не повторяют автоматически уже завершившуюся с ошибкой передачу.

rclone (`net-misc/rclone`) использует собственное OAuth-приложение типа
Desktop со scope `drive.file` и статусом *In production*. Google Drive хранит
резервные копии; открывать рабочую базу через облачное монтирование не нужно.
Скрипты, службы, восстановление и настройка OAuth описаны в
[руководстве по резервным копиям](../../../settings/keepassxc-backup/).

## Thunderbird

Настроены шесть IMAP-аккаунтов: четыре Gmail, Yandex и Mail.ru. Полная
автономная синхронизация включена; профиль находится в `~/.config/thunderbird/`.
Два выбранных Gmail показывают уведомления со звуком, остальные аккаунты
синхронизируются без уведомлений. Выбор папок задаёт расширение
`NTFNTF: Notify on This Folder Not That Folder`.

Для системных уведомлений отдельно установлен `x11-libs/libnotify`.
Thunderbird предлагает эту библиотеку как дополнительную возможность,
поэтому установка самого почтового клиента не добавляет её автоматически.

## Обслуживание Flatpak

Приложения устанавливаются из Flathub. `org.electronjs.Electron2.BaseApp` —
основа для сборки Electron-приложения, а не отдельное приложение для запуска.
Обновление программ, удаление неиспользуемых сред выполнения и настройка
разрешений описаны в [руководстве Flatpak](../../../settings/flatpak/).

## Общие руководства

- [Firefox](../../../settings/firefox/)
- [Flatpak и Flatseal](../../../settings/flatpak/)
- [ChatGPT Desktop через Flatpak](../../../settings/chatgpt-desktop/)
- [Резервные копии KeePassXC в Google Drive](../../../settings/keepassxc-backup/)
- [Синхронизация KeePassXC с Android через Syncthing](../../../settings/keepassxc-phone-sync/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman и Steam Flatpak](../../../settings/r2modman/)
- [Thunderbird](../../../settings/thunderbird/)
