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
  `~/.local/bin/keepassxc-backup-rotate`; production acceptance — PASS
  2026-09-29. Ежедневная автоматизация также установлена и принята (PASS):
  wrapper `~/.local/bin/keepassxc-backup-run`, user service и timer
  `keepassxc-backup.service` / `keepassxc-backup.timer`, systemd --user,
  20:00 local time, `Persistent=true`, `Linger=no`. Timer включён и был
  `active (waiting)` при acceptance; прямой wrapper и service прошли,
  failure-path подтвердил пропуск rotation при ошибке доставки. Доставка в
  Google Drive выполняется без удаления на remote.
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` с собственным
  OAuth Desktop client и scope `drive.file`; publishing status приложения —
  *In production*. Remote `gdrive:` повторно авторизован командой
  `rclone config reconnect gdrive:` (PASS); post-reauth transport validation
  (list, upload, read, deletefile, проверка отсутствия временного объекта) —
  PASS 2026-09-29. Wrapper ежедневно доставляет top-level `*.kdbx` в
  `gdrive:Backups/KeePassXC/` без удаления файлов на remote.

Записи перенесены из общих руководств и сверены с системой 2026-09-22.
Записи KeePassXC и rclone проверены отдельно 2026-09-29: OAuth Desktop
client и remote `gdrive:` работают; приложение находится в *In production*,
remote `gdrive:` повторно авторизован командой
`rclone config reconnect gdrive:` (PASS), post-reauth transport validation
— PASS. Реальный backup KDBX доставлен и скачан обратно byte-identical
2026-09-28 (`cmp`, SHA-256 — PASS). Приёмочные проверки local rotation и
daily automation завершились успешно 2026-09-29: прямой wrapper и service
отработали, журнал подтвердил доставку до rotation, а контролируемая ошибка
доставки — пропуск rotation. Timer включён и находился в состоянии
`active (waiting)`; доставка на remote не удаляет файлы. Phone sync остаётся
следующим отдельным этапом. Остальные приложения 2026-09-29 повторно не
проверялись.

## Firefox

- profile-sync-daemon активен, режим overlayfs.
- Текущие размеры профиля (2026-09-22): живой вид через overlay — ~653 MiB,
  upper-слой в `/run/user/1000/psd/` — ~168 MiB.

## Plans (не применены)

- OBS: package policy и настройки порта-стека остаются планом.
- Perplexity: перенос конфигурации в chezmoi остаётся планом.
- KeePassXC backups: следующий отдельный этап — синхронизация с телефоном.
  Доставка в Google Drive идёт без удаления; remote rotation не выполняется.
  См. [руководство по KeePassXC backups](../../../settings/keepassxc-backup/).

## Общие руководства

- [Firefox](../../../settings/firefox/)
- [Flatpak и Flatseal](../../../settings/flatpak/)
- [Резервные копии KeePassXC в Google Drive](../../../settings/keepassxc-backup/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman и Steam Flatpak](../../../settings/r2modman/)
