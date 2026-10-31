---
title: "Flatpak: applications, permissions, and maintenance"
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: []
---

Flatpak installs and runs sandboxed applications from configured remotes, local
sources, or bundles. Flathub is commonly used for public desktop applications.
An application's access to resources depends on the permissions in its
installed metadata, local overrides, and portals when the application supports
them.

## Installations and remotes

Flatpak supports system installations, per-user installations, and additional
named system installations. A system installation is available to all users on
the machine; a user installation is available only to the current user. This
guide covers the first two in detail.

Most management commands without a scope use the default system installation;
`--user` selects the per-user installation. However, `flatpak info` and
`flatpak list` query both standard installations without a scope, `flatpak update`
updates both, and `flatpak uninstall` searches both for a ref. Specify
the scope when you need to select one installation. Use
`--installation=<name>` for a named system installation.

A remote is a source for applications and runtimes. Flathub is commonly used
for public desktop applications, but Flatpak can also install refs from other
configured remotes and local sources or bundles. Choose the remote scope based
on where you plan to install applications; there is no need to add Flathub to
both installations unless you need it in both.

User remote:

```bash
flatpak remote-add --user --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

System remote:

```bash
flatpak remote-add --system --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

Install and inspect an application in the same scope as its remote:

```bash
# User installation
flatpak install --user flathub <app-id>
flatpak info --user <app-id>

# System installation
flatpak install --system flathub <app-id>
flatpak info --system <app-id>
```

Do not remove a remote only because no applications from it are currently
visible. Inspect its refs and confirm it is no longer needed before removing
it.

## Permissions and portals

An application's effective access is determined by several parts:

| Source | What it defines |
|--------|-----------------|
| Manifest and installed ref metadata | The application's persistent sandbox permissions. |
| Local overrides | Changes in the per-user or system-wide override layer. |
| Portals | Access to individual host resources through an application request and a desktop-mediated API. |

A portal can, for example, open a file chooser or a screen-capture source. It
does not always replace a persistent filesystem permission; this depends on
whether the application supports the required portal.

Compositor and portal backend routing are covered in the
[Wayland portals guide](../../desktop/wayland-portals/).

## Inspecting permissions and overrides

`flatpak info --show-permissions` shows the permissions of the installed ref.
`flatpak override --show` displays overrides, which are a separate layer. The
scope option for `info` selects the application installation; for `override`,
it selects the per-user or system-wide override layer. A per-user override can
change access for an application installed in the system scope. Check both
override layers when diagnosing access.

Check application metadata:

```bash
flatpak info --user --show-permissions <app-id>
flatpak info --system --show-permissions <app-id>
```

Check per-user and system-wide overrides:

```bash
flatpak override --user --show <app-id>
flatpak override --system --show <app-id>
```

Add an override only for a confirmed application-specific need:

```bash
flatpak override --user <specific-option> <app-id>
```

`--user` stores a per-user override; `--system` stores a system-wide override.
The `--reset` option removes all overrides for that application in the selected
layer, not only the last change:

```bash
flatpak override --user --reset <app-id>
flatpak override --system --reset <app-id>
```

Flatseal is an optional GUI for viewing and changing overrides. It is not a
security tool or a source of truth: use the Flatpak CLI to check installed
metadata and overrides.

## Local builds and `extra-data`

`flatpak-builder` can export a built ref to a local OSTree repository. You can
create a single-file bundle from that repository and install it:

```bash
flatpak-builder --repo=repo build-dir manifest.yml
flatpak build-bundle repo app.flatpak <app-id>
flatpak install --user ./app.flatpak
```

Use `--system` for a system installation. Keep the selected scope consistent
when installing, updating, and inspecting a locally built application.

For a source of type `extra-data`, the ref contains the source metadata. During
installation, Flatpak downloads the external payload, verifies its checksum,
and runs `apply_extra` locally; the payload does not have to be present in the
build repository. [ChatGPT Desktop](../chatgpt-desktop/) is an example of this
workflow.

## Updates

Update each installation separately to make the scope explicit:

```bash
flatpak update --user
flatpak update --system
```

