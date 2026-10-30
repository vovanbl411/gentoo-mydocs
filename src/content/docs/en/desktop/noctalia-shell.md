---
title: Noctalia — desktop shell
kind: guide
scope: general
status: current
last_verified: "2026-09-15"
verified_on: [asus-b5402]
---

Noctalia adds a panel, dock, application launcher, notifications, wallpapers,
lock screen and clipboard history to Umbriel or Niri. Settings use TOML;
`noctalia msg` provides command-line control. This guide covers the TOML
implementation; older Quickshell/QML instructions do not apply.

## Installation

The `gui-apps/noctalia` package is available in additional Gentoo repositories.
ASUS B5402 uses [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay).
Follow its README to add the repository.

Sync it and inspect the installation plan:

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose gui-apps/noctalia
```

If using a different repository, substitute its name in the sync command.
Add keyword rules for the package and its dependencies in
`/etc/portage/package.accept_keywords/` as requested by Portage.

After reviewing the plan:

```bash
doas emerge --ask --verbose gui-apps/noctalia
```

## Starting with the desktop

In Umbriel, add Noctalia to the existing `[general]` configuration section:

```toml
[general]
autostart = ["noctalia"]
```

Keep any other array entries. The [Umbriel guide](../umbriel/#configuration-and-noctalia)
shows how to split configuration across files.

In Niri, use the KDL configuration's startup command:

```kdl
spawn-at-startup "noctalia"
```

Choose one startup method per session. If a user service or XDG autostart
already launches Noctalia, do not also start it from the compositor config.

## Where settings live

Noctalia reads two configuration layers:

| Location | Purpose |
|----------|---------|
| `~/.config/noctalia/*.toml` | Settings edited by hand, suitable for keeping in dotfiles |
| `~/.local/state/noctalia/settings.toml` | Changes made through the Noctalia interface |

All TOML files in `~/.config/noctalia/` are merged. Start with `config.toml`;
split settings into additional files when useful.

`settings.toml` loads later and overrides manual settings. If a change in
`config.toml` has no effect, check the corresponding value in `settings.toml`.
Do not delete the whole file for one setting: it can contain other choices
you want to keep.

Before a substantial edit, back up both the configuration and the state file.
Restore both to roll back: an old `config.toml` will not help if the later
file still overrides its setting.

## Checking the result

```bash
noctalia config validate
```

This checks TOML. Fix the reported errors before the next desktop login.
Check the panel and shortcuts in the session itself.

To inspect the installed version and package source:

```bash
noctalia --version
cat /var/db/pkg/gui-apps/noctalia-*/repository
```

Noctalia also displays system notifications. The [notifications guide](../notifications/)
covers libnotify installation, Portage integration and a test message.

## Updating

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose --update gui-apps/noctalia
doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
```

Read the plan before confirming installation. Portage updates the package;
user TOML files stay in the home directory. Release preparation is maintained
in the overlay README.

## Related material

- [Umbriel](../umbriel/) — compositor and shell startup.
- [Niri](../niri/) — fallback session and autostart.
- [Noctalia on ASUS B5402](../../systems/asus-b5402/desktop/noctalia/)
- [Noctalia documentation](https://docs.noctalia.dev/noctalia/configuration/)
- [Migrating a palette from the older implementation](https://docs.noctalia.dev/noctalia/theming/palette/)
