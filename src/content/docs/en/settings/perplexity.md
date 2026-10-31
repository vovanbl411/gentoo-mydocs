---
title: "Perplexity AppImage: desktop integration"
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

This guide covers placing the AppImage, adding a launcher, installing an icon,
and registering the `perplexity-app://` URI scheme. The desktop entry can launch
Perplexity from a Wayland session, but it does not select the application's
graphics backend.
The setup and verification commands require `update-desktop-database`,
`xdg-mime`, and `desktop-file-validate`.

## Install the AppImage

After downloading it, copy the AppImage to a permanent location under a stable
name:

```bash
install -Dm755 "<path-to-downloaded-AppImage>" "$HOME/.local/bin/Perplexity.AppImage"
```

## Desktop entry

File: `$HOME/.local/share/applications/perplexity.desktop`

```ini
[Desktop Entry]
Type=Application
Name=Perplexity
Exec=/home/<user>/.local/bin/Perplexity.AppImage %U
Icon=Perplexity
Terminal=false
MimeType=x-scheme-handler/perplexity-app;
```

Replace `/home/<user>` with the absolute path to the AppImage. `Exec=` is not
run through a shell, so `$HOME` and `~` are not expanded. The template does not
set Electron/Ozone flags; add a specific flag only for a confirmed launch or
backend-selection problem.

## Icon and URI handler

For a PNG, use the hicolor directory that matches the image's actual size:

```bash
install -Dm644 "<path-to-existing-PNG>" \
  "$HOME/.local/share/icons/hicolor/<size>/apps/Perplexity.png"
```

For an SVG, use the `scalable` directory and the `.svg` extension:

```bash
install -Dm644 "<path-to-existing-SVG>" \
  "$HOME/.local/share/icons/hicolor/scalable/apps/Perplexity.svg"
```

In both cases, keep `Icon=Perplexity` without an extension. After creating or
changing the desktop entry, update the MIME cache and register the scheme
handler:

```bash
update-desktop-database "$HOME/.local/share/applications"
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
```

`xdg-mime default` changes the user's association. See
[default applications](../../desktop/default-applications/) for the general
MIME and URI scheme rules.

## Verify

```bash
test -x "$HOME/.local/bin/Perplexity.AppImage"
desktop-file-validate "$HOME/.local/share/applications/perplexity.desktop"
test -f "<path-to-installed-icon>"
xdg-mime query default x-scheme-handler/perplexity-app
```

For the icon check, substitute the installed PNG or SVG path. The handler query
should print `perplexity.desktop`. These commands do not launch the application.
To check it functionally, open Perplexity from the launcher. If you need to
confirm the Wayland backend, inspect the window type using the compositor; a
desktop entry and URI association do not confirm it.

## If the AppImage does not start

If the AppImage explicitly reports missing FUSE or `libfuse.so.2`, check the
runtime dependency that matches the exact message. This guide does not prescribe
a specific FUSE package or slot.

Do not add `--no-sandbox` as a general workaround: this flag disables part of
the Chromium/Electron sandbox.

## Related material

- [Default applications](../../desktop/default-applications/) — MIME types and URI schemes.
- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — the recorded system state.
