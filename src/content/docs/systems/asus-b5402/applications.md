---
title: Приложения ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Current state

- Firefox — native Gentoo: сборка под Wayland (LLVM 22, PGO, аппаратное
  ускорение), профиль обслуживает profile-sync-daemon.
- Steam и GUI-приложения — Flatpak (12 приложений, remote — flathub);
  разрешения выдаются через Flatseal с предпочтением Wayland.
- OBS Studio — Flatpak (`com.obsproject.Studio` 32.2.2, проверено 2026-09-22).
- Perplexity — AppImage + пользовательский `.desktop`
  (`~/.local/share/applications/perplexity.desktop`); схема
  `perplexity-app://` зарегистрирована.
- r2modman — AppImage; запускает Flatpak-версию Steam через wrapper
  `~/.local/bin/steam.sh` (`flatpak run com.valvesoftware.Steam "$@"`).
- KeePassXC — native Gentoo (`app-admin/keepassxc`, runtime
  `2.8.0-snapshot`). Live DB — в `~/Documents/KeePassSync/`: ровно один
  top-level regular non-symlink `*.kdbx` (mode `0600`). Встроенные копии с timestamp
  перед сохранением и ежедневные локальные копии в `~/Backups/KeePassXC/`
  включены. Доставка в Google Drive работает ежедневно в 20:00 local time
  через `keepassxc-backup.service` / `keepassxc-backup.timer`
  (`Persistent=true`, `Linger=no`); таймер включён. Backup прошёл приёмку
  2026-09-29; 2026-09-28 реальная KDBX-копия после доставки и скачивания
  совпала побайтно (`cmp`, SHA-256 — PASS). Обычная Android sync работает
  с 2026-09-30. Реальное conflict recovery /
  KeePassXC merge остаётся pending. Подробнее: [backup](../../../settings/keepassxc-backup/)
  и [phone sync](../../../settings/keepassxc-phone-sync/).
- Syncthing `net-p2p/syncthing-2.0.16` работает как systemd --user service
  (`Linger=no`). Синхронизирует только `~/Documents/KeePassSync/`, Folder ID
  `keepassxc-live`, с Android Syncthing-Fork и KeePassDX по пути
  `Documents/KeePassSync`. Защищённая LAN sync и изменения в обоих
  направлениях работают (2026-09-30). Настройка и recovery — в
  [phone-sync guide](../../../settings/keepassxc-phone-sync/).
- rclone (`net-misc/rclone`) ежедневно доставляет KeePassXC backups в
  `gdrive:Backups/KeePassXC/` без удаления remote-файлов. Собственный OAuth
  Desktop client использует `drive.file`; приложение — *In production*.
  Remote и transport проверены 2026-09-29; конфигурация и OAuth lifecycle —
  в [backup guide](../../../settings/keepassxc-backup/).
- Thunderbird `157.0` — native Gentoo; Wayland, WebRender и Mesa `iris`
  на Intel Iris Xe ADL GT2 под Niri, `pulse-rust` через PipeWire/Pulse.
  Шесть IMAP-аккаунтов (Gmail ×4, Yandex ×1, Mail.ru ×1); отправка и получение
  работают, полная offline sync включена. Профиль — в `~/.config/thunderbird/`.
  Два выбранных Gmail получают звук + визуальное уведомление, остальные
  синхронизируются тихо. Policy задаёт `NTFNTF: Notify on This Folder Not That Folder`
  1.3.1. `x11-libs/libnotify` оставлен explicit world package для проверенного
  notification path. Runtime проверен 2026-10-01, уведомления — 2026-10-07.
  Подробности — в [Thunderbird guide](../../../settings/thunderbird/).

## Flatpak policy

В inventory 12 приложений (2026-10-04). Неиспользуемый EOL runtime
`org.freedesktop.Platform.ffmpeg-full//24.08` отсутствует; `flatpak update`
показал `Nothing to update`. Проверка охватывала inventory и runtimes,
без повторной проверки поведения каждого приложения. Разрешения и
обслуживание описаны в [Flatpak guide](../../../settings/flatpak/).

## Firefox

- profile-sync-daemon активен, режим overlayfs.
- Текущие размеры профиля (2026-09-22): живой вид через overlay — ~653 MiB,
  upper-слой в `/run/user/1000/psd/` — ~168 MiB.

## Границы проверки

Firefox, OBS, Perplexity и r2modman проверены 2026-09-22; даты backup, sync,
Thunderbird и Flatpak указаны выше. При этой правке новой live-проверки
не было. Команды проверки и ожидаемые результаты — в профильных guides.

## Plans (не применены)

- OBS: package policy и настройки порта-стека остаются планом.
- Perplexity: перенос конфигурации в chezmoi остаётся планом.
- KeePassXC: обычная phone sync принята; end-to-end conflict recovery и
  KeePassXC merge остаются pending. См.
  [руководство по синхронизации](../../../settings/keepassxc-phone-sync/).

## Общие руководства

- [Firefox](../../../settings/firefox/)
- [Flatpak и Flatseal](../../../settings/flatpak/)
- [Резервные копии KeePassXC в Google Drive](../../../settings/keepassxc-backup/)
- [Синхронизация KeePassXC с Android через Syncthing](../../../settings/keepassxc-phone-sync/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman и Steam Flatpak](../../../settings/r2modman/)
- [Thunderbird](../../../settings/thunderbird/)
