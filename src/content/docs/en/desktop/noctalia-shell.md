---
title: Noctalia v5 for Niri
kind: guide
scope: general
status: current
last_verified: "2026-09-15"
verified_on: [asus-b5402]
---

Noctalia is a native Wayland shell built around Niri: a panel and dock,
launcher, Control Center, notifications, wallpapers, lock screen, OSD and
clipboard history. The v5 series no longer uses Quickshell/QML: the
configuration lives in TOML, and IPC is invoked via `noctalia msg`.

```text
Noctalia       = shell for Niri
Package source = the chosen Gentoo repository
Config         = ~/.config/noctalia/*.toml
GUI overrides  = ~/.local/state/noctalia/settings.toml
```

The verified configuration of the reference ASUS B5402 system is described
separately in [the system entry](../../systems/asus-b5402/desktop/noctalia/).

## Package source

Noctalia is distributed through additional Gentoo repositories. The
repository can be any of them — the workflow is the same:

```text
choose repository → sync it → inspect emerge plan → install/update Noctalia
```

1. Choose a repository with a `gui-apps/noctalia` ebuild (GURU or a
   third-party overlay, for example) and enable it via
   `/etc/portage/repos.conf/`.
2. Sync it:

   ```bash
   doas emaint sync -r <repository-name>
   ```

3. Look at the Portage plan before installing:

   ```bash
   emerge --pretend --verbose gui-apps/noctalia
   ```

4. Install or update the package:

   ```bash
   doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
   ```

`<repository-name>` is the name from the corresponding file in
`/etc/portage/repos.conf/`.

If Portage reports that the package or one of its dependencies is masked
by keyword, add only the requested rules to a separate file inside
`/etc/portage/package.accept_keywords/`. Do not copy the list from another
system without checking the current Portage plan.

For the reference ASUS B5402 a public
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay) is
maintained — a verified example of such a repository. Enabling and
maintaining it is described in the overlay's README; the machine's actual
state is in [the system entry](../../systems/asus-b5402/desktop/noctalia/).

## Configuration model

The configuration has two layers:

1. Hand-written TOML in `~/.config/noctalia/`. All `*.toml` files in this
   directory are merged; `config.toml` fits a base configuration you want
   to keep explicitly.
2. GUI-managed overrides in `~/.local/state/noctalia/settings.toml`. The
   file is loaded later and overrides values from the hand-written TOML.

If a value from `config.toml` does not apply — check `settings.toml` first:
most likely a GUI setting is overriding it.

## Updating

The user's TOML configuration lives in `$HOME` and is untouched by package
updates. Updating is the same steps 2 and 4 from Package source:

```bash
doas emaint sync -r <repository-name>
doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
```

## Verification

```bash
noctalia --version
cat /var/db/pkg/gui-apps/noctalia-*/repository
noctalia config validate
```

The first command prints the installed version, the second the name of the
repository Portage installed the package from. `noctalia config validate`
checks the TOML configuration: it prints per-file warnings and a final
validation line (verified on noctalia 5.1.0).

## Related docs

- [Noctalia v5 on ASUS B5402](../../systems/asus-b5402/desktop/noctalia/) —
  the reference system's actual state.
- [Niri](../niri/) — the compositor the shell is built around.
- [Official Noctalia v5.1.0 release](https://github.com/noctalia-dev/noctalia/releases/tag/v5.1.0)
- [Noctalia v5: installation for Gentoo](https://docs.noctalia.dev/noctalia/getting-started/installation/)
- [Noctalia v5: configuration model and TOML validation](https://docs.noctalia.dev/noctalia/configuration/)
- [Noctalia v5: palettes and migrating the v4 color scheme](https://docs.noctalia.dev/noctalia/theming/palette/)
- [Noctalia v5: source code](https://github.com/noctalia-dev/noctalia)
