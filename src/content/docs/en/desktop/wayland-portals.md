---
title: XDG Desktop Portals
kind: guide
scope: general
status: current
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

Portals are a layer between applications and the desktop: screen capture,
screenshots, the file chooser, notifications, appearance settings. The main
question here is which portal backends Niri needs and who is responsible
for what.

```text
xdg-desktop-portal       = frontend applications talk to
xdg-desktop-portal-gtk   = common/fallback desktop portals
xdg-desktop-portal-gnome = Niri screencast path; can also serve screenshots
oo7-portal or gnome-keyring = the Secret portal, if applications need it
```

The stack chosen on the reference ASUS B5402 system is recorded in
[the system section](../../systems/asus-b5402/desktop/environment/).

## Required components

- `sys-apps/xdg-desktop-portal` — the frontend: the D-Bus service
  applications work with; it picks backends based on configuration.
- `sys-apps/xdg-desktop-portal-gtk` — the common/fallback portal backend.
- `sys-apps/xdg-desktop-portal-gnome` — the screencasting backend: Niri
  implements the mutter ScreenCast D-Bus API, and the GNOME backend serves
  that path.
- `oo7-portal` or `gnome-keyring` — the Secret portal for applications
  that need it.

`gui-libs/xdg-desktop-portal-wlr` is not needed for Niri: it is a backend
for compositors built on the wlr protocols (wlr-screencopy), while Niri
uses the mutter-compatible path through the GNOME backend.

## Upstream Niri baseline

Which backend serves which interface is defined in `portals.conf`. Niri
ships its own baseline `niri-portals.conf`:

```ini
[preferred]
default=gnome;gtk;
org.freedesktop.impl.portal.Access=gtk;
org.freedesktop.impl.portal.Notification=gtk;
org.freedesktop.impl.portal.Secret=oo7-portal;gnome-keyring;
```

The individual lines matter: Notification and Secret are separate portal
interfaces, while `Settings` handles desktop/UI settings, the color scheme
for example. `Settings` does not route audio and is not the Notification
portal.

If the upstream baseline with `xdg-desktop-portal-gnome` is used, Nautilus
may be needed for the file chooser. If you do not want to depend on the
GNOME/Nautilus file chooser, you can explicitly route FileChooser to the
GTK backend.

## Local overrides

A local configuration can be simpler than the upstream baseline if the
installed set of backends and the applications you need are covered by it.
The file name is chosen by `XDG_CURRENT_DESKTOP`: for Niri it is `niri`, so
the user file is usually named
`~/.config/xdg-desktop-portal/niri-portals.conf`.

On the ASUS B5402 the following override is acceptable and currently in
use:

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

- `default=gtk` — the fallback for the interfaces not listed above.
- `ScreenCast`/`Screenshot` go through the GNOME backend.
- `Settings` is the desktop settings portal (dark theme, color scheme and
  the like) that applications read; it is neither an audio router nor the
  notifications portal.
- `FileChooser=gtk` is especially fitting if the user does not want to
  depend on the GNOME/Nautilus file chooser.
- The ASUS B5402 already uses `gnome-keyring` as the Secret portal backend.
  `oo7-portal` is a modern alternative; migrating this machine to it as
  part of the current audit is not required.
- Notifications are served by the separate interface
  `org.freedesktop.impl.portal.Notification`.

## Session integration

When started via [`niri-session`](../niri/), nothing needs to be done by
hand: the session environment (`WAYLAND_DISPLAY`, `XDG_CURRENT_DESKTOP` and
the rest) is already imported into the systemd user manager and the D-Bus
activation environment, and the portals started by systemd/D-Bus see the
session.

A manual `dbus-update-activation-environment` is not part of the normal
`niri-session` startup path; it is only needed for a non-standard way of
starting (see Troubleshooting).

## Verification

The checks are read-only; no services need restarting.

```bash
# The session identifies itself as niri — this name selects niri-portals.conf
echo "$XDG_CURRENT_DESKTOP"

# The frontend and backends run as user services
systemctl --user status xdg-desktop-portal.service \
                      xdg-desktop-portal-gtk.service \
                      xdg-desktop-portal-gnome.service
```

A practical screencast check: open the capture source picker in a browser
or OBS — the list should show individual Niri windows.

## Troubleshooting

- Portals do not see the session (an empty screen list, portals crashing)
  when Niri is started in a non-standard way without `niri-session` (for
  example, bare `niri` from a tty): import the environment manually and
  restart the frontend:

  ```bash
  dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
  systemctl --user restart xdg-desktop-portal.service
  ```

- A modified `niri-portals.conf` takes effect after restarting the portals
  or re-logging in.

## Related docs

- [Niri](../niri/) — starting the session.
- [ASUS B5402 desktop environment](../../systems/asus-b5402/desktop/environment/)
  — the recorded state.

## References

- [Niri: `resources/niri-portals.conf`](https://github.com/niri-wm/niri/blob/main/resources/niri-portals.conf) —
  the upstream routing baseline.
- [Niri: Important Software](https://github.com/niri-wm/niri/blob/main/docs/wiki/Important-Software.md) —
  the required portal backends and the note about `FileChooser=gtk`.
- [XDG Desktop Portal: `portals.conf`](https://flatpak.github.io/xdg-desktop-portal/docs/portals.conf.html) —
  choosing the backend for individual portal interfaces.
