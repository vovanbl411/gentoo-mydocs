---
title: Applications on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Current state

Some GUI applications use Flatpak; AppImage is used where local desktop
integration matters.

## Native applications

- **Zed** — `app-editors/zed` from
  [zed-overlay](https://github.com/vovanbl411/zed-overlay), used as the code editor.
- **spotatui** — `media-sound/spotatui` from
  [spotatui-overlay](https://github.com/vovanbl411/spotatui-overlay).
  USE flags `cover`, `local-files`, `mpris`, `visualizer`, and `youtube` are
  enabled.
- **Vicinae** — `gui-apps/vicinae` from
  [vicinae-overlay](https://github.com/vovanbl411/vicinae-overlay).
- **Firefox** — `www-client/firefox`; USE flags `wayland`, `pgo`, and
  `hwaccel` are enabled. The `hwaccel` flag adds hardware-acceleration support
  at build time. `profile-sync-daemon` is configured to use overlayfs for the
  Firefox profile; see the [Firefox guide](../../../settings/firefox/).
- **KeePassXC** — `app-admin/keepassxc`; the working database stays on local
  storage, with sync and backup architecture described below.
- **Thunderbird** — `mail-client/thunderbird`. USE flags `wayland` and
  `pulseaudio` are enabled; system notifications use `x11-libs/libnotify`.
  Settings are covered in the [Thunderbird guide](../../../settings/thunderbird/).

## Flatpak

These applications use the system Flatpak installation. Steam, OBS Studio,
Spotify, and Flatseal come from Flathub; ChatGPT Desktop is installed from a
locally built Flatpak bundle.

- Steam — `com.valvesoftware.Steam`; integration with r2modman is described in
  the [r2modman guide](../../../settings/r2modman/).
- ChatGPT Desktop — `com.openai.ChatGPT`; installation and permissions are
  covered in the [ChatGPT Desktop guide](../../../settings/chatgpt-desktop/).
- OBS Studio — `com.obsproject.Studio`. This system uses the Flatpak build;
  installation options are covered in the [OBS Studio guide](../../../settings/obs-studio/).
- Spotify — `com.spotify.Client`; it is installed alongside native spotatui.
- Flatseal — `com.github.tchx84.Flatseal`, a GUI for viewing and managing
  Flatpak application permissions. General guidance is in the
  [Flatpak guide](../../../settings/flatpak/).

## AppImage

- Perplexity launches through the `.desktop` file
  `~/.local/share/applications/perplexity.desktop`; the `perplexity-app://`
  scheme is registered for application links. See the
  [Perplexity guide](../../../settings/perplexity/).
- r2modman uses a local AppImage. A `~/.local/bin/steam.sh` wrapper is available
  for Steam Flatpak integration and forwards arguments to
  `flatpak run com.valvesoftware.Steam`. See the
  [r2modman and Steam Flatpak guide](../../../settings/r2modman/).

## KeePassXC: sync and backups

The working KeePassXC database stays on local storage. Syncthing syncs it with
Android. A separate backup workflow keeps local copies and sends them to
Google Drive through rclone. Google Drive stores backups only.

The [KeePassXC and Syncthing guide](../../../settings/keepassxc-phone-sync/)
covers sync; the [KeePassXC and rclone guide](../../../settings/keepassxc-backup/)
covers backups.
