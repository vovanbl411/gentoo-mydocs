---
title: Umbriel — installation and startup
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Umbriel manages windows and display output in a Wayland session. Noctalia
adds the panel, application menu, notifications and lock screen. This guide
covers installing them in Gentoo, starting through greetd and returning to Niri.

## Installation

The packages `gui-wm/umbriel` and `gui-libs/xdg-desktop-portal-umbriel` come from
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay).
The portal enables screen sharing from browsers and other applications.

File: `/etc/portage/repos.conf/umbriel-overlay.conf`

```ini
[umbriel-overlay]
location = /var/db/repos/umbriel-overlay
sync-type = git
sync-uri = https://github.com/vovanbl411/umbriel-overlay.git
auto-sync = yes
```

```bash
doas emerge --sync umbriel-overlay
```

Umbriel and its portal backend are installed and rolled back as one accepted
pair. Take both versions from the **Current accepted pair** row in the
[overlay table](https://github.com/vovanbl411/umbriel-overlay/blob/main/README.en.md#accepted-pair-and-rollback).
Use both versions from this row so you do not mix versions from different pairs.

Screen sharing requires Umbriel's `screencast` USE flag. The portal's `picker`
flag provides a dialog for choosing a screen or application. `picker` is
currently enabled by default; keeping the entry explicit records that the
graphical source chooser is wanted.

File: `/etc/portage/package.use/umbriel`

```text
gui-wm/umbriel screencast
gui-libs/xdg-desktop-portal-umbriel picker
```

Both packages are marked with the testing keyword `~amd64`. Allow the exact
versions from the **Current accepted pair** row in `package.accept_keywords`.

File: `/etc/portage/package.accept_keywords/umbriel-overlay`

```text
=gui-wm/umbriel-<Umbriel-version> ~amd64
=gui-libs/xdg-desktop-portal-umbriel-<portal-version> ~amd64
```

Substitute both versions from the **Current accepted pair** row. First verify
that Portage resolves this exact pair from `umbriel-overlay`:

```bash
emerge -pv \
  '=gui-wm/umbriel-<Umbriel-version>' \
  '=gui-libs/xdg-desktop-portal-umbriel-<portal-version>'
```

After reviewing the plan, install the same pair:

```bash
doas emerge --ask \
  '=gui-wm/umbriel-<Umbriel-version>' \
  '=gui-libs/xdg-desktop-portal-umbriel-<portal-version>'
```

To roll back, take both versions for the pair you want to restore from the same
table row, then use those exact atoms in `package.accept_keywords` and the
`emerge` commands.

Install Noctalia separately: [shell installation and configuration](../noctalia-shell/).

## Configuration and Noctalia

The package installs a starting configuration at
`/usr/share/umbriel/config.toml`. Umbriel does not create a user config file.
If you do not have one yet, copy the starting configuration:

```bash
mkdir -p ~/.config/umbriel
cp /usr/share/umbriel/config.toml ~/.config/umbriel/config.toml
```

Do not overwrite an existing file; edit it instead.

To start Noctalia, add `noctalia` to the `autostart` array in `[general]`:

```toml
[general]
autostart = ["noctalia"]
```

Add the command to the existing `autostart` array and do not create a second
`[general]` section: TOML does not allow declaring a table twice. Keep the
other commands in the array and use one Noctalia startup mechanism per session.

A large configuration can be split into files. For example, in
`~/.config/umbriel/config.toml`:

```toml
[include]
files = ["core.toml"]
```

You can then put `[general]` and `autostart` in `core.toml`. Included files
are read in order, and the main `config.toml` is read last, so its values can
override settings from `core.toml`.

Check the configuration before leaving your working session:

```bash
umbriel config validate
```

The command should finish without errors. Most settings take effect when
the file is saved; changing `autostart` requires logging in again.

## Login through greetd and tuigreet

First back up the working greetd configuration. This lets you return to the
previous desktop from a text console if the new session fails to start.

```bash
doas cp -a /etc/greetd/config.toml /etc/greetd/config.toml.before-umbriel
```

In `/etc/greetd/config.toml`, change the command in the existing `[default_session]`:

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd umbriel"
user = "greetd"
```

Keep the other greetd settings. After logging out, the next login should open
Umbriel and start Noctalia. Restarting greetd ends the graphical session:
save your work first.

## Portals and session checks

Installing the compositor does not select a portal backend. Configure it using
the [portals guide](../wayland-portals/#umbriel). Screen sharing requires the
`screencast` USE flag and a configured portal backend; `picker` provides the
graphical screen or application chooser.

In a terminal inside Umbriel:

```bash
echo "$XDG_CURRENT_DESKTOP"
umbriel outputs
umbriel config validate
```

Expect the name `umbriel`, a list of connected displays and no configuration
errors. Then check that Noctalia appears, the file chooser works and
applications can share the screen.

## Returning to Niri

If Niri is installed and its configuration is saved, change greetd's launch
command to return to it:

```toml
command = "tuigreet --time --remember --asterisks --cmd niri-session"
```

Use `niri-session`, not `niri`: this command sets up Niri's environment and
user services. After changing the command, log out of Umbriel
and log in again. If graphical login is unavailable, switch to a text console
and restore the saved greetd copy. See [starting Niri](../niri/) for details.

## Related material

- [ASUS B5402 desktop environment](../../systems/asus-b5402/desktop/environment/)
- [Umbriel configuration](https://docs.noctalia.dev/umbriel/configuration/)
- [Upstream example configuration](https://github.com/noctalia-dev/umbriel/blob/main/examples/config.toml)
