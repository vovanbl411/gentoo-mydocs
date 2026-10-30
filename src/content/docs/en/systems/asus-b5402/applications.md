---
title: Applications on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Applications

- Zed is a code editor, installed as `app-editors/zed` from
  [zed-overlay](https://github.com/vovanbl411/zed-overlay).
- spotatui is a terminal Spotify client, installed as `media-sound/spotatui`
  from [spotatui-overlay](https://github.com/vovanbl411/spotatui-overlay).
  Spotify playback requires Premium. Enabled USE flags are `cover`, `mpris`,
  `visualizer`, `local-files` and `youtube`.
- Firefox is a Gentoo package with Wayland, PGO and hardware acceleration.
  profile-sync-daemon manages its profile using overlayfs.
- Steam is a Flatpak from Flathub. Flatpak application permissions are managed
  through Flatseal, with Wayland preferred.
- ChatGPT Desktop is the system Flatpak `com.openai.ChatGPT`, branch `master`.
  Installation and permissions are described in the
  [ChatGPT Desktop guide](../../../settings/chatgpt-desktop/).
- OBS Studio is the Flatpak `com.obsproject.Studio`.
- Perplexity is an AppImage with the launcher
  `~/.local/share/applications/perplexity.desktop`; the `perplexity-app://`
  scheme is registered for application links.
- r2modman is an AppImage. It launches the Flatpak version of Steam through
  `~/.local/bin/steam.sh`: `flatpak run com.valvesoftware.Steam "$@"`.
- KeePassXC is the Gentoo package `app-admin/keepassxc`. The database is opened
  from local storage; Syncthing syncs it with the phone and rclone delivers
  backups to Google Drive. Details follow below.
- Thunderbird is a Gentoo package with Wayland, WebRender and audio through
  PipeWire/Pulse. Mail and notification settings are described below and in
  the [Thunderbird guide](../../../settings/thunderbird/).

## KeePassXC: database, synchronization and backups

The working database is in `~/Documents/KeePassSync/`. This directory must
contain exactly one `*.kdbx` database: a regular file, not a symbolic link,
with permissions `0600`. The backup script searches only the directory itself,
not subdirectories. If it finds several databases, such as a Syncthing conflict
copy, it stops to avoid backing up an arbitrarily selected file.

Syncthing (`net-p2p/syncthing`) runs as a systemd user service. Folder
`keepassxc-live` syncs only `~/Documents/KeePassSync/` with
`Documents/KeePassSync` on Android, which uses Syncthing-Fork and KeePassDX.
Other backup directories are not synced. If different changes appear on both
devices, follow the copy-preservation and merge steps in the
[phone sync guide](../../../settings/keepassxc-phone-sync/).

KeePassXC creates a timestamped backup before saving. In addition,
`keepassxc-backup.timer` starts `keepassxc-backup.service` daily at 20:00 local
time. The service copies the database to `~/Backups/KeePassXC/`, delivers
backups to `gdrive:Backups/KeePassXC/`, and only after successful delivery
removes local copies aged 90 days or older. If delivery fails, local copies
are kept. Files are not automatically deleted from Google Drive.

The timer uses `Persistent=true`: a missed run is performed when the systemd
user manager becomes active again. With `Linger=no`, there is no separate
background run without a user session. These settings also do not automatically
retry a delivery that has already failed.

rclone (`net-misc/rclone`) uses a dedicated Desktop OAuth application with
scope `drive.file` and status *In production*. Google Drive stores backups;
there is no need to open the working database through a cloud mount. Scripts,
services, recovery and OAuth setup are described in the
[backup guide](../../../settings/keepassxc-backup/).

## Thunderbird

Six IMAP accounts are configured: four Gmail, Yandex and Mail.ru. Full offline
sync is enabled; the profile is in `~/.config/thunderbird/`. Two selected Gmail
accounts display notifications with sound; the others sync without notifications.
The `NTFNTF: Notify on This Folder Not That Folder` extension selects folders.

`x11-libs/libnotify` is installed separately for desktop notifications.
Thunderbird offers this library as an optional feature, so installing the mail
client does not add it automatically.

## Flatpak maintenance

Applications come from Flathub. `org.electronjs.Electron2.BaseApp` is a base
for building an Electron application, not a separate application to launch.
Application updates, removal of unused runtimes and permission settings are
covered in the [Flatpak guide](../../../settings/flatpak/).

## General guides

- [Firefox](../../../settings/firefox/)
- [Flatpak and Flatseal](../../../settings/flatpak/)
- [ChatGPT Desktop via Flatpak](../../../settings/chatgpt-desktop/)
- [KeePassXC backups to Google Drive](../../../settings/keepassxc-backup/)
- [KeePassXC phone sync with Android via Syncthing](../../../settings/keepassxc-phone-sync/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman and Steam Flatpak](../../../settings/r2modman/)
- [Thunderbird](../../../settings/thunderbird/)
