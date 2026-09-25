---
title: Default applications and MIME types (XDG)
kind: guide
scope: general
status: current
last_verified: "2026-09-14"
verified_on: [asus-b5402]
---

View and change the default application for a MIME type or URI scheme:

```bash
xdg-mime query default <mime-or-scheme>          # current handler
xdg-mime default <desktop-id> <mime-or-scheme>   # assign a handler
```

Example:

```bash
xdg-mime query default x-scheme-handler/https
xdg-mime default firefox.desktop x-scheme-handler/https
```

Associations apply to the user session and do not depend on the Wayland
compositor. Applications, including Flatpak ones, usually honor these XDG
associations when opening external links.

## Desktop IDs and mimeapps.list

The commands operate on the desktop file's ID, for example `firefox.desktop`
or `com.google.Chrome.desktop`. The ID does not have to match the name of
the executable. An association needs an installed desktop file: local ones
usually live in `~/.local/share/applications/`, system ones in
`/usr/share/applications/`.

The result of `xdg-mime default` is stored in the user's `mimeapps.list`,
usually `~/.config/mimeapps.list`. Per the XDG specification this is not
the only possible location: there are also system-wide and desktop-specific
files (for example, `<desktop>-mimeapps.list`). The setting persists across
reboots, but a desktop interface or another application may change it.
If the file is managed through dotfiles, check before adding that the
listed desktop files exist on the target system.

## Examples

Below are examples, not a universal default set: substitute your own
desktop IDs. Which applications are actually installed on the reference
system is recorded in [its entry](../../systems/asus-b5402/applications/).

### HTTP/HTML/PDF (example: Firefox)

```bash
xdg-mime default firefox.desktop x-scheme-handler/http
xdg-mime default firefox.desktop x-scheme-handler/https
xdg-mime default firefox.desktop text/html
xdg-mime default firefox.desktop application/xhtml+xml
xdg-mime default firefox.desktop application/pdf
```

### Images (example: qimgv)

```bash
xdg-mime default qimgv.desktop image/jpeg
xdg-mime default qimgv.desktop image/png
xdg-mime default qimgv.desktop image/gif
xdg-mime default qimgv.desktop image/webp
xdg-mime default qimgv.desktop image/bmp
```

### Audio/video (example: mpv)

```bash
xdg-mime default mpv.desktop audio/mpeg
xdg-mime default mpv.desktop audio/ogg
xdg-mime default mpv.desktop audio/flac
xdg-mime default mpv.desktop video/mp4
xdg-mime default mpv.desktop video/webm
xdg-mime default mpv.desktop video/x-matroska
```

### Custom URI schemes

Schemes like `perplexity-app://`, `tg://` or `steam://` should be assigned
following the documentation of the respective application. The format is
the same:

```bash
xdg-mime default <application>.desktop x-scheme-handler/<scheme>
xdg-mime query default x-scheme-handler/<scheme>
```

See [Perplexity AppImage](../../settings/perplexity/) and
[r2modman](../../settings/r2modman/).

## Verification

The query commands for the main types, collected together:

```bash
xdg-mime query default x-scheme-handler/http
xdg-mime query default x-scheme-handler/https
xdg-mime query default text/html
xdg-mime query default application/pdf
xdg-mime query default image/png
xdg-mime query default video/mp4
```

To replace a handler, repeat the `xdg-mime default` command with a
different desktop ID. Editing `mimeapps.list` by hand is usually
unnecessary.

## Related docs

- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — the
  reference system's actual application set.
