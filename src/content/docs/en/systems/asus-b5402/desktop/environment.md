---
title: Desktop environment on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Current state

The desktop on ASUS B5402 runs in a Wayland Umbriel session
(`XDG_CURRENT_DESKTOP=umbriel`). Noctalia is the shell. Login uses greetd and
tuigreet. Niri configuration is retained as a fallback path.

## Session startup

File: `/etc/greetd/config.toml`

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd umbriel"
user = "greetd"
```

The main `~/.config/umbriel/config.toml` includes `core.toml`, where Umbriel
starts Noctalia through `autostart`:

```toml
[general]
autostart = ["noctalia"]
```

Noctalia starts only through Umbriel's `autostart`. Umbriel and its portal
backend are installed from
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay); Noctalia is
installed from [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay).

## Portals and GNOME Keyring

File: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

The Umbriel backend is selected first. GTK is used as the fallback backend for
other interfaces. Secret portal requests go to GNOME Keyring.

When fingerprint authentication succeeds, PAM does not request the account
password. greetd therefore has no password to unlock GNOME Keyring
automatically; the keyring may prompt for its password when an application
requests a secret.

## Desktop integrations

- ASUS NumberPad is configured separately and started manually in the Umbriel
  session.
- `~/.config/gtk-4.0/gtk.css` imports the Noctalia palette from `noctalia.css`;
  `settings.ini` sets the dark-theme preference.

## Niri fallback session

The `gui-wm/niri` package is installed. The `~/.config/niri/` configuration
and `~/.config/xdg-desktop-portal/niri-portals.conf` are retained as a fallback
path. The Niri launch has not been tested separately with this configuration.

## Polkit

The Umbriel session uses `polkit-gnome-authentication-agent-1`, launched from
the system XDG Autostart entry
`/etc/xdg/autostart/polkit-gnome-authentication-agent-1.desktop`. The Umbriel
configuration does not launch a second agent; the manual launch in the Niri
configuration is commented out.

## Related material

- [Umbriel guide](../../../../desktop/umbriel/)
- [Noctalia shell](../../../../desktop/noctalia-shell/)
- [Wayland portals](../../../../desktop/wayland-portals/)
- [Noctalia on ASUS B5402](../noctalia/)
- [NumberPad setup](../../hardware/numberpad/)
- [Fingerprint login](../../hardware/fingerprint/)
- [GTK configuration](../../../../settings/gtk/)
