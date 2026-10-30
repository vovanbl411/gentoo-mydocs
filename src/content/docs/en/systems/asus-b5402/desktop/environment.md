---
title: Desktop environment on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

## Current state

Umbriel is the primary Wayland compositor: it manages windows and desktop
output. Login uses greetd with the tuigreet text login screen, configured to
launch `umbriel`. Umbriel starts the Noctalia shell through `autostart` in
`~/.config/umbriel/core.toml`. Niri remains available as a fallback session.

The compositor `gui-wm/umbriel` and its portal
`gui-libs/xdg-desktop-portal-umbriel` are installed from
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay). Their versions
are selected together: when updating, choose both versions from one row of the
[accepted pairs table](https://github.com/vovanbl411/umbriel-overlay#принятая-пара-и-откат).
The table is sourced from [accepted-pairs.json](https://github.com/vovanbl411/umbriel-overlay/blob/main/automation/accepted-pairs.json).

## Umbriel portals

Portals give applications access to desktop features, such as file selection
or screen capture. Umbriel's configuration prefers its own backend, followed
by GTK; it selects `gnome-keyring` for access to secrets.

File: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

Each portal interface has not been tested separately under Umbriel.

## ASUS NumberPad

The driver enables the numeric keypad on the touchpad. Device
`ASUE1410:01 04F3:3230` uses the `b7402` layout and the package
`sys-apps/asus-numberpad-driver::asus-numberpad-overlay`.

`~/.config/asus-numberpad-driver/service.conf` sets the layout and the
`~/.config/asus-numberpad-driver/` directory for `numberpad_dev`. The user
service `/usr/lib/systemd/user/asus-numberpad-driver.service` reads this file.
Installing the package does not start it automatically. After importing the
Wayland environment into the systemd user manager, start or stop the service:

```bash
systemctl --user start asus-numberpad-driver.service
systemctl --user stop asus-numberpad-driver.service
```

The [overlay README](https://github.com/vovanbl411/asus-numberpad-overlay)
describes environment import and startup configuration. The current session's
automatic startup and shutdown method has not been verified.

The driver reads touchpad and keyboard events through input devices, creates a
virtual keyboard through `/dev/uinput`, and controls the touchpad through
hidraw. If hidraw is unavailable, the I²C fallback exposes the entire bus.
The local rule `/etc/udev/rules.d/99-asus-numberpad-local.rules` assigns an
owner and mode `0600` to this touchpad's hidraw node and `/dev/uinput`;
input-device permissions have not been checked separately. Input access can
expose keystrokes and uinput can inject them, so grant only the necessary
permissions to a trusted user. The overlay README describes device access setup.

## Fingerprint login and GNOME Keyring

When greetd logs in with a fingerprint, it does not pass the user's password
to GNOME Keyring, so the login keyring is not unlocked automatically. At the
first request, `gcr-prompter` displays `Unlock Keyring`; the keyring is
unlocked with a separate password. This behavior is accepted, and the PAM
stack remains unchanged.

## GTK

- `~/.config/gtk-4.0/noctalia.css` — the Noctalia palette; imported into the
  user's GTK4 configuration.
- `~/.config/gtk-4.0/settings.ini` — dark-theme preference.

The contents of these files were not checked again in the 2026-09-23 audit.

## Niri fallback

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
- Fingerprint: Noctalia lockscreen, greetd login, and polkit authentication
  were verified on 2026-09-27. polkit password fallback was checked; greetd
  fallback was not tested separately.
- greetd fingerprint login does not pass the user's password to GNOME Keyring;
  the login keyring is not unlocked automatically.

The session, systemd user targets, portals, and polkit agent were checked
against the live system on 2026-09-23. The GTK theme was not checked again in
this audit.

User units active in the checked session:

- `niri.service`;
- `graphical-session.target`;
- `xdg-desktop-autostart.target`.

### Portals Niri

GTK and GNOME were selected for portals (verified 2026-09-23):

- GTK serves FileChooser, AppChooser, and Settings.
- GNOME (`sys-apps/xdg-desktop-portal-gnome`, over Niri's implemented mutter
  ScreenCast D-Bus API) serves ScreenCast and Screenshot.
- The WLR portal is not installed.

Installed and running in the checked session:

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

## Polkit authentication agent

Exactly one `/usr/libexec/polkit-gnome-authentication-agent-1` process ran in
the checked Niri session (verified 2026-09-23); the duplicate-agent conflict has
been resolved. The goal is exactly one agent per user session.

The exact launch source of the running process is not established by the
available data. The expected project path is system XDG autostart
(`/etc/xdg/autostart/polkit-gnome-authentication-agent-1.desktop`), which Niri
as a systemd session starts through `xdg-desktop-autostart.target`, but this
did not prove the source of that process.

- Manual spawning from the Niri configuration was removed: the line
  `spawn-sh-at-startup "/usr/libexec/polkit-gnome-authentication-agent-1 &"`
  is commented out in `~/.config/niri/autostart.kdl`.
- The `app-polkit-gnome-authentication-agent-1@autostart.service` unit did
  not exist in the checked user-manager session (`systemctl --user status` —
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

## Verification

Umbriel and NumberPad settings and package sources were checked on 2026-10-30.
The installed Umbriel pair was not checked against the accepted pairs table;
user services and polkit under Umbriel were not tested. Niri observations
belong to the stated dates and do not establish Umbriel state.

## General guides

- [Niri](../../../../desktop/niri/)
- [XDG Desktop Portals](../../../../desktop/wayland-portals/)
- [GTK4 and the Noctalia palette](../../../../settings/gtk/)
- [ELAN fingerprint on ASUS B5402](../../hardware/fingerprint/)
