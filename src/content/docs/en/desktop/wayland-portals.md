---
title: XDG Desktop Portals
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## How portals work

An application sends a request through `xdg-desktop-portal`, which forwards it
to a suitable handler, or backend. A backend is selected for each interface,
such as file selection or screen sharing. In `portals.conf`, `default` sets the
order for interfaces without a specific entry; `org.freedesktop.impl.portal.<Interface>`
selects a backend for one interface.

Values are separated by semicolons and checked in order. For example,
`default=umbriel;gtk` means Umbriel handles interfaces it implements; for other
interfaces, `xdg-desktop-portal` can try GTK if GTK implements them.

## Umbriel

Install the Umbriel portal with the compositor using the
[Umbriel guide](../umbriel/). GTK can handle common dialogs and act as a
fallback handler. The Umbriel portal implements `ScreenCast` and `Screenshot`,
as well as `InputCapture` version 2. It does not handle every portal interface.

For screen sharing, enable the compositor's `screencast` USE flag. The portal's
`picker` USE flag adds a graphical chooser for screens and windows; it is enabled
by default in the current Gentoo ebuild.

File: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

This example matches the current ASUS B5402 configuration. Its Secret portal
provider choice is described below.

## Niri

Niri needs PipeWire and `sys-apps/xdg-desktop-portal-gnome` for screen sharing.
Niri's configuration tries GNOME first, then GTK for interfaces without a
specific backend selection.

Niri ships a configuration with `default=gnome;gtk;`, GTK for Access and
Notification. The example below keeps those settings and adds only a GTK
FileChooser override. This is useful if you do not install Nautilus, which the
GNOME portal uses as its default file chooser.

File: `~/.config/xdg-desktop-portal/niri-portals.conf`

```ini
[preferred]
default=gnome;gtk;
org.freedesktop.impl.portal.Access=gtk;
org.freedesktop.impl.portal.Notification=gtk;
org.freedesktop.impl.portal.FileChooser=gtk;
org.freedesktop.impl.portal.Secret=oo7-portal;gnome-keyring;
```

The `gnome;gtk` order sends ScreenCast to the GNOME portal Niri needs for screen
sharing, with GTK as a fallback. `FileChooser=gtk` changes only file selection.

## Secret portal

The Secret portal lets applications access stored secrets through the selected
handler. Niri's portal configuration lists `oo7-portal` and `gnome-keyring`
for the Secret portal; keep them in upstream order or explicitly select the
installed provider. ASUS B5402 uses GNOME Keyring; this is a system-specific
choice documented on the
[system page](../../systems/asus-b5402/desktop/environment/).

## How configuration is selected

`xdg-desktop-portal` looks up the file using `XDG_CURRENT_DESKTOP`: `umbriel`
selects `umbriel-portals.conf`, and `niri` selects `niri-portals.conf`. If the
variable contains several names separated by `:`, they are checked in order.
You can keep both files if you use both sessions.

Start Niri through `niri-session`; the Umbriel startup path for this system is
documented in the [Umbriel guide](../umbriel/). Portal services need the current
graphical session's `WAYLAND_DISPLAY` and `XDG_CURRENT_DESKTOP` variables.

After changing `portals.conf`, log out and back in so the portal services start
with the new configuration.

## Checking the setup

In a terminal inside the desired session:

```bash
echo "$XDG_CURRENT_DESKTOP"
systemctl --user status xdg-desktop-portal.service
```

The desktop name should match the intended file. The GTK backend may start on
demand, so open the relevant dialog first.

For Umbriel, check its backend:

```bash
systemctl --user status xdg-desktop-portal-umbriel.service
```

For Niri, check the GNOME backend:

```bash
systemctl --user status xdg-desktop-portal-gnome.service
```

Then open FileChooser and try screen sharing from a browser or OBS. Confirm with
the recipient that the selected screen or window is being shared.

## Troubleshooting

### A dialog is empty or screen sharing fails

Compare the user services' environment with the session and check the journal:

```bash
systemctl --user show-environment
journalctl --user -b -u xdg-desktop-portal.service
```

If services received another session's environment or no environment at all,
check how the compositor starts. Only for a non-standard manual startup, you
can import the current values into D-Bus and the systemd user manager:

```bash
dbus-update-activation-environment --systemd \
  WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
```

If the portal is already running with the old environment, restart the main
service:

```bash
systemctl --user restart xdg-desktop-portal.service
```

Restarting interrupts active portal requests. End screen sharing first. A
normal login should not require a manual environment import.

### Notifications

`org.freedesktop.portal.Notification` is a portal interface, while
`org.freedesktop.Notifications` is the ordinary desktop notification service.
Choosing a Notification backend does not start Noctalia as the notification
daemon; see the [notifications guide](../notifications/).

`Settings` controls application settings such as a dark appearance preference,
not audio.

## Related material

- [Umbriel](../umbriel/)
- [Niri](../niri/)
- [ASUS B5402 desktop environment](../../systems/asus-b5402/desktop/environment/)
- [portals.conf](https://flatpak.github.io/xdg-desktop-portal/docs/portals.conf.html)
- [Niri portal configuration](https://github.com/niri-wm/niri/blob/main/resources/niri-portals.conf)
- [Niri: Important Software](https://github.com/niri-wm/niri/wiki/Important-Software)
- [Niri: Screencasting](https://github.com/niri-wm/niri/wiki/Screencasting)
- [XDG Desktop Portal for Umbriel](https://github.com/noctalia-dev/xdg-desktop-portal-umbriel)
