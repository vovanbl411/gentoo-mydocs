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
  `2.8.0-snapshot`); live database хранится в выделенном
  `~/Documents/KeePassSync/`, где ожидается ровно один top-level
  regular non-symlink `*.kdbx`; у live KDBX mode `0600`. Встроенный
  timestamped backup перед KeePassXC save остаётся включён; реальный save из
  нового live-пути и создание встроенной backup-копии проверены. Daily wrapper
  `~/.local/bin/keepassxc-backup-run` под systemd --user проверяет единственную
  live DB, затем под одним non-blocking flock создаёт проверенный snapshot в
  `~/Backups/KeePassXC/` (directory mode `0700`, snapshot mode `0600`),
  доставляет top-level `*.kdbx` через `rclone copy` и только после успеха
  запускает `~/.local/bin/keepassxc-backup-rotate --apply` (90 дней и старше
  по mtime). Delivery проходит без удаления remote-файлов. Если live KDBX не
  ровно одна, workflow останавливается до snapshot; это startup conflict gate,
  а не блокировка Syncthing. Service/timer
  `keepassxc-backup.service` / `keepassxc-backup.timer` работают ежедневно в
  20:00 local time с `Persistent=true`; `Linger=no`. Timer enabled и был
  `active (waiting)` при acceptance. Snapshot, service и controlled
  conflict-gate acceptance прошли 2026-09-29.
- Syncthing `net-p2p/syncthing-2.0.16` запущен как systemd --user service;
  `Linger=no`. Он синхронизирует только `~/Documents/KeePassSync/` с Android,
  Folder ID на обеих сторонах — `keepassxc-live`. На Android используются
  Syncthing-Fork и KeePassDX с путём `Documents/KeePassSync`. Защищённое
  соединение по LAN и обычные изменения в обоих направлениях прошли acceptance
  2026-09-30. NAT-PMP errors не мешали синхронизации. Реальное conflict
  recovery с KeePassXC merge остаётся pending.
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` с собственным
  OAuth Desktop client и scope `drive.file`; publishing status приложения —
  *In production*. Remote `gdrive:` повторно авторизован командой
  `rclone config reconnect gdrive:` (PASS); post-reauth transport validation
  (list, upload, read, deletefile, проверка отсутствия временного объекта) —
  PASS 2026-09-29. Wrapper ежедневно доставляет top-level `*.kdbx` в
  `gdrive:Backups/KeePassXC/` без удаления файлов на remote.
- Thunderbird `157.0` — native Gentoo; runtime acceptance под Niri показал
  Wayland, WebRender и Mesa `iris` на Intel Iris Xe ADL GT2; audio backend —
  `pulse-rust` через PipeWire/Pulse stack. Настроено шесть IMAP-аккаунтов
  (Gmail ×4, Yandex ×1, Mail.ru ×1); отправка и получение прошли acceptance.
  Полная offline synchronization включена. Профиль находится под
  `~/.config/thunderbird/`; измерено около 648 MiB для профиля и 574 MiB для
  `ImapMail`. Notification acceptance 2026-10-07: два выбранных Gmail —
  звук + визуальное уведомление PASS; остальные аккаунты — тихая синхронизация
  без звука и визуального уведомления PASS. Policy задаёт
  `NTFNTF: Notify on This Folder Not That Folder` 1.3.1. Установленный
  `x11-libs/libnotify` нужен проверенному system notification path и оставлен
  explicit world package. Подробнее — [Thunderbird](../../../settings/thunderbird/).

Записи, существовавшие до Thunderbird, перенесены из общих руководств и сверены
с системой 2026-09-22; Thunderbird baseline был проверен 2026-10-01,
а notification path отдельно повторно проверен 2026-10-07.
Записи KeePassXC и rclone проверены отдельно 2026-09-29: OAuth Desktop
client и remote `gdrive:` работают; приложение находится в *In production*,
remote `gdrive:` повторно авторизован командой
`rclone config reconnect gdrive:` (PASS), post-reauth transport validation
— PASS. Реальный backup KDBX доставлен и скачан обратно byte-identical
2026-09-28 (`cmp`, SHA-256 — PASS). Приёмочные проверки local rotation и
daily automation завершились успешно 2026-09-29: wrapper создал snapshot
(mode `0600`, текущий mtime, byte-identical live DB), затем журнал подтвердил
порядок snapshot → delivery → rotation; local backup count вырос 2 → 3,
remote object count — 1 → 3. Controlled второй `*.kdbx` подтвердил, что
conflict gate останавливает workflow до snapshot, delivery и rotation. Timer
включён и находился в состоянии `active (waiting)`; remote delivery не удаляет
файлы. 2026-09-30 initial sync и изменения Gentoo → Android → Gentoo прошли
PASS; локальные backup-файлы после переноса live-базы по-прежнему сохраняются.
Число файлов в повторной проверке не фиксировалось. Реальное conflict recovery
остаётся pending. Остальные приложения 2026-09-29 повторно не проверялись.

## Flatpak: проверка 2026-10-04

Live inventory показал 12 Flatpak applications. Старый pinned EOL runtime
`org.freedesktop.Platform.ffmpeg-full//24.08` снят с pin и удалён из system
installation после подтверждения, что приложения его больше не используют.
Повторная проверка runtimes подтвердила отсутствие `ffmpeg-full//24.08`;
`flatpak update` завершился `Nothing to update`.

2026-10-04 повторно проверялись только Flatpak inventory и runtime maintenance,
без полного повторного аудита приложений. Предыдущие даты проверки остальных
компонентов остаются в записях выше. Процедура — в
[общем Flatpak guide](../../../settings/flatpak/).

## Firefox

- profile-sync-daemon активен, режим overlayfs.
- Текущие размеры профиля (2026-09-22): живой вид через overlay — ~653 MiB,
  upper-слой в `/run/user/1000/psd/` — ~168 MiB.

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
