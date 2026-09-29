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
  `~/.local/bin/keepassxc-backup-rotate`; production destructive acceptance
  passed on 2026-09-29. The script defaults to dry-run; deletion requires
  the explicit `--apply` argument, and it is run manually for now.
- rclone (`net-misc/rclone`) — Google Drive remote `gdrive:` with a dedicated
  OAuth Desktop client and the `drive.file` scope; the app's publishing
  status is *In production*. The existing remote was re-authorized, and
  post-reauth transport validation (list, upload, read, deletefile, and
  confirmation that the temporary object is absent) passed on 2026-09-29.
  KeePassXC backups are delivered manually to `gdrive:Backups/KeePassXC/`
  without deletions on the remote.

The entries were moved from the general guides and checked against the system
on 2026-09-22. The KeePassXC and rclone entries were verified separately on
2026-09-29: the OAuth Desktop client works, the app is *In production*, and
the `gdrive:` remote was re-authorized with
`rclone config reconnect gdrive:` (PASS). Post-reauth transport validation
passed. A real KDBX backup was uploaded to Google Drive and downloaded back
byte-identical on 2026-09-28 (`cmp`, SHA-256 — PASS). Production acceptance
of local rotation passed on 2026-09-29: the default dry-run preserved the
candidate, and `--apply` deleted only the expired test KDBX; the non-KDBX
control and real KDBX remained, and the real KDBX SHA-256 matched before and
after. Rotation is run manually; there is no schedule. The other applications
were not re-checked on 2026-09-29.

## Firefox

- profile-sync-daemon is active, using overlayfs mode.
- Current profile sizes (2026-09-22): the live view through the overlay is
  ~653 MiB, and the upper layer in `/run/user/1000/psd/` is ~168 MiB.

## Plans (not applied)

- OBS: the package policy and portal-stack settings remain planned.
- Perplexity: moving the configuration into chezmoi remains planned.
- KeePassXC backups: the next stage is design and implementation of
  automation for invoking local rotation and delivering backups; no scheduler
  has been selected. Phone sync follows. Delivery to Google Drive goes
  without deletions — remote rotation/deletion is deliberately not
  performed. See the [KeePassXC backup
  guide](../../../settings/keepassxc-backup/).

## General guides

- [Firefox](../../../settings/firefox/)
- [Flatpak and Flatseal](../../../settings/flatpak/)
- [KeePassXC backups to Google Drive](../../../settings/keepassxc-backup/)
- [OBS Studio](../../../settings/obs-studio/)
- [Perplexity AppImage](../../../settings/perplexity/)
- [r2modman and Steam Flatpak](../../../settings/r2modman/)
