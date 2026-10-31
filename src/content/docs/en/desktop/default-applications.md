---
title: Default applications and MIME types (XDG)
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

`xdg-mime query default` shows the current handler; `xdg-mime default` assigns
a new one. Run these commands as your regular user from a graphical session.

## How to query or change a handler

For a MIME type, provide its name. URI schemes use the MIME-like form
`x-scheme-handler/<scheme>`:

```bash
xdg-mime query default <mime-type>
xdg-mime default <desktop-id> <mime-type>
```

Replace the values in angle brackets with a MIME type and desktop ID.
The first form only reads the setting. The second assigns the default handler
for the user session.

```bash
xdg-mime query default x-scheme-handler/https
xdg-mime default firefox.desktop x-scheme-handler/https
```

Before assigning a handler, make sure the app is installed and its desktop
entry declares support for the MIME type or URI scheme.

## Desktop IDs and mimeapps.list

`xdg-mime` takes the ID of a `.desktop` file, not the name of an executable.
For example, `firefox.desktop` is Firefox's desktop ID. `query default`
returns the selected handler's desktop ID.

The `[Default Applications]` group in `mimeapps.list` stores default handler
assignments, mapping MIME types and URI schemes to one or more desktop IDs
separated by semicolons. The usual user-level file is
`$XDG_CONFIG_HOME/mimeapps.list` (`~/.config/mimeapps.list` when the variable
is unset). `xdg-mime default` asks the current desktop environment to change a
default; it does not guarantee that every environment writes to the same file.

Defaults are usually shared between sessions. The specification also allows
desktop-specific files such as `<desktop>-mimeapps.list`, which can provide
different values. The desktop name comes from `XDG_CURRENT_DESKTOP`; a
higher-priority file can override a lower-priority setting.

## Examples

The `query default` commands below are read-only. Each `xdg-mime default`
command changes the setting. These examples show different association types,
not a universal default set; use an installed app that supports the type.

For a regular MIME type, such as PDF:

```bash
xdg-mime query default application/pdf
xdg-mime default firefox.desktop application/pdf
```

For a custom URI scheme, such as Perplexity:

```bash
xdg-mime query default x-scheme-handler/perplexity-app
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
```

The desktop ID and scheme for Perplexity are documented in the
[Perplexity AppImage guide](../../settings/perplexity/).

## Flatpak and portals

Sandboxed apps, including Flatpak apps, may delegate file and URI opening to
the XDG Desktop Portal. Host associations still matter, but the portal may use
the default handler, a previous choice, or show an application chooser when
the calling app requests one. See the [Wayland portals guide](../wayland-portals/).

The `xdg-mime(1)` manual warns that `xdg-mime query default` may differ from
the app that `xdg-open` actually launches. A desktop environment may use its
own opener. If the results differ, check the desktop-specific opener and portal
path.

## Verification

Query the current settings:

```bash
xdg-mime query default x-scheme-handler/https
xdg-mime query default application/pdf
```

After changing a handler, repeat `query default` for the same MIME type or URI
scheme. Then test opening a suitable file or URI.

## Related material

- [Perplexity AppImage](../../settings/perplexity/) — an example URI scheme handler.
- [Wayland portals](../wayland-portals/) — portal backends.
- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — the reference system's applications.
- [MIME Applications specification (freedesktop.org)](https://specifications.freedesktop.org/mime-apps/latest-single/).
- [XDG Desktop Portal: OpenURI](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.OpenURI.html).
