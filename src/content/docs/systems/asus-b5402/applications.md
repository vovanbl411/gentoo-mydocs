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
- **Firefox** — `www-client/firefox`; текущие USE-флаги и состояние
  `profile-sync-daemon` описаны ниже. Общие настройки — в
  [руководстве Firefox](../../../settings/firefox/).
- **KeePassXC** — `app-admin/keepassxc`; рабочая база хранится локально,
  архитектура синхронизации и резервного копирования описана ниже.
- **Thunderbird** — `mail-client/thunderbird`; текущее состояние описано ниже.

### Firefox

- Сборка использует Clang (`clang`) и нативный Wayland backend (`wayland`);
  X11 backend отключён (`-X`). Ebuild требует хотя бы один backend: `X` или
  `wayland`.
- Включён PGO (`pgo`); также включён обязательный для него `jumbo-build`.
- `hwaccel` устанавливает настройки Gentoo, принудительно включающие
  аппаратный рендеринг. Фактическое состояние графики проверяется отдельно в
  Firefox через **Справка → Информация для решения проблем** (`about:support`).
- `pulseaudio` выбирает обычный аудиобэкенд Firefox через `libpulse`/`apulse`;
  `system-pipewire` использует системную PipeWire library для WebRTC и
  screencast, но не выбирает обычный вывод звука.
- `-telemetry` отключает Mozilla build/data-reporting options и устанавливает
  Gentoo prefs для telemetry; это не гарантирует отсутствия любых сетевых
  запросов. `wasm-sandbox` включён.
- Для тяжёлой сборки Firefox получает `p-cores ssd` через
  `/etc/portage/package.env/10-performance`; назначение этих environments
  описано в [разделе Toolchain](../system/boot-and-portage/#toolchain).
- Установлен `profile-sync-daemon`; Firefox включён в `BROWSERS`, overlayfs и
  sync on suspend включены. Пользовательский unit `psd.service` включён.

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
- Для r2modman установлен локальный host AppImage; Steam — системный Flatpak
  `com.valvesoftware.Steam`. Исполняемый файл `~/.local/bin/steam.sh` запускает
  `flatpak run com.valvesoftware.Steam "$@"`; это обычный файл, не symlink.
- Каталог данных Steam Flatpak существует по пути
  `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`.
- Для `com.valvesoftware.Steam` настроены overrides на
  `~/.config/r2modmanPlus-local`: per-user override разрешает доступ к каталогу,
  system-wide override предоставляет read-only доступ.
- Подробности общей интеграции — в
  [руководстве r2modman и Steam Flatpak](../../../settings/r2modman/).

## KeePassXC: синхронизация и резервные копии

Рабочая база остаётся в локальном каталоге `~/Documents/KeePassSync/` и
синхронизируется с Android через Syncthing. Google Drive используется как
отдельный destination резервных копий, а не как live filesystem.

### Backup на ASUS B5402

| Слой | Текущая настройка |
|------|-------------------|
| Live-каталог | `~/Documents/KeePassSync/`, mode `0700` |
| Локальные копии | `~/Backups/KeePassXC/`, mode `0700` |
| KeePassXC save backup | Backup-before-save включён; timestamped копии сохраняются в локальный backup-каталог с `{DB_FILENAME}` и `{TIME:<format>}` |
| Wrapper | `~/.local/bin/keepassxc-backup-run`, mode `0700` |
| Rotation script | `~/.local/bin/keepassxc-backup-rotate`, mode `0700` |
| rclone destination | `gdrive:Backups/KeePassXC/`; remote использует backend `drive`, scope `drive.file` и собственный OAuth client |
| rclone config | `~/.config/rclone/rclone.conf`, mode `0600`; credentials и tokens в документацию не включаются |

Wrapper принимает только ровно одну top-level regular non-symlink `*.kdbx` в
live-каталоге. При нуле или нескольких файлах он останавливается до snapshot.
Это startup conflict gate; он не разрешает одновременные изменения и не
блокирует Syncthing.

Перед snapshot wrapper захватывает non-blocking `flock` на
`$XDG_RUNTIME_DIR/keepassxc-backup.lock` и удерживает его до завершения
rotation. Snapshot называется
`keepassxc-snapshot-YYYY-MM-DD_HH-MM-SS.XXXXXX.kdbx`, получает mode `0600` и
сверяется с live-базой побайтно через `cmp`.

После проверки snapshot `rclone copy` доставляет top-level regular `*.kdbx`
из `~/Backups/KeePassXC/` в `gdrive:Backups/KeePassXC/`. `copy` не удаляет
remote-файлы, отсутствующие в source; routine workflow не выполняет remote
rotation или удаление. Локальная rotation запускается с `--apply` только
после успешной доставки.

Rotation рассматривает top-level regular `*.kdbx` в локальном backup-каталоге
и удаляет по mtime файлы возрастом 90 дней и старше. Ручной запуск без
аргументов выполняет dry-run; удаление требует `--apply`.

`keepassxc-backup.service` — user `Type=oneshot`; timer `keepassxc-backup.timer`
включён и активен. Он запускается ежедневно в 20:00 по местному времени с
`Persistent=true`. `Linger=no`: user manager не остаётся запущенным после
завершения пользовательских сессий. Это фактическая настройка системы, а не
универсальная рекомендация.

Полный воспроизводимый workflow описан в
[руководстве по KeePassXC и rclone](../../../settings/keepassxc-backup/).
Параметры Syncthing и статус conflict/merge recovery приведены в
[руководстве по синхронизации KeePassXC](../../../settings/keepassxc-phone-sync/);
восстановление после одновременных правок остаётся PENDING.
