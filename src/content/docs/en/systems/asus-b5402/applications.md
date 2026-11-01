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
- **Firefox** — `www-client/firefox`; current package policy and
  `profile-sync-daemon` state are described below. See the [Firefox
  guide](../../../settings/firefox/) for general setup.
- **KeePassXC** — `app-admin/keepassxc`; the working database stays on local
  storage, with sync and backup architecture described below.
- **Thunderbird** — `mail-client/thunderbird`; current state is described below.

### Firefox

- The build uses Clang (`clang`) and the native Wayland backend (`wayland`);
  the X11 backend is disabled (`-X`). The ebuild requires at least one backend:
  `X` or `wayland`.
- PGO (`pgo`) is enabled, along with the `jumbo-build` required by the ebuild.
- `hwaccel` installs Gentoo preferences that force-enable hardware-accelerated
  rendering. Check the actual graphics state separately in Firefox under **Help →
  Troubleshooting Information** (`about:support`).
- `pulseaudio` selects Firefox's audio backend through `libpulse`/`apulse`;
  `system-pipewire` uses the system PipeWire library for WebRTC and screencast,
  but does not select ordinary audio output.
- `-telemetry` disables Mozilla build/data-reporting options and installs
  Gentoo telemetry preferences; it does not guarantee the absence of all
  network requests. `wasm-sandbox` is enabled.
- Heavy Firefox builds receive `p-cores ssd` through
  `/etc/portage/package.env/10-performance`. See the [Toolchain
  section](../system/boot-and-portage/#toolchain) for these package environments.
- `profile-sync-daemon` is installed. Firefox is listed in `BROWSERS`, with
  overlayfs and sync on suspend enabled. The `psd.service` user unit is enabled.

### Thunderbird

- The active profile is in `~/.config/thunderbird`. It has six IMAP accounts:
  four Gmail, one Yandex, and one Mail.ru.
- The current Portage plan selects `wayland` and `pulseaudio`; `X`, `hwaccel`,
  and `system-pipewire` are disabled. `-hwaccel` does not identify the runtime
  renderer; `pulseaudio` selects the libpulse audio backend, while
  `system-pipewire` applies to WebRTC and screencasting.
- The heavy build uses `p-cores ssd` through
  `/etc/portage/package.env/10-performance`. See the [Toolchain section](../system/boot-and-portage/#toolchain)
  and [build cache details](../system/boot-and-portage/#memory-and-build-caches)
  for package environments and `ssd`.
- Thunderbird's `Place a copy in` option is disabled for the four Gmail
  accounts. Gmail stores messages sent through SMTP on the server; this setting
  helps avoid duplicate Sent messages.
- `x11-libs/libnotify` is installed. The Gentoo Thunderbird ebuild offers it as
  an optional feature for desktop notifications, not a mandatory dependency.
  The active profile also has the `NTFNTF: Notify on This Folder Not That Folder`
  extension installed for selective folder notifications.

Current package choices and general setup guidance are in the
[Thunderbird guide](../../../settings/thunderbird/).

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

The working database stays in the local `~/Documents/KeePassSync/` directory
and syncs with Android through Syncthing. Google Drive is a separate backup
destination, not a live filesystem.

### ASUS B5402 backup state

| Layer | Current setting |
|-------|-----------------|
| Live directory | `~/Documents/KeePassSync/`, mode `0700` |
| Local copies | `~/Backups/KeePassXC/`, mode `0700` |
| KeePassXC save backup | Backup-before-save is enabled; timestamped copies go to the local backup directory using `{DB_FILENAME}` and `{TIME:<format>}` |
| Wrapper | `~/.local/bin/keepassxc-backup-run`, mode `0700` |
| Rotation script | `~/.local/bin/keepassxc-backup-rotate`, mode `0700` |
| rclone destination | `gdrive:Backups/KeePassXC/`; the remote uses the `drive` backend, `drive.file` scope, and a custom OAuth client |
| rclone config | `~/.config/rclone/rclone.conf`, mode `0600`; credentials and tokens are not included in the documentation |

The wrapper accepts exactly one top-level regular, non-symlink `*.kdbx` in the
live directory. Zero or multiple files stop the run before a snapshot is made.
This is a startup conflict gate; it does not resolve simultaneous edits or
block Syncthing.

Before the snapshot, the wrapper takes a non-blocking `flock` on
`$XDG_RUNTIME_DIR/keepassxc-backup.lock` and holds it through rotation. The
snapshot is named
`keepassxc-snapshot-YYYY-MM-DD_HH-MM-SS.XXXXXX.kdbx`, has mode `0600`, and is
compared with the live database byte for byte using `cmp`.

After verifying the snapshot, `rclone copy` delivers top-level regular
`*.kdbx` files from `~/Backups/KeePassXC/` to `gdrive:Backups/KeePassXC/`.
`copy` does not delete remote files that are absent from the source; the routine
workflow does not rotate or delete remote backups. Local rotation runs with
`--apply` only after delivery succeeds.

Rotation considers top-level regular `*.kdbx` files in the local backup
directory and removes files aged 90 days or more by mtime. Running it manually
without arguments performs a dry run; deletion requires `--apply`.

`keepassxc-backup.service` is a user `Type=oneshot` unit;
`keepassxc-backup.timer` is enabled and active. It runs daily at 20:00 local
time with `Persistent=true`. `Linger=no`: the user manager does not remain
active after the user's sessions end. This is the system's current setting,
not a general recommendation.

The [KeePassXC and rclone guide](../../../settings/keepassxc-backup/) describes
the reproducible workflow. Syncthing settings and conflict/merge recovery
status are in the [KeePassXC sync guide](../../../settings/keepassxc-phone-sync/);
recovery after simultaneous edits remains PENDING.
