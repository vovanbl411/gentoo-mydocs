---
title: r2modman AppImage with Steam Flatpak
kind: troubleshooting
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

This guide covers one setup: r2modman runs as a host AppImage, while Steam is
installed through Flatpak. The recorded ASUS B5402 state is in
[the system section](../../systems/asus-b5402/applications/).

## Symptom

- r2modman runs as a host AppImage;
- Steam is installed as a Flatpak;
- r2modman needs a host executable that passes launch arguments to Steam Flatpak;
- directly calling internal Steam scripts from the Flatpak data directory is
  not a host-side integration.

The `DISTRIB_RELEASE: unbound variable` error was previously observed when
launching such a script directly. It indicates an incorrect entry point, not a
universal cause of the problem.

## Cause

The r2modman AppImage process runs on the host. To launch through Steam Flatpak,
it needs a host wrapper that accepts launch arguments and passes them to
`flatpak run`.

## Working solution

Create an executable wrapper. The example name `steam` is convenient for lookup
through `PATH`, but is not an architectural requirement: the name may differ if
r2modman is configured with the wrapper's absolute path.

File: `~/.local/bin/steam` (example)

```sh
#!/bin/sh
exec flatpak run com.valvesoftware.Steam "$@"
```

Make the wrapper executable:

```bash
chmod +x ~/.local/bin/steam
```

### PATH and absolute paths

If r2modman looks up the executable by name, the wrapper's directory must be
in the `PATH` of the r2modman process. For the `steam` example, check:

```bash
command -v steam
```

If r2modman uses an absolute path, check that the file exists and is executable:

```bash
test -x /path/to/wrapper
```

The environment of an app launched from a desktop entry may differ from an
interactive shell. Check `PATH` using the same method you use to start r2modman.

### r2modman settings

First check the Steam Flatpak data directory:

```bash
test -d "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"
```

If the directory exists and r2modman asks for a Steam data path, use:

```text
~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

For launching, select the host wrapper: use its absolute path if the setting
accepts a path, or its name if the application looks up executables through
`PATH`. Settings and labels may vary; use their purpose rather than relying on a
specific interface label.

### Steam Flatpak access to profile files

A filesystem permission is needed only if Steam Flatpak must read profile files
or launch scripts stored outside the directories it can already access. If
that is a confirmed problem, grant access only to the required directory. For
example, some r2modman installations store profiles in
`~/.config/r2modmanPlus-local`; this path is not required by every installation.

Before changing permissions, inspect the application's permissions and both
override layers:

```bash
flatpak info --show-permissions com.valvesoftware.Steam
flatpak override --user --show com.valvesoftware.Steam
flatpak override --system --show com.valvesoftware.Steam
```

If Steam is confirmed to need access to this directory, add a per-user
permission:

```bash
flatpak override --user \
  --filesystem="$HOME/.config/r2modmanPlus-local" \
  com.valvesoftware.Steam
```

Do not grant access to all of `$HOME` when one directory is enough.

Do not use an override reset as the first troubleshooting step. If you
intentionally reset per-user overrides, the command removes all such settings
for this app ID, not only the r2modman permission:

```bash
flatpak override --user --reset com.valvesoftware.Steam
```

### Verification

Check each integration layer separately.

Steam installation:

```bash
flatpak info com.valvesoftware.Steam
```

Wrapper: for a `PATH`-based setup, check the wrapper's name; for the `steam`
example:

```bash
command -v steam
```

For an absolute path, check that the file is executable:

```bash
test -x /path/to/wrapper
```

Do not run the wrapper just to verify it: it launches Steam.

Steam data path:

```bash
test -d "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"
```

Permissions and overrides:

```bash
flatpak info --show-permissions com.valvesoftware.Steam
flatpak override --user --show com.valvesoftware.Steam
flatpak override --system --show com.valvesoftware.Steam
```

Perform the functional check manually: select a profile in r2modman, click
`Start modded`, and confirm that the modded game launches.

## Game-specific notes

### Example: Risk of Rain 2 / BepInEx

Some combinations of game and mod loader may need separate Steam launch
parameters. For example:

```text
WINEDLLOVERRIDES="winhttp=n,b" %command%
```

This parameter depends on the particular game, Proton version, and mod loader.
It is not part of the general integration and is not needed for all BepInEx
games.

## Troubleshooting

- The wrapper is not found by name: for a `PATH`-based setup, check
  `command -v <wrapper-name>` and the environment used to launch r2modman.
- The wrapper is configured by absolute path but does not launch: check
  `test -x /path/to/wrapper` and inspect the file. It must pass all arguments
  through `"$@"`.
- Steam starts, but the game is vanilla: check the selected profile, r2modman's
  launch instructions, and Steam Flatpak access to the required profile files.
- An error occurs when launching `steam.sh` directly from the Flatpak data
  directory: use a host wrapper; internal Flatpak scripts are not host entry
  points.

Linux r2modman releases include multiple formats, including AppImage and
Flatpak. This guide covers only **r2modman AppImage + Steam Flatpak**.

## Related docs

- [Flatpak](../flatpak/) — permissions and user overrides.
- [Perplexity AppImage](../perplexity/) — general AppImage desktop integration.
- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — machine state.
- [r2modman releases](https://github.com/ebkr/r2modmanPlus/releases) — Linux artifacts.
