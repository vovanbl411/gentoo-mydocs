---
title: Noctalia on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Current state

Noctalia is the shell in the primary Umbriel session on the ASUS B5402. It
provides the panel, application menu, notifications, and lock screen. The
`gui-apps/noctalia` package is installed from
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay) with USE
`jemalloc`, which selects an alternative memory allocator. Umbriel starts
Noctalia through `autostart`, and Noctalia owns the
`org.freedesktop.Notifications` D-Bus interface. The
`virtual/notification-daemon` package from `noctalia-overlay` is installed for
Portage integration.

## Startup

The main `~/.config/umbriel/config.toml` file includes `core.toml`. Umbriel
starts Noctalia at session login from that file.

File: `~/.config/umbriel/core.toml`

```toml
[general]
autostart = ["noctalia"]
```

See the [Umbriel guide](../../../../desktop/umbriel/) for more about starting
the session.

## Configuration

Manual settings live in TOML files under `~/.config/noctalia/`. Changes made
through the Noctalia interface are saved to
`~/.local/state/noctalia/settings.toml` and loaded after the manual settings.
A value in `settings.toml` can override the same value in files under
`~/.config/noctalia/`. If an edit has no effect, check the state file for that
setting.

## Notifications

Noctalia handles notifications through `org.freedesktop.Notifications`. The
installed `virtual/notification-daemon` from `noctalia-overlay` lets Portage
use Noctalia as the notification-daemon provider. The
[notifications guide](../../../../desktop/notifications/) covers `libnotify`
setup and troubleshooting notifications that do not appear.

## Verification

Validate the merged configuration:

```bash
noctalia config validate
```

The command should complete without errors.

Check which application serves the notification D-Bus interface:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

The server name in the response should be `noctalia`.

## Related material

- [Installing and configuring Noctalia](../../../../desktop/noctalia-shell/)
- [Desktop notifications](../../../../desktop/notifications/)
- [Starting the shell in Umbriel](../../../../desktop/umbriel/)
- [ASUS B5402 desktop environment](../environment/)
