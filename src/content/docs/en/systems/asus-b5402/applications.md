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
  OAuth Desktop client, scope `drive.file`); KeePassXC backups are
  delivered manually to `gdrive:Backups/KeePassXC/`.

The entries were moved from the general guides and checked against the system
on 2026-09-22. The KeePassXC and rclone entries were verified separately on
2026-09-28: a real KDBX backup was uploaded to Google Drive and downloaded
back byte-identical (`cmp`, SHA-256 — PASS). The other applications were not
re-checked on 2026-09-28.

## Firefox

- profile-sync-daemon is active, using overlayfs mode.
- Current profile sizes (2026-09-22): the live view through the overlay is
  ~653 MiB, and the upper layer in `/run/user/1000/psd/` is ~168 MiB.

## Plans (not applied)

- OBS: the package policy and portal-stack settings remain planned.
- Perplexity: moving the configuration into chezmoi remains planned.
- KeePassXC backups: production rotation of the local 90-day history,
  delivery automation, and phone sync are not implemented; Google Drive is
  used as an append-only destination.

## General guides

- [Firefox](../../../settings/firefox/)
- [Flatpak and Flatseal](../../../settings/flatpak/)
- [KeePassXC backups to Google Drive](../../../settings/keepassxc-backup/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman and Steam Flatpak](../../../settings/r2modman/)
