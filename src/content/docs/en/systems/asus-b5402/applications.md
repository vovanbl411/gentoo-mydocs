---
title: Applications on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-01"
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
  `2.8.0-snapshot`); the live database is stored in the dedicated
  `~/Documents/KeePassSync/` directory, which must contain
  exactly one top-level regular, non-symlink `*.kdbx`; the live KDBX file has
  mode `0600`. KeePassXC's built-in timestamped backup before saving remains
  enabled; a real save from the new live path and creation of its built-in
  backup were verified. The daily wrapper
  `~/.local/bin/keepassxc-backup-run` under systemd --user checks
  for the single live DB, then creates a verified snapshot under one
  non-blocking flock in `~/Backups/KeePassXC/` (directory mode `0700`, snapshot
  mode `0600`), delivers top-level `*.kdbx` with `rclone copy`, and runs
  `~/.local/bin/keepassxc-backup-rotate --apply` (90 days or older by mtime)
  only after delivery succeeds. Delivery does not delete remote files. If the
  live KDBX count is not exactly one, the workflow stops before snapshot; this
  is a startup conflict gate, not a Syncthing lock. The
  `keepassxc-backup.service` / `keepassxc-backup.timer` run daily at 20:00
  local time with `Persistent=true`; `Linger=no`. The timer was enabled and
  `active (waiting)` at acceptance. Snapshot, service, and controlled
  conflict-gate acceptance passed on 2026-09-29.
- Syncthing `net-p2p/syncthing-2.0.16` runs as a systemd --user service with
  `Linger=no`. It syncs only `~/Documents/KeePassSync/` with Android; the
  Folder ID on both sides is `keepassxc-live`. Android uses Syncthing-Fork and
  KeePassDX with the `Documents/KeePassSync` path. The secure LAN connection
  and normal edits in both directions passed acceptance on 2026-09-30.
  NAT-PMP errors did not prevent sync. Real conflict recovery with a KeePassXC
  merge remains pending.
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` with a dedicated
  OAuth Desktop client and the `drive.file` scope; the app's publishing
  status is *In production*. The existing remote was re-authorized, and
  post-reauth transport validation (list, upload, read, deletefile, and
  confirmation that the temporary object is absent) passed on 2026-09-29.
  The wrapper delivers top-level `*.kdbx` files daily to
  `gdrive:Backups/KeePassXC/` without deleting remote files.
- Thunderbird `157.0` — native Gentoo; runtime acceptance under Niri showed
  Wayland, WebRender, and Mesa `iris` on Intel Iris Xe ADL GT2; the audio
  backend is `pulse-rust` through the PipeWire/Pulse stack. Six IMAP accounts
  are configured (Gmail ×4, Yandex ×1, Mail.ru ×1); sending and receiving
  passed acceptance. Full offline synchronization is enabled. The profile is
  under `~/.config/thunderbird/`; measurements were about 648 MiB for the
  profile and 574 MiB for `ImapMail`. User notifications are enabled only for
  two selected Gmail accounts; the notification and silent-sync test passed.
  The profile has `NTFNTF: Notify on This Folder Not That Folder` 1.3.1
  installed for this.

The entries were moved from the general guides and checked against the system
on 2026-09-22. The KeePassXC and rclone entries were verified separately on
2026-09-29: the OAuth Desktop client works, the app is *In production*, and
the `gdrive:` remote was re-authorized with
`rclone config reconnect gdrive:` (PASS). Post-reauth transport validation
passed. A real KDBX backup was uploaded to Google Drive and downloaded back
byte-identical on 2026-09-28 (`cmp`, SHA-256 — PASS). Local rotation and daily
automation passed acceptance on 2026-09-29: the wrapper created a snapshot
(mode `0600`, current mtime, byte-identical to the live DB), then the journal
confirmed snapshot → delivery → rotation; the local backup count increased
2 → 3 and the remote object count 1 → 3. A controlled second-`*.kdbx` test
confirmed the conflict gate stops the workflow before snapshot, delivery, and
rotation. The timer was enabled and `active (waiting)`; remote delivery does
not delete files. Initial sync and edits Gentoo → Android → Gentoo passed on
2026-09-30; local backup files remained present after moving the live database.
The repeated check recorded no file count. Real conflict recovery remains
pending. The other applications were not re-checked on 2026-09-29.

## Firefox

- profile-sync-daemon is active, using overlayfs mode.
- Current profile sizes (2026-09-22): the live view through the overlay is
  ~653 MiB, and the upper layer in `/run/user/1000/psd/` is ~168 MiB.

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
