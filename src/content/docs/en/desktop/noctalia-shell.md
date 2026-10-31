---
title: Noctalia — desktop shell
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Noctalia is a native Wayland desktop shell. This guide covers installing the
Gentoo package, starting it with Umbriel or Niri, managing hand-written TOML
configuration, checking it, and updating the package.

## Installation

The `gui-apps/noctalia` package is available in
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay). Follow the
overlay README to add the repository. The package is keyworded `~amd64`.

File: `/etc/portage/package.accept_keywords/noctalia`

```text
gui-apps/noctalia ~amd64
```

If Portage requests keywords for dependencies, add the entries shown in its
messages. After adding the overlay, sync it and inspect the installation plan:

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose gui-apps/noctalia
```

If the plan looks correct, install the package:

```bash
doas emerge --ask --verbose gui-apps/noctalia
```

## Starting Noctalia

Add Noctalia to the `autostart` array in Umbriel's existing `[general]`
configuration section. Keep any other commands already in the array:

```toml
[general]
autostart = ["noctalia"]
```

In Niri's KDL configuration, you can use:

```kdl
spawn-at-startup "noctalia"
```

Use only one startup method for Noctalia in a graphical session.

## Configuration

The default location for hand-written configuration is
`~/.config/noctalia/`. Noctalia loads every `*.toml` file directly in this
directory, sorts them by name, and merges their settings. A single file is
enough to start: `~/.config/noctalia/config.toml`. Splitting settings across
several files is optional.

Changes saved through the Noctalia interface and runtime actions are written
to `~/.local/state/noctalia/settings.toml`. This file loads after the
hand-written TOML settings and overrides matching values. If a change in
`~/.config/noctalia/*.toml` has no effect, first check the same setting in
`settings.toml`.

These are the standard paths; Noctalia also honors XDG variables and its own
`NOCTALIA_*` overrides.

For a more complex layout, `[include]` can load additional files and
directories. See the [Noctalia documentation](https://docs.noctalia.dev/noctalia/configuration/)
for details.

## Checking the configuration

Validate the configuration:

```bash
noctalia config validate
```

With no arguments, the command checks and merges the hand-written `*.toml`
files, then applies overrides from `settings.toml`. A successful check means
there are no configuration errors. Warnings about outdated or ignored
settings do not fail validation by themselves. After updating Noctalia, use
warnings about legacy keys to bring the relevant hand-written TOML files up to
the current format.

Also check the panel and keyboard shortcuts in the graphical session. To see
the installed CLI version, run:

```bash
noctalia --version
```

Noctalia can provide desktop notifications. The
[notifications guide](../notifications/) covers `libnotify`, the Portage
virtual package, and troubleshooting notifications that do not appear.

## Updating

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose --update gui-apps/noctalia
doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
```

Review the Portage plan before confirming the update. User TOML files are
stored separately from the package.

> **Note**: This guide covers the current Noctalia implementation with TOML
> configuration. Older Quickshell/QML instructions do not apply to it.

## Related material

- [Umbriel](../umbriel/) — starting the shell in the primary session.
- [Niri](../niri/) — configuring the fallback session.
- [Noctalia on ASUS B5402](../../systems/asus-b5402/desktop/noctalia/)
- [Noctalia documentation](https://docs.noctalia.dev/noctalia/configuration/)
- [Noctalia source code](https://github.com/noctalia-dev/noctalia)
