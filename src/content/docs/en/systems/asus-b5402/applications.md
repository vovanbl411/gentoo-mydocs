---
title: Applications on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-29"
verified_on: [asus-b5402]
---

## Current state

- Firefox — native Gentoo: built for Wayland (LLVM 22, PGO, hardware
  acceleration); the profile is managed by profile-sync-daemon.
- Steam and GUI applications — Flatpak (14 applications, remote — flathub);
  permissions are granted through Flatseal with Wayland preferred.
- OBS Studio — Flatpak (`com.obsproject.Studio` 32.2.2, verified 2026-09-22).
- Perplexity — AppImage + user `.desktop`
  (`~/.local/share/applications/perplexity.desktop`); the
  `perplexity-app://` scheme is registered.
- r2modman — AppImage; launches the Flatpak version of Steam through the
  `~/.local/bin/steam.sh` wrapper (`flatpak run com.valvesoftware.Steam "$@"`).
- KeePassXC — native Gentoo (`app-admin/keepassxc`, runtime
  `2.8.0-snapshot`); the built-in backup before saving the database is
  enabled: timestamped `.kdbx` files in `~/Backups/KeePassXC/` (directory
  mode `0700`). Local 90-day rotation is installed as
  `~/.local/bin/keepassxc-backup-rotate`; production acceptance passed on
  2026-09-29. Daily automation is also installed and accepted (PASS): wrapper
  `~/.local/bin/keepassxc-backup-run`, user service and timer
  `keepassxc-backup.service` / `keepassxc-backup.timer`, systemd --user,
  20:00 local time, `Persistent=true`, and `Linger=no`. The timer was enabled
  and `active (waiting)` at acceptance; direct wrapper and service runs passed,
  and the failure-path test confirmed rotation is skipped after delivery
  failure. Delivery to Google Drive does not delete remote files.
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` with a dedicated
  OAuth Desktop client and the `drive.file` scope; the app's publishing
  status is *In production*. The existing remote was re-authorized, and
  post-reauth transport validation (list, upload, read, deletefile, and
  confirmation that the temporary object is absent) passed on 2026-09-29.
  The wrapper delivers top-level `*.kdbx` files daily to
  `gdrive:Backups/KeePassXC/` without deleting remote files.

The entries were moved from the general guides and checked against the system
on 2026-09-22. The KeePassXC and rclone entries were verified separately on
2026-09-29: the OAuth Desktop client works, the app is *In production*, and
the `gdrive:` remote was re-authorized with
`rclone config reconnect gdrive:` (PASS). Post-reauth transport validation
passed. A real KDBX backup was uploaded to Google Drive and downloaded back
byte-identical on 2026-09-28 (`cmp`, SHA-256 — PASS). Local rotation and daily
automation passed acceptance on 2026-09-29: the direct wrapper and service
runs succeeded, and the journal confirmed delivery before rotation. A
controlled delivery-failure test confirmed that rotation is skipped. The
timer was enabled and `active (waiting)`; remote delivery does not delete
files. Phone sync is the next separate stage. The other applications were not
re-checked on 2026-09-29.

## Firefox

- profile-sync-daemon is active, using overlayfs mode.
- Current profile sizes (2026-09-22): the live view through the overlay is
  ~653 MiB, and the upper layer in `/run/user/1000/psd/` is ~168 MiB.

## Plans (not applied)

- OBS: the package policy and portal-stack settings remain planned.
- Perplexity: moving the configuration into chezmoi remains planned.
- KeePassXC backups: the next separate stage is phone sync. Delivery to
  Google Drive does not delete remote files; remote rotation is not performed.
  See the [KeePassXC backup guide](../../../settings/keepassxc-backup/).

## General guides

- [Firefox](../../../settings/firefox/)
- [Flatpak and Flatseal](../../../settings/flatpak/)
- [KeePassXC backups to Google Drive](../../../settings/keepassxc-backup/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman and Steam Flatpak](../../../settings/r2modman/)