Without `--user`, `--system`, or `--installation`, `flatpak update` updates refs
in both standard installations. An explicit option selects one installation.

`flatpak update` updates refs from configured sources. A locally built
application without an application remote does not automatically get a new
upstream version from its Git repository; build a new ref or bundle and install
it separately. See the [ChatGPT Desktop guide](../chatgpt-desktop/) for that
application's update workflow.

## EOL runtimes and pins

During an update, Flatpak may offer to remove unused EOL runtimes. Explicitly
installed runtimes and pinned refs may remain even when Flatpak considers them
unused; an EOL warning does not mean an application is broken. Before removal,
select the installation and check its pins and dependencies.

```bash
# System installation
flatpak pin
flatpak list --system --app --columns=application,runtime,installation
flatpak list --system --runtime --all \
  --columns=application,branch,installation

# User installation
flatpak pin --user
flatpak list --user --app --columns=application,runtime,installation
flatpak list --user --runtime --all \
  --columns=application,branch,installation
```

The `runtime` column shows an application's main runtime, but not every
extension. Check extensions in dependency metadata or the manifest:
`flatpak info --system --show-extensions <app-id>` lists matching extensions
(use `--user` for a user installation). A different main runtime branch does
not prove that an extension is unused. If you cannot determine whether it is
used, do not remove it.

Once confirmed unused, remove only that ref's pin and branch from the selected
installation. If Flatpak offers to remove a dependent application, stop and
check its dependencies again. Replace `<runtime-id>`, `<arch>`, and `<branch>`:

```bash
# System installation
flatpak pin --system --remove \
  runtime/<runtime-id>/<arch>/<branch>
flatpak uninstall --system \
  <runtime-id>//<branch>

# User installation
flatpak pin --user --remove \
  runtime/<runtime-id>/<arch>/<branch>
flatpak uninstall --user \
  <runtime-id>//<branch>
```

`flatpak uninstall --unused` removes refs Flatpak considers unused in the
selected installation. Pins can prevent cleanup; this does not replace checking
a specific EOL or pinned ref:

```bash
flatpak uninstall --system --unused
flatpak uninstall --user --unused
```

## Verification and rollback

Inventory of the standard installations:

```bash
flatpak remotes --user
flatpak remotes --system

flatpak list --app \
  --columns=application,runtime,installation
flatpak list --runtime --all \
  --columns=application,branch,installation
```

For a specific application:

```bash
flatpak info <app-id>
flatpak info --show-permissions <app-id>
```

If the same app ID is installed in multiple installations, add `--user` or
`--system` to `flatpak info` and `flatpak info --show-permissions`. When
assessing effective access, consider the application metadata and both override
layers; portal grants are stored separately. After a change, check that the
application starts, required portal requests and resource access work, and no
broad permissions appeared without a reason.

To undo local changes:

- Remove all overrides for the application in the intended layer with
  `flatpak override --user --reset <app-id>` or
  `flatpak override --system --reset <app-id>`.
- Use `flatpak permission-reset <app-id>` only to reset the portal permission
  store. This command does not reset Flatpak overrides.
- There is no universal rollback command for an accidentally removed runtime.
  The runtime is normally installed again when an application that requires it
  is installed or updated from a configured remote.

## Related material

- [ChatGPT Desktop](../chatgpt-desktop/) — local builds and `extra-data`.
- [Wayland portals](../../desktop/wayland-portals/) — backend configuration.
- [Flatpak on the ASUS B5402](../../systems/asus-b5402/applications/) — system state.
- [Using Flatpak](https://docs.flatpak.org/en/latest/using-flatpak.html) and
  [Sandbox permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html).
- [Flatpak Command Reference](https://docs.flatpak.org/en/latest/flatpak-command-reference.html),
  [Flatpak Builder](https://docs.flatpak.org/en/latest/flatpak-builder-command-reference.html),
  [`extra-data`](https://docs.flatpak.org/en/latest/module-sources.html#extra-data)
  and [single-file bundles](https://docs.flatpak.org/en/latest/single-file-bundles.html).
