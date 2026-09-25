---
title: "Niri: a scrollable tiling compositor"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Niri is a Wayland compositor that arranges windows in a horizontal strip
instead of a classic grid. The result of this guide is a working
session:

```text
Niri
→ native Wayland session
→ niri-session
→ systemd user session
→ XDG autostart
→ portals / polkit / shell as desktop components
```

The recorded state of the reference ASUS B5402 lives in
[the system section](../../systems/asus-b5402/desktop/environment/).

## Launch

### Installation

On Gentoo, Niri is usually available from overlays (guru, for example)
or a custom ebuild. Screen capture and system dialogs are provided by
portal backends — see [XDG Desktop Portals](../wayland-portals/).

### niri-session

On a systemd system, the primary way to start it is `niri-session`. It:

- starts Niri as the user unit `niri.service`;
- handles session environment integration with the user systemd manager
  and D-Bus on its own: `XDG_SESSION_TYPE=wayland`,
  `XDG_CURRENT_DESKTOP=niri` and the other session variables are created
  and imported automatically;
- brings up `graphical-session.target` and, along with it,
  `xdg-desktop-autostart.target`.

That is why, when starting via `niri-session`, there is no need to set
`XDG_*` variables by hand or to call
`dbus-update-activation-environment`.

### Display manager: greetd + tuigreet

An example `/etc/greetd/config.toml` with tuigreet as the greeter:

```toml
[terminal]
vt = 1

[default_session]
command = "tuigreet --time --remember --asterisks --cmd niri-session"
user = "greetd"
```

It is enough for the greeter to pass `niri-session` as the session
command. Niri also works with other display managers — what matters is
launching `niri-session` rather than the bare `niri` binary if you need
systemd integration.

## Configuration

The configuration file is `~/.config/niri/config.kdl` (KDL format). The
main categories:

- `input` — keyboard, touchpad, gestures, pointer acceleration
  (libinput);
- `outputs` — monitors, scale, position;
- `layout` — column width, gaps, presets;
- `window-rule` — floating windows, decorations, rules for individual
  applications;
- `binds` — keyboard shortcuts;
- `spawn-at-startup` — programs launched at startup (see Autostart).

The full reference is
[Niri wiki: Configuration](https://github.com/YaLTeR/niri/wiki/Configuration:-Overview).
A base `environment {}` block with session variables is not needed:
`niri-session` already sets them.

## Autostart

`niri-session` brings up `graphical-session.target` and, along with it,
`xdg-desktop-autostart.target`. Applications with an XDG autostart entry
(`/etc/xdg/autostart/*.desktop`, `~/.config/autostart/*.desktop`) start
on their own.

Do not duplicate such an application via
`spawn-at-startup`/`spawn-sh-at-startup` — you would get two instances.
The typical example is the polkit authentication agent, of which exactly
one is allowed per user session: a second instance fails to register
(`An authentication agent already exists for the given subject`).

- [Niri wiki — Integrating niri (Autostart)](https://github.com/YaLTeR/niri/wiki/Integrating-niri)
- [Niri wiki — Configuration: Miscellaneous (`spawn-at-startup`)](https://github.com/YaLTeR/niri/wiki/Configuration:-Miscellaneous)

## Optional environment for processes spawned by Niri

`environment {}` sets variables for processes that Niri launches
directly. It is not a mechanism for configuring individual applications,
and these values do not automatically reach the systemd --user
environment.

If a variable is needed by one application only, use a wrapper/launcher
or the corresponding systemd unit.

Setting toolkit backends globally (`GDK_BACKEND=wayland`,
`QT_QPA_PLATFORM=wayland`, `SDL_VIDEODRIVER=wayland`,
`EGL_PLATFORM=wayland`) is unnecessary: in a Wayland session the
toolkits choose Wayland on their own. Upstream Niri warns that a global
`GDK_BACKEND=wayland` breaks the screencast portal.
## Xwayland (optional)

Xwayland is optional. If you need X11 applications, install
`xwayland-satellite >= 0.7`: Niri integrates it automatically. Manually
exporting `$DISPLAY` and manually launching the satellite are not needed
as part of the baseline. See the [Niri wiki](https://github.com/YaLTeR/niri/wiki)
for details.

## Verification

Inside a running session:

```bash
# Сессия представилась как niri
echo "$XDG_CURRENT_DESKTOP"

# Niri и session targets подняты как user-юниты
systemctl --user is-active niri.service \
                     graphical-session.target \
                     xdg-desktop-autostart.target
```

The expected result is `niri` and `active` for each unit. After that you
can check the session components: [portals](../wayland-portals/) and,
if you use it, [Noctalia](../noctalia-shell/).

## Related docs

- [XDG Desktop Portals](../wayland-portals/) — screencast and dialogs.
- [Noctalia v5 for Niri](../noctalia-shell/) — the shell.
- [ASUS B5402 desktop environment](../../systems/asus-b5402/desktop/environment/)
  — the recorded state.
- [Niri wiki](https://github.com/YaLTeR/niri/wiki) — the full reference.
