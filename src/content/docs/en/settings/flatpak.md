---
title: "Flatpak: GUI applications and permissions"
kind: guide
scope: general
status: current
last_verified: "2026-10-04"
verified_on: [asus-b5402]
---

Flatpak installs applications from Flathub in an isolated runtime. Sandbox
permissions and portals provide access to files and desktop services; Flatseal
can be used as an optional GUI for viewing and changing them.

```text
Flatpak
→ Flathub
→ sandboxed application
→ portals
→ permissions
→ optional Flatseal GUI
```

The local policy for the ASUS B5402 is recorded in
[applications.md](../../systems/asus-b5402/applications/).

## Flathub

Install `sys-apps/flatpak` in a way that matches the current Gentoo ebuild and
profile. Do not tie this general guide to one required USE flag: they depend on
the ebuild version and profile. Then add Flathub and check the remote:

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

## Permissions model

The main principle is to give an application only the permissions it needs.
Portals let you select an individual file or directory in an application
dialog without granting permanent access to all of `$HOME`.

| Category | When it is needed |
|----------|-------------------|
| Filesystem | Access to `$HOME` is broad; prefer a specific directory or a portal. |
| Wayland / X11 sockets | A native Wayland-only application may use Wayland alone. An application with an X11 fallback may need `wayland` and `fallback-x11`; an X11-only application may need X11. |
| Devices | Allow only devices the application actually needs, such as a GPU or controller. |
| Environment | Do not force Wayland variables through an override without a specific reason and a way to check the result. |

## Optional: Flatseal

Flatseal is a GUI for viewing and changing Flatpak application overrides. It is
not required for Flatpak and does not replace understanding which access an
application needs.

## CLI overrides

Use the CLI to inspect and reset overrides without Flatseal:

```bash
flatpak info --show-permissions <app-id>
flatpak override --user ...
flatpak override --user --reset <app-id>
```

`--user` creates a user override. Without it, `flatpak override` applies to the
default system-wide installation. Add a specific `flatpak override --user` only
for a confirmed need of that `<app-id>`.

## Example: Steam

Steam is a separate example, not a baseline for every Flatpak application:

```bash
flatpak install flathub com.valvesoftware.Steam
```

Steam Flatpak includes the required userspace runtime libraries in its Flatpak
runtime, reducing the number of native multilib dependencies on the host. This
does not define the Gentoo profile or the system ABI as a whole.

For Steam, check only the sandbox categories it actually needs: GPU, game
controller, and required directory access. MangoHud can be added as an optional
FPS-monitoring integration; Flatseal does not manage shader compilation.

## Verification

```bash
flatpak remotes
flatpak info --show-permissions <app-id>
```

Check that the application starts, uses the required display backend, and has
only the filesystem, device, and socket permissions it needs.

## Maintaining EOL runtimes and pins

`flatpak update` may report that a runtime or extension branch has reached
end-of-life (EOL). The `(pinned)` marker means protection from automatic
removal; it does not by itself prove that an application still needs the runtime.
`flatpak uninstall --unused` is insufficient for this case: a pin can
prevent cleanup.

Before removal, check pins, application runtime branches, and installed runtimes:

```bash
flatpak pin
flatpak list --app \
    --columns=application,runtime
flatpak list --runtime --all \
    --columns=application,branch,installation
```

For an extension, also consider the application's manifest/runtime dependencies:
the list of main runtimes does not enumerate every required extension. Do not
automatically install branch N+1 just because the old branch is EOL: the
application's dependencies determine the required branch.

If the EOL runtime is confirmed unused, remove its specific pin, then remove
that specific branch from the correct installation. This example is for the
default system installation; replace `<runtime-id>` and `<branch>` entirely,
without angle brackets, and replace `x86_64` with the required architecture:

```bash
flatpak pin --remove \
  runtime/<runtime-id>/x86_64/<branch>

flatpak uninstall --system \
  <runtime-id>//<branch>
```

For a user installation, use `--user` when viewing/changing pins and instead
of `--system` when uninstalling; the scope must match the diagnosis.
If Flatpak offers to remove dependent applications, stop and check
the dependencies again.

### Verified example: ffmpeg-full 24.08

This is a maintenance example from the ASUS B5402, not universal commands to copy.
Before cleanup, the warning was:

```text
Info: (pinned) runtime org.freedesktop.Platform.ffmpeg-full branch 24.08 is end-of-life
```

Pin: `runtime/org.freedesktop.Platform.ffmpeg-full/x86_64/24.08`.
Applications used Freedesktop 25.08/26.08 and GNOME 50;
none used Freedesktop 24.08. After confirming that the old extension
was no longer used, these commands were run:

```bash
flatpak pin --remove \
  runtime/org.freedesktop.Platform.ffmpeg-full/x86_64/24.08

flatpak uninstall --system \
  org.freedesktop.Platform.ffmpeg-full//24.08
```

After cleanup, check the runtime inventory again and run:

```bash
flatpak update
```

The verified example's brief result:

```text
12 applications
ffmpeg-full 24.08 absent
flatpak update → Nothing to update
```

On 2026-10-04, only the runtime maintenance path was tested on `asus-b5402`;
permissions and the rest of the guide were not re-checked on that date
(the previous check was on 2026-09-22). The current state is recorded in
the [system document](../../systems/asus-b5402/applications/).

## Reset / rollback

Remove an application's local overrides with:

```bash
flatpak override --user --reset <app-id>
```

## Related docs

- [Flatpak on the ASUS B5402](../../systems/asus-b5402/applications/) — the actual system state.
- [Default applications](../../desktop/default-applications/) — MIME associations for GUI applications.
