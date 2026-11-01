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
- **Thunderbird** — `mail-client/thunderbird`; текущее состояние описано ниже.

### Thunderbird

- Активный профиль находится в `~/.config/thunderbird`. В нём настроены шесть
  IMAP-аккаунтов: четыре Gmail, один Yandex и один Mail.ru.
- Текущий план Portage выбирает `wayland` и `pulseaudio`; `X`, `hwaccel` и
  `system-pipewire` выключены. `-hwaccel` не определяет runtime renderer;
  `pulseaudio` задаёт audio backend через libpulse, а `system-pipewire` относится
  к WebRTC и screencast.
- Тяжёлая сборка получает `p-cores ssd` через
  `/etc/portage/package.env/10-performance`. Назначение package environments и
  `ssd` описано в [разделе Toolchain](../system/boot-and-portage/#toolchain) и
  [описании кэшей сборки](../system/boot-and-portage/#память-и-кэши-сборки).
- Для четырёх Gmail-аккаунтов в Thunderbird отключён `Place a copy in`.
  Gmail сохраняет отправленные через SMTP письма на сервере; эта настройка
  помогает избежать дубликатов в Sent.
- `x11-libs/libnotify` установлен. Gentoo ebuild Thunderbird предлагает его
  как optional feature для desktop notifications, а не как обязательную
  зависимость. В активном профиле также установлено расширение
  `NTFNTF: Notify on This Folder Not That Folder` для выборочных уведомлений
  по папкам.

Актуальные параметры пакета и общие принципы настройки описаны в
[руководстве Thunderbird](../../../settings/thunderbird/).

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
