---
title: Applications on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-28"
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
  mode `0700`).
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` (a dedicated
  OAuth Desktop client, scope `drive.file`; the app's publishing status is
  still *Testing*); KeePassXC backups are delivered manually to
  `gdrive:Backups/KeePassXC/` without deletions on the remote.

The entries were moved from the general guides and checked against the system
on 2026-09-22. The KeePassXC and rclone entries were verified separately on
2026-09-28: the OAuth Desktop client works, the `gdrive:` remote works, and
a real KDBX backup was uploaded to Google Drive and downloaded back
byte-identical (`cmp`, SHA-256 — PASS). Remaining live-configuration steps
are to switch the OAuth app from *Testing* to *In production*, reconnect the
authorization (`rclone config reconnect gdrive:`), and repeat the minimal
transport validation: list the remote, upload a test file, read it, and
deletefile. Until then the long-term delivery scheme is not considered
complete. The other applications were not re-checked on 2026-09-28.

## Firefox

- profile-sync-daemon is active, using overlayfs mode.
- Current profile sizes (2026-09-22): the live view through the overlay is
  ~653 MiB, and the upper layer in `/run/user/1000/psd/` is ~168 MiB.

## Plans (not applied)

- OBS: the package policy and portal-stack settings remain planned.
- Perplexity: moving the configuration into chezmoi remains planned.
- KeePassXC backups: completing the scheme requires switching the OAuth app
  from *Testing* to *In production*, reconnecting the authorization, and
  running the minimal transport validation; next are production rotation
  of the local 90-day history, the design and implementation of delivery
  automation, and phone sync; delivery to
  Google Drive goes without deletions — remote rotation/deletion is
  deliberately not performed.

## General guides

- [Firefox](../../../settings/firefox/)
- [Flatpak and Flatseal](../../../settings/flatpak/)
- [KeePassXC backups to Google Drive](../../../settings/keepassxc-backup/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman and Steam Flatpak](../../../settings/r2modman/)
