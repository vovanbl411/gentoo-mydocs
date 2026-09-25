---
title: Desktop environment on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

## Current state

- Desktop: Niri, native Wayland session.
- `XDG_SESSION_TYPE=wayland`.
- `XDG_CURRENT_DESKTOP=niri`.
- Niri version: `niri 26.04 (8ed0da4)`.
- Session: greetd + tuigreet.
- Shell: Noctalia.
- Portals: GTK → FileChooser/AppChooser/Settings; GNOME → ScreenCast/Screenshot.
- WLR portal: not installed.
- GTK theme: Noctalia palette in `~/.config/gtk-4.0/`.
- Polkit agent: exactly one
  `polkit-gnome-authentication-agent-1` process; the duplicate-agent conflict
  has been resolved.

The session, systemd user targets, portals, and polkit agent were checked
against the live system on 2026-09-23. The GTK theme was not checked again in
this audit.

Active user units:

- `niri.service`;
- `graphical-session.target`;
- `xdg-desktop-autostart.target`.

## Portals

GTK and GNOME were selected for portals (verified 2026-09-23):

- GTK serves FileChooser, AppChooser, and Settings.
- GNOME (`sys-apps/xdg-desktop-portal-gnome`, over Niri's implemented mutter
  ScreenCast D-Bus API) serves ScreenCast and Screenshot.
- The WLR portal is not installed.

Installed and running:

- `xdg-desktop-portal-1.20.4-r1`;
- `xdg-desktop-portal-gnome-49.0`;
- `xdg-desktop-portal-gtk-1.15.3`.

File: `~/.config/xdg-desktop-portal/niri-portals.conf`

```ini
[preferred]
default=gtk
org.freedesktop.impl.portal.Screenshot=gnome
org.freedesktop.impl.portal.ScreenCast=gnome
org.freedesktop.impl.portal.FileChooser=gtk
org.freedesktop.impl.portal.AppChooser=gtk
org.freedesktop.impl.portal.Settings=gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

On the ASUS B5402, `gnome-keyring` is selected as the Secret portal backend.
This is a deliberate local override for Niri. The backend's presence and the
configuration entry are confirmed, but a Secret portal runtime call was not
checked separately.

## GTK

- `~/.config/gtk-4.0/noctalia.css` — the Noctalia palette; imported into the
  user's GTK4 configuration.
- `~/.config/gtk-4.0/settings.ini` — dark-theme preference.

The contents of these files were not checked again in the 2026-09-23 audit.

## Polkit authentication agent

Exactly one `/usr/libexec/polkit-gnome-authentication-agent-1` process runs in
the current session (verified 2026-09-23); the duplicate-agent conflict has
been resolved. The goal is exactly one agent per user session.

The exact launch source of the running process is not established by the
available data. The expected project path is system XDG autostart
(`/etc/xdg/autostart/polkit-gnome-authentication-agent-1.desktop`), which Niri
as a systemd session starts through `xdg-desktop-autostart.target`, but this
does not prove the source of the current process.

- Manual spawning from the Niri configuration was removed: the line
  `spawn-sh-at-startup "/usr/libexec/polkit-gnome-authentication-agent-1 &"`
  is commented out in `~/.config/niri/autostart.kdl`.
- The `app-polkit-gnome-authentication-agent-1@autostart.service` unit does
  not exist in the current user-manager session (`systemctl --user status` —
  “could not be found”), so the former verification criterion “the unit becomes
  active” is no longer used and is not canonical.
- polkitd messages (`sys-auth/polkit-126-r3`) about the absence of
  `/run/polkit-1/rules.d` and `/usr/local/share/polkit-1/rules.d` are benign
  startup messages with fully working polkit; empty directories do not need to
  be created just to clean up the journal.

### Investigation notes (2026-09-21/22/23)

- 2026-09-21: the duplicate manual launch was commented out. Reason: upstream
  polkit permits only one authentication agent per subject; the second instance
  exited with the registration error (`An authentication agent already exists for the given subject`).
- 2026-09-22: investigation of the 2026-09-21 22:48 session showed that the
  working agent was spawned not by the manual launch, but by an niri chain: the
  agent lived in the `niri.service` cgroup with its `INVOCATION_ID`, after
  which the autostart unit failed with the same registration error. The owner
  commented out this spawn in the niri configuration on 2026-09-22.
- Runtime verification on 2026-09-23 is complete for “exactly one agent” (see
  above); the status of the XDG-generated unit and the launch source of the
  running process cannot be established from the available data.

Sources: [polkit — polkitbackendinteractiveauthority.c](https://gitlab.freedesktop.org/polkit/polkit/-/blob/master/src/polkitbackend/polkitbackendinteractiveauthority.c),
[Niri wiki — Integrating niri](https://github.com/YaLTeR/niri/wiki/Integrating-niri).

## General guides

- [Niri](../../../../desktop/niri/)
- [XDG Desktop Portals](../../../../desktop/wayland-portals/)
- [GTK4 and the Noctalia palette](../../../../settings/gtk/)
