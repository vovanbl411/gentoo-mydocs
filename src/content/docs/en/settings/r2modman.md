---
title: r2modman AppImage with Steam Flatpak
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

This document covers one setup: r2modman runs as a host AppImage, while Steam
is installed through Flatpak. The recorded ASUS B5402 state is in
[the system section](../../systems/asus-b5402/applications/).

## Symptom

- r2modman runs as a host AppImage;
- Steam is installed as a Flatpak;
- r2modman expects a host executable or Steam path;
- directly calling internal Steam scripts from the Flatpak data directory is
  not a valid host-side integration.

The previously observed `DISTRIB_RELEASE: unbound variable` error was a symptom
of directly launching such a script, not a universal cause of the problem.

## Cause

Steam Flatpak does not provide a regular host executable named `steam` for the
r2modman AppImage to call. The Flatpak data directory contains Steam files, but
does not replace an entry point in the host environment. A wrapper is needed
to accept arguments from r2modman and pass them to `flatpak run`.

## Working solution

File: `~/.local/bin/steam`

```sh
#!/bin/sh
exec flatpak run com.valvesoftware.Steam "$@"
```

Make the wrapper executable:

```bash
chmod +x ~/.local/bin/steam
```

### PATH

Check that `~/.local/bin` is in `PATH` and that the wrapper is found:

```bash
command -v steam
```

The expected path is `/home/<username>/.local/bin/steam`. For fish, add the
directory like this; this example applies to fish only and is not a universal
shell configuration:

```bash
fish_add_path ~/.local/bin
```

### r2modman settings

First check the Steam Flatpak data directory:

```bash
test -d ~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

If the directory exists, set it as the Steam data path:

```text
~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

If the current r2modman version lets you set a Steam command, use:

```text
steam
```

or the absolute path:

```text
/home/<username>/.local/bin/steam
```

The name and location of this UI field may vary between r2modman versions.

### Flatpak filesystem access

If r2modman stores profile or mod data in `~/.config/r2modmanPlus-local` and
Steam cannot read the required launch scripts or files, grant access to this
directory only:

```bash
flatpak override --user \
  --filesystem="$HOME/.config/r2modmanPlus-local" \
  com.valvesoftware.Steam
```

Access to all of `$HOME` is not needed. Before resetting anything, inspect the
current permissions:

```bash
flatpak info --show-permissions com.valvesoftware.Steam
```

Reset all user overrides for Steam with:

```bash
flatpak override --user --reset com.valvesoftware.Steam
```

`--reset` removes all user overrides for this app ID, not only the permission
for r2modman.

## Verification

Check the Steam installation, wrapper, and data path separately:

```bash
flatpak info com.valvesoftware.Steam
command -v steam
test -d ~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

The main functional check is to select a profile in r2modman, click
`Start modded`, and confirm that the modded game launches.

Check the Steam URI handler separately with:

```bash
xdg-open steam://rungameid/<appid>
```

This command checks the URI handler, but not the wrapper or launching a game
from r2modman.

## Game-specific notes

### Example: Risk of Rain 2 / BepInEx

Some combinations of a game and mod loader may need separate Steam launch
parameters. For example:

```text
WINEDLLOVERRIDES="winhttp=n,b" %command%
```

Do not add this parameter as part of the general r2modman/Steam Flatpak
integration: it depends on the particular game, Proton version, and mod loader,
and is not needed for all BepInEx games.

## Troubleshooting

- `command -v steam` prints nothing: add `~/.local/bin` to the current shell's
  `PATH` and restart r2modman from the same user environment.
- Steam starts, but the game is vanilla: check the selected profile, the
  r2modman launch instructions, and Steam Flatpak access to the required
  profile files.
- An error occurs when launching `steam.sh` directly from the Flatpak data
  directory: return to the host wrapper; internal Flatpak scripts are not host
  entry points.

Current r2modman releases for Linux are available as AppImage and Flatpak. This
document covers specifically **r2modman AppImage + Steam Flatpak**; the wrapper
is not presented as the best option for other installation models.

## Related docs

- [Flatpak](../flatpak/) — permissions and user overrides.
- [Perplexity AppImage](../perplexity/) — general AppImage desktop integration.
- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — the verified machine state.
- [r2modman releases](https://github.com/ebkr/r2modmanPlus/releases) — current Linux artifacts.
