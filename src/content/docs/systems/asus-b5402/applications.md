---
title: Приложения ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Текущее состояние

Для части графических приложений используется Flatpak; AppImage оставлен для
приложений с локальной интеграцией с рабочим столом.

## Нативные приложения

- **Zed** — `app-editors/zed` из
  [zed-overlay](https://github.com/vovanbl411/zed-overlay), редактор кода.
- **spotatui** — `media-sound/spotatui` из
  [spotatui-overlay](https://github.com/vovanbl411/spotatui-overlay).
  Включены USE-флаги `cover`, `local-files`, `mpris`, `visualizer` и
  `youtube`.
- **Vicinae** — `gui-apps/vicinae` из
  [vicinae-overlay](https://github.com/vovanbl411/vicinae-overlay).
- **Firefox** — `www-client/firefox`; включены USE-флаги `wayland`, `pgo` и
  `hwaccel`. Флаг `hwaccel` добавляет поддержку аппаратного ускорения при
  сборке. Для профиля Firefox настроен `profile-sync-daemon` с режимом
  `overlayfs`; подробности — в [руководстве Firefox](../../../settings/firefox/).
- **KeePassXC** — `app-admin/keepassxc`; рабочая база хранится локально,
  архитектура синхронизации и резервного копирования описана ниже.
- **Thunderbird** — `mail-client/thunderbird`. Включены USE-флаги `wayland` и
  `pulseaudio`; для системных уведомлений нужен `x11-libs/libnotify`.
  Настройки описаны в [руководстве Thunderbird](../../../settings/thunderbird/).

## Flatpak

Для этих приложений используется системная установка Flatpak. Steam,
OBS Studio, Spotify и Flatseal получены из Flathub; ChatGPT Desktop установлен
из локально собранного Flatpak bundle.

- Steam — `com.valvesoftware.Steam`; интеграция с r2modman описана в
  [отдельном руководстве](../../../settings/r2modman/).
- ChatGPT Desktop — `com.openai.ChatGPT`; способ установки и разрешения
  описаны в [руководстве ChatGPT Desktop](../../../settings/chatgpt-desktop/).
- OBS Studio — `com.obsproject.Studio`. На этой системе используется
  Flatpak-вариант; варианты установки описаны в
  [руководстве OBS Studio](../../../settings/obs-studio/).
- Spotify — `com.spotify.Client`; он установлен одновременно с нативным spotatui.
- Flatseal — `com.github.tchx84.Flatseal`, графический интерфейс для просмотра
  и настройки разрешений Flatpak-приложений. Общие принципы описаны в
  [руководстве Flatpak](../../../settings/flatpak/).

## AppImage

- Perplexity запускается через `.desktop`-файл
  `~/.local/share/applications/perplexity.desktop`; для ссылок приложения
  зарегистрирована схема `perplexity-app://`. Подробности — в
  [руководстве Perplexity](../../../settings/perplexity/).
- Для r2modman используется локальный AppImage. Для интеграции со Steam
  Flatpak есть скрипт-обёртка `~/.local/bin/steam.sh`, который передаёт
  аргументы команде `flatpak run com.valvesoftware.Steam`. Подробнее —
  [r2modman и Steam Flatpak](../../../settings/r2modman/).

## KeePassXC: синхронизация и резервные копии

Рабочая база KeePassXC хранится локально. Syncthing синхронизирует её с
Android, а отдельная схема резервного копирования сохраняет локальные копии
и отправляет их через rclone в Google Drive. Google Drive используется только
для резервных копий.

Порядок синхронизации описан в
[руководстве KeePassXC и Syncthing](../../../settings/keepassxc-phone-sync/),
а резервного копирования — в
[руководстве KeePassXC и rclone](../../../settings/keepassxc-backup/).
