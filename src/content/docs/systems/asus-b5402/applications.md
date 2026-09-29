---
title: Приложения ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-29"
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
  Local 90-day rotation установлена как
  `~/.local/bin/keepassxc-backup-rotate`; production destructive acceptance
  — PASS 2026-09-29. По умолчанию script делает dry-run; удаление выполняется
  только при явном `--apply`, запуск пока ручной.
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` с собственным
  OAuth Desktop client и scope `drive.file`; publishing status приложения —
  *In production*. Remote `gdrive:` повторно авторизован командой
  `rclone config reconnect gdrive:` (PASS); post-reauth transport validation
  (list, upload, read, deletefile, проверка отсутствия временного объекта) —
  PASS 2026-09-29. KeePassXC backups вручную доставляются в
  `gdrive:Backups/KeePassXC/` без удаления на remote.

Записи перенесены из общих руководств и сверены с системой 2026-09-22.
Записи KeePassXC и rclone проверены отдельно 2026-09-29: OAuth Desktop
client и remote `gdrive:` работают; приложение находится в *In production*,
remote `gdrive:` повторно авторизован командой
`rclone config reconnect gdrive:` (PASS), post-reauth transport validation
— PASS. Реальный backup KDBX доставлен и скачан обратно byte-identical
2026-09-28 (`cmp`, SHA-256 — PASS). Production acceptance local rotation
пройден 2026-09-29: default dry-run сохранил candidate, `--apply` удалил
только expired test KDBX; non-KDBX control и реальный KDBX сохранились,
SHA-256 реального KDBX до/после совпал. Rotation запускается вручную,
расписания нет. Остальные приложения 2026-09-29 повторно не проверялись.

## Firefox

- profile-sync-daemon активен, режим overlayfs.
- Текущие размеры профиля (2026-09-22): живой вид через overlay — ~653 MiB,
  upper-слой в `/run/user/1000/psd/` — ~168 MiB.

## Plans (не применены)

- OBS: package policy и настройки порта-стека остаются планом.
- Perplexity: перенос конфигурации в chezmoi остаётся планом.
- KeePassXC backups: следующий этап — design и implementation automation
  вызова local rotation и доставки; scheduler пока не выбран. Затем —
  синхронизация с телефоном. Доставка в Google Drive идёт без удаления —
  rotation/удаление на remote намеренно не выполняются. См. [руководство по
  KeePassXC backups](../../../settings/keepassxc-backup/).

## Общие руководства

- [Firefox](../../../settings/firefox/)
- [Flatpak и Flatseal](../../../settings/flatpak/)
- [Резервные копии KeePassXC в Google Drive](../../../settings/keepassxc-backup/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman и Steam Flatpak](../../../settings/r2modman/)
