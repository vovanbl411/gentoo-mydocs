---
title: Desktop environment on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

## Desktop

Umbriel is the primary compositor and Noctalia is the shell. Login uses greetd
and the tuigreet text login screen. Niri is kept as a fallback session.

The compositor and `xdg-desktop-portal-umbriel` are installed from
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay).
The full installation procedure, configuration examples and return to Niri
are in the [Umbriel guide](../../../../desktop/umbriel/).

In `/etc/greetd/config.toml`, the login command is:

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd umbriel"
user = "greetd"
```

Noctalia starts from `[general]` in `~/.config/umbriel/core.toml`:

```toml
[general]
autostart = ["noctalia"]
```

This fragment shows the shell startup. When adding programs, extend the
existing array and keep the other commands. In a split configuration,
`core.toml` must be included from the main `config.toml`.

## Portals

Umbriel uses `~/.config/xdg-desktop-portal/umbriel-portals.conf`:

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

The Umbriel backend is selected first, then GTK for the remaining interfaces.
GNOME Keyring handles the Secret portal.
[Backend roles and dialog checks](../../../../desktop/wayland-portals/).

## Numeric keypad on the touchpad

ASUS NumberPad uses `sys-apps/asus-numberpad-driver` from
`asus-numberpad-overlay`. The `ASUE1410:01 04F3:3230` touchpad uses the
`b7402` layout.

[Driver configuration, device access and startup](../../hardware/numberpad/).

## Fingerprint login and GNOME Keyring

Fingerprint login does not give greetd the user's password, so it cannot
unlock GNOME Keyring automatically. On the first access, `gcr-prompter`
displays `Unlock Keyring`; enter the keyring password. There is no need
to change PAM to eliminate this prompt.

## GTK and the Noctalia palette

- `~/.config/gtk-4.0/noctalia.css` contains the Noctalia palette.
  It is imported from `gtk.css` to apply it to GTK4 applications.
- `~/.config/gtk-4.0/settings.ini` sets the dark-theme preference.

[GTK configuration example](../../../../settings/gtk/).

## Niri fallback session

Niri's configuration is kept in `~/.config/niri/`. To log into it, replace
`umbriel` with `niri-session` in the tuigreet command, log out and log in again.
The example and return procedure are in the
[Umbriel guide](../../../../desktop/umbriel/#returning-to-niri).

Niri uses GTK for common dialogs and GNOME for screen capture. Keep
`~/.config/xdg-desktop-portal/niri-portals.conf` with Niri's configuration;
the example is in the [portals guide](../../../../desktop/wayland-portals/#niri).
Umbriel's settings do not replace the fallback session's configuration.

## Polkit: one agent per session

The polkit agent displays a confirmation window for privileged actions.
Two instances cannot serve the same user session. If you see
`An authentication agent already exists for the given subject`, check whether
the agent is started both by desktop autostart and manually from the
compositor configuration.

In Niri's configuration, the manual launch of
`/usr/libexec/polkit-gnome-authentication-agent-1` is commented out in
`~/.config/niri/autostart.kdl`: XDG autostart can launch it independently.
When switching compositors, check the process rather than only a unit name:

```bash
pgrep -af '[p]olkit-gnome-authentication-agent-1'
```

Expect one process for this agent. The name of an automatically generated
systemd unit is not a requirement for it to work. Trigger a confirmation in
an application to check that the window appears.

polkitd messages about missing `/run/polkit-1/rules.d` and
`/usr/local/share/polkit-1/rules.d` do not require a fix by themselves: these
are additional rule directories. Do not create empty directories just to
clean up the log.

## Related material

- [Installing Umbriel](../../../../desktop/umbriel/)
- [Noctalia on the laptop](../noctalia/)
- [Notifications](../../../../desktop/notifications/)
- [Fingerprint login](../../hardware/fingerprint/)
