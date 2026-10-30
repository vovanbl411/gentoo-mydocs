---
title: Noctalia on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Desktop shell

Noctalia displays the panel, application menu, notifications and lock screen.
It starts with Umbriel from `~/.config/umbriel/core.toml`.
The `gui-apps/noctalia` package is installed from
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay) with USE
`jemalloc`, which selects an alternative memory allocator.

[Installing and updating Noctalia](../../../../desktop/noctalia-shell/).

## Where to change settings

The main configuration is `~/.config/noctalia/config.toml`. Noctalia also
reads the other TOML files in this directory, so settings can be split by topic.

Changes made through Noctalia's interface are saved to
`~/.local/state/noctalia/settings.toml`. This file is loaded later and can
override values from `~/.config/noctalia/`.

If a setting in `config.toml` has no effect, first check its value in
`settings.toml`. Editing the main file again will not help while the later
setting still overrides it.

After editing TOML, check the syntax:

```bash
noctalia config validate
```

The command should finish without errors. If it points to a particular file
and line, fix them before the next desktop login.

## Notifications

Noctalia itself acts as the notification handler. Portage uses
`virtual/notification-daemon` from `noctalia-overlay` to recognize Noctalia
as a suitable program without adding a second handler.

Thunderbird uses the `x11-libs/libnotify` library. It is installed explicitly
because installing Thunderbird does not necessarily add it automatically.

Test message:

```bash
notify-send "Noctalia test" "Notifications work"
```

With Do Not Disturb disabled, a banner should appear. If no message is shown
or Portage proposes X11 dependencies, follow the
[notifications guide](../../../../desktop/notifications/).

## Updating

The overlay tracks stable releases. First sync it and inspect what Portage
proposes:

```bash
doas emaint sync -r noctalia-overlay
emerge -pv gui-apps/noctalia
```

After reviewing the plan:

```bash
doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
```

Add keyword rules to `/etc/portage/package.accept_keywords/` according to
Portage's current message. Do not copy old dependency lists without reviewing
them: they change with the packages.

User settings are in the home directory and are not replaced by package
updates. Before major configuration changes, back up both settings directories.

## Related material

- [Noctalia configuration model](../../../../desktop/noctalia-shell/)
- [Starting the shell in Umbriel](../../../../desktop/umbriel/#configuration-and-noctalia)
- [Desktop environment](../environment/)
