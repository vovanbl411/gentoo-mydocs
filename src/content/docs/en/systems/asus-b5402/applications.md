---
title: Applications on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Current state

- Firefox — native Gentoo: built for Wayland (LLVM 22, PGO, hardware
  acceleration); the profile is managed by profile-sync-daemon.
- Steam and GUI applications — Flatpak (12 applications, remote — flathub);
  permissions are granted through Flatseal with Wayland preferred.
- OBS Studio — Flatpak (`com.obsproject.Studio` 32.2.2, verified 2026-09-22).
- Perplexity — AppImage + user `.desktop`
  (`~/.local/share/applications/perplexity.desktop`); the
  `perplexity-app://` scheme is registered.
- r2modman — AppImage; launches the Flatpak version of Steam through the
  `~/.local/bin/steam.sh` wrapper (`flatpak run com.valvesoftware.Steam "$@"`).
- KeePassXC — native Gentoo (`app-admin/keepassxc`, runtime
  `2.8.0-snapshot`). The live DB is in `~/Documents/KeePassSync/`, with exactly
  one top-level regular, non-symlink `*.kdbx` (mode `0600`). Built-in
  timestamped backups before saving and daily local backups to
  `~/Backups/KeePassXC/` remain active. Google Drive delivery runs daily at
  20:00 local time through `keepassxc-backup.service` /
  `keepassxc-backup.timer` (`Persistent=true`, `Linger=no`); the timer is enabled.
  Backups passed acceptance on 2026-09-29; a real KDBX copy uploaded and
  downloaded on 2026-09-28 was byte-identical (`cmp`, SHA-256 — PASS).
  Normal Android sync passed on 2026-09-30.
  Real conflict recovery / KeePassXC merge remains pending.
  See [backup](../../../settings/keepassxc-backup/) and
  [phone sync](../../../settings/keepassxc-phone-sync/).
- Syncthing `net-p2p/syncthing-2.0.16` runs as a systemd --user service
  (`Linger=no`). It syncs only `~/Documents/KeePassSync/`, Folder ID
  `keepassxc-live`, with Android Syncthing-Fork and KeePassDX at
  `Documents/KeePassSync`. Secure LAN sync and edits in both directions work
  (2026-09-30). Configuration and recovery are in the
  [phone sync guide](../../../settings/keepassxc-phone-sync/).
- rclone (`net-misc/rclone`) delivers KeePassXC backups daily to
  `gdrive:Backups/KeePassXC/` without deleting remote files. The dedicated
  OAuth Desktop client uses `drive.file`; the app is *In production*.
  The remote and transport were verified on 2026-09-29; configuration and
  OAuth lifecycle are in the [backup guide](../../../settings/keepassxc-backup/).
- Thunderbird `157.0` — native Gentoo; Wayland, WebRender and Mesa `iris`
  on Intel Iris Xe ADL GT2 under Niri, `pulse-rust` through PipeWire/Pulse.
  Six IMAP accounts (Gmail ×4, Yandex ×1, Mail.ru ×1); sending and receiving
  work, and full offline sync is enabled. The profile is under `~/.config/thunderbird/`.
  Two selected Gmail accounts use sound + visual notifications; the others
  sync silently. This policy uses `NTFNTF: Notify on This Folder Not That Folder`
  1.3.1. `x11-libs/libnotify` remains an explicit world package for the verified
  notification path. Runtime was checked on 2026-10-01, notifications on
  2026-10-07. Details are in the [Thunderbird guide](../../../settings/thunderbird/).

## Flatpak policy

The inventory has 12 applications (2026-10-04). The unused EOL runtime
`org.freedesktop.Platform.ffmpeg-full//24.08` is absent; `flatpak update`
reported `Nothing to update`. This check covered inventory and runtimes,
without re-checking every application's behavior. Permissions and maintenance
are described in the [Flatpak guide](../../../settings/flatpak/).

## Firefox

- profile-sync-daemon is active, using overlayfs mode.
- Current profile sizes (2026-09-22): the live view through the overlay is
  ~653 MiB, and the upper layer in `/run/user/1000/psd/` is ~168 MiB.

## Verification boundaries

Firefox, OBS, Perplexity and r2modman were checked on 2026-09-22; the dates
for backup, sync, Thunderbird and Flatpak are recorded above. There was no
new live verification during this refactoring. Verification commands and
expected results are in the linked guides.

## Plans (not applied)

- OBS: the package policy and portal-stack settings remain planned.
- Perplexity: moving the configuration into chezmoi remains planned.
- KeePassXC: normal phone sync is accepted; end-to-end conflict recovery and
  KeePassXC merge remain pending. See the
  [phone sync guide](../../../settings/keepassxc-phone-sync/).

## General guides

- [Firefox](../../../settings/firefox/)
- [Flatpak and Flatseal](../../../settings/flatpak/)
- [KeePassXC backups to Google Drive](../../../settings/keepassxc-backup/)
- [KeePassXC phone sync with Android via Syncthing](../../../settings/keepassxc-phone-sync/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman and Steam Flatpak](../../../settings/r2modman/)
- [Thunderbird](../../../settings/thunderbird/)
