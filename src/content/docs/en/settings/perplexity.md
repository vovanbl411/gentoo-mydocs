---
title: Perplexity AppImage on a Wayland desktop
kind: guide
scope: general
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

The Perplexity AppImage can be integrated into a Wayland desktop using a stable
path, a desktop entry, an icon, and a URI handler:

```text
AppImage
→ ~/.local/bin/
→ desktop entry
→ Wayland launch
→ perplexity-app:// handler
```

The recorded ASUS B5402 configuration is in
[applications.md](../../systems/asus-b5402/applications/).

## Prerequisites

You need the downloaded AppImage, `dev-util/desktop-file-utils` for
`desktop-file-validate` and `update-desktop-database`, and `xdg-utils` to
register `perplexity-app://`. FUSE2 is needed only by a regular Type-2 AppImage
that reports it requires FUSE or `libfuse.so.2`.

```bash
command -v fusermount
```

## Install AppImage

Use a stable target name so updates do not require changing `Exec=`:

```bash
mv "$HOME/Downloads/<downloaded-Perplexity-AppImage>" "$HOME/.local/bin/Perplexity.AppImage"
chmod +x "$HOME/.local/bin/Perplexity.AppImage"
```

## Desktop entry

File: `~/.local/share/applications/perplexity.desktop`

```ini
[Desktop Entry]
Name=Perplexity
Comment=AI-powered search and chat
Exec=env ELECTRON_OZONE_PLATFORM_HINT=wayland /home/<username>/.local/bin/Perplexity.AppImage --ozone-platform=wayland %U
Terminal=false
Type=Application
Icon=Perplexity
MimeType=x-scheme-handler/perplexity-app;
Categories=Network;Chat;
TryExec=/home/<username>/.local/bin/Perplexity.AppImage
```

Replace `/home/<username>` with your absolute path: a desktop entry does not
expand `$HOME` like a shell. `ELECTRON_OZONE_PLATFORM_HINT=wayland` and
`--ozone-platform=wayland` select the modern Wayland path for Electron.

`--no-sandbox` is not required by AppImage and should not be part of the
baseline: it weakens the Electron sandbox. If a particular AppImage does not
start because of the sandbox, first check the exact error and whether
unprivileged user namespaces are supported. Only then consider a separate
workaround and its consequences.

Add fields such as `StartupWMClass` and `X-AppImage-Version` only when they
actually exist in the AppImage's internal desktop entry or are needed by this
application; they are not general requirements.

## Icon

First extract the AppImage and check which icons it actually contains:

```bash
workdir=$(mktemp -d)
cd "$workdir"
"$HOME/.local/bin/Perplexity.AppImage" --appimage-extract
find squashfs-root -type f \( -iname '*.png' -o -iname '*.svg' \) | sort
```

Copy an existing suitable icon to a directory for the matching size, for
example:

```bash
mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"
cp "<path-to-existing-icon>" "$HOME/.local/share/icons/hicolor/256x256/apps/Perplexity.png"
```

Do not assume the AppImage contains every icon size. If needed, update the icon
cache after copying:

```bash
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor/"
```

## URI handler

Update the desktop database and set the handler:

```bash
update-desktop-database ~/.local/share/applications/
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
xdg-mime query default x-scheme-handler/perplexity-app
```

The last command should print `perplexity.desktop`. General rules for MIME and
URI schemes are described in
[default applications](../../desktop/default-applications/).

## Verification

Check all of the following:

- `~/.local/bin/Perplexity.AppImage` exists and is executable;
- the desktop entry passes validation and is visible to the launcher;
- the icon resolves in the menu;
- `gtk-launch perplexity.desktop` starts the application;
- `xdg-mime query default x-scheme-handler/perplexity-app` returns `perplexity.desktop`;
- the application actually uses the Wayland backend.

```bash
desktop-file-validate ~/.local/share/applications/perplexity.desktop
gtk-launch perplexity.desktop
xdg-mime query default x-scheme-handler/perplexity-app
```

Use `WAYLAND_DEBUG=1` for further diagnostics if needed, but it is not the only
way to confirm the backend: application information or the compositor's view
of its window can also help.

## Troubleshooting

### FUSE not found

If a regular Type-2 AppImage reports that it requires FUSE or `libfuse.so.2`,
install the FUSE2 slot:

```bash
doas emerge --ask sys-fs/fuse:0
```

`--appimage-extract` remains a fallback for a particular AppImage; extraction
is not the preferred installation method.

### Wayland launch fails

First check the application output and the current Electron/Ozone flags. Add
Chromium flags only for a confirmed version and symptom, not as a historical
baseline. Do not add `--no-sandbox` to the general desktop entry.

### Icon or URI handler is missing

Check the path to the icon you actually extracted and update the icon cache
again. For the URI handler, run:

```bash
xdg-mime query default x-scheme-handler/perplexity-app
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
```

## Related docs

- [Flatpak](../flatpak/) — another way to install GUI applications.
- [r2modman](../r2modman/) — an AppImage integrated with Steam Flatpak.
- [Niri](../../desktop/niri/) — the Wayland compositor.
- [Default applications](../../desktop/default-applications/) — MIME associations and URI schemes through XDG.
