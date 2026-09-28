---
title: Приложения ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-28"
verified_on: [asus-b5402]
---

## Current state

- Firefox — native Gentoo: сборка под Wayland (LLVM 22, PGO, аппаратное
  ускорение), профиль обслуживает profile-sync-daemon.
- Steam и GUI-приложения — Flatpak (14 приложений, remote — flathub);
  разрешения выдаются через Flatseal с предпочтением Wayland.
- OBS Studio — Flatpak (`com.obsproject.Studio` 32.2.2, проверено 2026-09-22).
- Perplexity — AppImage + пользовательский `.desktop`
  (`~/.local/share/applications/perplexity.desktop`); схема
  `perplexity-app://` зарегистрирована.
- r2modman — AppImage; запускает Flatpak-версию Steam через wrapper
  `~/.local/bin/steam.sh` (`flatpak run com.valvesoftware.Steam "$@"`).
- KeePassXC — native Gentoo (`app-admin/keepassxc`, runtime
  `2.8.0-snapshot`); включён встроенный backup перед сохранением базы:
  timestamped `.kdbx` в `~/Backups/KeePassXC/` (directory mode `0700`).
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` (собственный
  OAuth Desktop client, scope `drive.file`; publishing status приложения —
  пока *Testing*); backups KeePassXC вручную доставляются в
  `gdrive:Backups/KeePassXC/` без удаления на remote.

Записи перенесены из общих руководств и сверены с системой 2026-09-22.
Записи KeePassXC и rclone проверены отдельно 2026-09-28: OAuth Desktop
client работает, remote `gdrive:` работает, реальный backup KDBX доставлен
в Google Drive и скачан обратно byte-identical (`cmp`, SHA-256 — PASS).
Остаточные шаги live-конфигурации: перевести OAuth-приложение из *Testing*
в *In production*, обязательно переподключить авторизацию
(`rclone config reconnect gdrive:`) и повторить минимальную проверку
transport: list remote, upload test file, read, deletefile. До этого
долговременная схема доставки не считается завершённой. Остальные
приложения 2026-09-28 повторно не проверялись.

## Firefox

- profile-sync-daemon активен, режим overlayfs.
- Текущие размеры профиля (2026-09-22): живой вид через overlay — ~653 MiB,
  upper-слой в `/run/user/1000/psd/` — ~168 MiB.

## Plans (не применены)

- OBS: package policy и настройки порта-стека остаются планом.
- Perplexity: перенос конфигурации в chezmoi остаётся планом.
- KeePassXC backups: завершение схемы требует перевести OAuth-приложение из
  *Testing* в *In production*, обязательно переподключить авторизацию и
  выполнить минимальную проверку transport; далее — production rotation
  локальной 90-day истории, design и
  implementation automation доставки, синхронизация с телефоном; доставка
  в Google Drive идёт без удаления — rotation/удаление на remote
  намеренно не выполняются.

## Общие руководства

- [Firefox](../../../settings/firefox/)
- [Flatpak и Flatseal](../../../settings/flatpak/)
- [Резервные копии KeePassXC в Google Drive](../../../settings/keepassxc-backup/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman и Steam Flatpak](../../../settings/r2modman/)
