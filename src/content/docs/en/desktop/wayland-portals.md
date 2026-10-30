---
title: XDG Desktop Portals
kind: guide
scope: general
status: current
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

Portals give applications access to desktop features: file selection, screen
sharing, screenshots and appearance settings. The application talks to
`xdg-desktop-portal`, which passes the request to a suitable handler, or backend.
A backend is selected for each interface.

Umbriel and Niri need different screen capture backends. Choose your compositor's
section; GTK can handle common dialogs in both sessions.

## Umbriel

Required packages:

- `sys-apps/xdg-desktop-portal` receives application requests;
- `gui-libs/xdg-desktop-portal-umbriel` integrates with the Umbriel compositor;
- `sys-apps/xdg-desktop-portal-gtk` handles common dialogs and acts as a fallback.

Install the Umbriel portal with the compositor using the
[Umbriel guide](../umbriel/). For screen sharing, enable the compositor's
`screencast` flag and the portal's `picker` flag if you want a graphical
capture-source chooser.

File: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

`default=umbriel;gtk` sets the selection order: Umbriel first, then GTK for
interfaces the former does not provide. The `Secret` line selects GNOME Keyring
for portal secret requests; it requires the installed `gnome-keyring` backend.

## Niri

Niri provides a Mutter-compatible screen capture interface served by
`sys-apps/xdg-desktop-portal-gnome`. Common dialogs use
`sys-apps/xdg-desktop-portal-gtk`.

`gui-libs/xdg-desktop-portal-wlr` is not needed for this setup: its screen
capture protocol differs from Niri's.

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

Here GNOME handles screen capture and screenshots; GTK handles file and
application selection and appearance settings; GNOME Keyring handles Secret.

Niri's supplied configuration uses `gnome;gtk` as the default order. Explicit
`FileChooser=gtk` uses the GTK dialog without depending on the GNOME/Nautilus
file chooser. Niri also allows `oo7-portal` for Secret; you do not need to
switch to it to configure the other portals.

## How configuration is selected

The file name depends on `XDG_CURRENT_DESKTOP`: `umbriel` selects
`umbriel-portals.conf`, and `niri` selects `niri-portals.conf`. You can keep
both files if you use both sessions.

Start Niri through `niri-session` and Umbriel through its normal greetd startup.
Applications and user services must receive the current session's environment,
including `WAYLAND_DISPLAY` and `XDG_CURRENT_DESKTOP`.

After changing `portals.conf`, log out of the desktop and log in again.
This starts the portals with the new configuration and environment.

## Checking the setup

In a terminal inside the desired session:

```bash
echo "$XDG_CURRENT_DESKTOP"
systemctl --user status xdg-desktop-portal.service \
                       xdg-desktop-portal-gtk.service
```

The desktop name should match the selected file. After opening an application
dialog, the frontend and required backends should start without errors. Services
can activate on request, so open the relevant dialog first.

For Umbriel, check its backend:

```bash
systemctl --user status xdg-desktop-portal-umbriel.service
```

For Niri, check the GNOME backend:

```bash
systemctl --user status xdg-desktop-portal-gnome.service
```

Then open the file chooser and try screen sharing from a browser or OBS.
Make sure the recipient can actually see the selected screen or window.

## If dialogs are empty or screen sharing fails

First compare the terminal's environment with the user services' environment:

```bash
systemctl --user show-environment
journalctl --user -b -u xdg-desktop-portal.service
```

If services received another session's environment or no environment at all,
check how the compositor starts. For a non-standard manual startup, you can
pass the current values and restart the frontend:

```bash
dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
systemctl --user restart xdg-desktop-portal.service
```

Restarting interrupts active portal requests; end screen sharing first.
This should not be a daily step for normal login.

`Settings` in the portal configuration handles appearance, such as dark mode.
It does not manage audio. Choosing a Notification backend also does not select
the ordinary notification handler; see [notifications](../notifications/).

## Related material

- [Umbriel](../umbriel/)
- [Niri](../niri/)
- [ASUS B5402 desktop environment](../../systems/asus-b5402/desktop/environment/)
- [portals.conf](https://flatpak.github.io/xdg-desktop-portal/docs/portals.conf.html)
- [Niri portal configuration](https://github.com/niri-wm/niri/blob/main/resources/niri-portals.conf)
