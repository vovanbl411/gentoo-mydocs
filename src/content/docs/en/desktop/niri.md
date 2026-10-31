---
title: "Niri: a scrollable tiling compositor"
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Niri is a Wayland compositor that arranges windows in a horizontal strip. This
guide covers installation on Gentoo, starting a systemd session, and the main
configuration options. The recorded ASUS B5402 state is in
[the system section](../../systems/asus-b5402/desktop/environment/).

## Installation and launch

Gentoo provides Niri as `gui-wm/niri` in
[GURU](https://github.com/gentoo/guru/tree/master/gui-wm/niri). If the overlay
is not enabled yet, enable and sync it:

```bash
doas eselect repository enable guru
doas emaint sync -r guru
```

For systemd, enable the `dbus` and `systemd` USE flags.

File: `/etc/portage/package.use/niri`

```text
gui-wm/niri dbus systemd
```

For screen sharing, add the `screencast` USE flag to this line. It requires
`dbus` and adds `media-video/pipewire` and
`sys-apps/xdg-desktop-portal-gnome`.

```bash
emerge --pretend --verbose gui-wm/niri::guru
doas emerge --ask --verbose gui-wm/niri::guru
```

On systemd, start Niri with `niri-session`. It prepares the user environment
for D-Bus and systemd, then starts the compositor through `niri.service`. The
unit runs `niri --session` and is tied to `graphical-session.target` and
`xdg-desktop-autostart.target`. When the session exits, `niri-session` clears
the session environment variables. With a normal `niri-session` launch, do not
manually call `dbus-update-activation-environment`.

Example for greetd and tuigreet:

File: `/etc/greetd/config.toml`

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd niri-session"
user = "greetd"
```

## Configuration

The main file is `~/.config/niri/config.kdl`. Niri uses KDL blocks: `input`
for input devices, `output` for displays, `layout` for columns, `window-rule`
for window rules, `binds` for key bindings, and `spawn-at-startup` for starting
programs. See the full
[Niri configuration reference](https://niri-wm.github.io/niri/Configuration:-Introduction.html).

## Autostart

XDG autostart entries run through the normal graphical session integration.
Use one startup method for each component. Enabling the same app through both
XDG autostart and `spawn-at-startup` can start two instances, such as two
polkit agents.

To start the Noctalia shell from Niri, add:

```kdl
spawn-at-startup "noctalia"
```

See the [Noctalia guide](../noctalia-shell/) for its configuration.

## Environment

The `environment {}` block sets variables only for processes started directly
by Niri; it does not replace the session environment prepared by
`niri-session`. Do not set `GDK_BACKEND` globally: it breaks the screencast
portal.

## Portals

Portals require Niri to run as a full graphical session. In the systemd setup
described here, this is done with `niri-session`. GTK provides general portal
interfaces; `xdg-desktop-portal-gnome` is needed for screen sharing. See the
[Wayland portals guide](../wayland-portals/) for details.

## Xwayland

If you need X11 applications, install `gui-apps/xwayland-satellite`. Niri
creates the X11 sockets, sets `DISPLAY`, and starts the satellite on demand. If
it crashes, Niri restarts it. You do not need to export `DISPLAY` or start the
satellite manually.

## Verification

After entering a Niri session, check its environment and unit:

```bash
echo "$XDG_CURRENT_DESKTOP"
systemctl --user is-active niri.service
```

Expected output:

```text
niri
active
```

These commands check an already running Niri session.

## Related material

- [Wayland portals](../wayland-portals/) — backend selection and checks.
- [Noctalia](../noctalia-shell/) — shell installation and configuration.
- [ASUS B5402 desktop environment](../../systems/asus-b5402/desktop/environment/) — recorded system state.
- [Niri systemd integration and autostart](https://niri-wm.github.io/niri/Integrating-niri.html).
- [Niri important software and portals](https://niri-wm.github.io/niri/Important-Software.html).
- [Niri Xwayland](https://niri-wm.github.io/niri/Xwayland.html).
