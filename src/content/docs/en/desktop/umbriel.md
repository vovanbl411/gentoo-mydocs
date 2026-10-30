---
title: Umbriel — installation and startup
kind: guide
scope: general
status: current
last_verified: null
verified_on: []
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
doas emaint sync -r umbriel-overlay
```

The compositor and portal are developed together. Choose their versions from
one row of the [overlay table](https://github.com/vovanbl411/umbriel-overlay#принятая-пара-и-откат).
For an installation or rollback to exact versions, use the commands with both
package atoms provided there. Do not mix versions from different rows.

Screen capture requires Umbriel's `screencast` flag. The portal's `picker`
flag adds a dialog for selecting the screen or application to share.

File: `/etc/portage/package.use/umbriel`

```text
gui-wm/umbriel screencast
gui-libs/xdg-desktop-portal-umbriel picker
```

Both packages use the testing keyword `~amd64`. Add them to
`package.accept_keywords` if your configuration does not already allow them.

```text
# /etc/portage/package.accept_keywords/umbriel
gui-wm/umbriel ~amd64
gui-libs/xdg-desktop-portal-umbriel ~amd64
```

Inspect the installation plan. Portage should select both packages from
`umbriel-overlay` and compatible versions from the table.

```bash
emerge -pv gui-wm/umbriel gui-libs/xdg-desktop-portal-umbriel
doas emerge --ask gui-wm/umbriel gui-libs/xdg-desktop-portal-umbriel
```

Install Noctalia separately: [shell installation and configuration](../noctalia-shell/).

## Configuration and Noctalia

If you do not yet have a user configuration, copy the package's example:

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

If the section already exists, edit that section. TOML does not allow declaring
one section twice. Keep other commands in the array, and avoid starting Noctalia
both here and through another mechanism.

A large configuration can be split into files. For example, in
`~/.config/umbriel/config.toml`:

```toml
[include]
files = ["core.toml"]
```

You can then put `[general]` and `autostart` in `core.toml`. Umbriel reads
included files in order and the main file last. A value in `config.toml`
can therefore override one from `core.toml`.

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

Configure the Umbriel backend using the [portals guide](../wayland-portals/#umbriel).
This is a separate setting: installing the compositor alone does not determine
which backend `xdg-desktop-portal` selects.

In a terminal inside Umbriel:

```bash
echo "$XDG_CURRENT_DESKTOP"
umbriel outputs
umbriel config validate
```

Expect the name `umbriel`, a list of connected displays and no configuration
errors. Then check Noctalia and [notification delivery](../notifications/),
open a file chooser and try screen sharing in a browser.

## Returning to Niri

You can keep Niri installed with its configuration. To make it greetd's next
session, change only the launch command:

```toml
command = "tuigreet --time --remember --asterisks --cmd niri-session"
```

Use `niri-session`: it sets up Niri's environment and user services. After
changing the command, log out of Umbriel and log in again. If graphical login
is unavailable, switch to a text console and restore the saved greetd file.
See [starting Niri](../niri/) for details.

## Related material

- [ASUS B5402 desktop environment](../../systems/asus-b5402/desktop/environment/)
- [Umbriel configuration](https://docs.noctalia.dev/umbriel/configuration/)
- [Upstream example configuration](https://github.com/noctalia-dev/umbriel/blob/main/examples/config.toml)
