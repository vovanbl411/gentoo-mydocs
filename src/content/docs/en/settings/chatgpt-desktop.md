---
title: ChatGPT Desktop through Flatpak
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: []
---

This unofficial Flatpak packaging runs the native Linux ChatGPT Desktop app in a
Flatpak sandbox on Gentoo. OpenAI publishes the application; the manifest and
Flatpak integration are maintained by the third-party project
[`kk-daniel/chatgpt-desktop-flatpak`](https://github.com/kk-daniel/chatgpt-desktop-flatpak).
This project is not an official OpenAI Flatpak package.

| Component | Maintainer |
|-----------|------------|
| ChatGPT Desktop application | OpenAI |
| Flatpak manifest and integration | `kk-daniel/chatgpt-desktop-flatpak` |

The current packaging uses OpenAI's official native Linux RPM as `extra-data`:
the manifest pins the RPM URL, SHA-256, and size; Flatpak downloads and verifies
the file during installation, then `apply_extra` extracts the payload locally.
Upstream refreshes these values from signed metadata in OpenAI's RPM repository.
The Flatpak runtime and extensions provide the application's dependencies, so
they do not come from Gentoo Portage packages.

## Installation

The main path in the upstream README builds the application from the packaging
repository and installs it in the user scope. You need `flatpak`,
`flatpak-builder`, and a user Flathub remote for build dependencies.

If Flathub has not been added for your user yet:

```bash
flatpak remote-add --if-not-exists --user flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

Get the packaging manifest and build the application:

```bash
git clone https://github.com/kk-daniel/chatgpt-desktop-flatpak.git
cd chatgpt-desktop-flatpak

flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  --install \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml

flatpak run com.openai.ChatGPT
```

The build creates the local `repo` repository and installs the app for the
current user. Flatpak downloads the extra-data RPM directly from OpenAI during
installation.

## Optional: system installation from a bundle

The upstream README documents a user-scope installation. If you need the app
system-wide, Flatpak can create a bundle from the repository produced by
`flatpak-builder` and install it in the system scope. This is a separate option,
not the main upstream workflow.

```bash
flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml

flatpak build-bundle \
  repo \
  ChatGPT.flatpak \
  com.openai.ChatGPT \
  --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo

flatpak install --system ./ChatGPT.flatpak
flatpak info --system com.openai.ChatGPT
```

`repo` is the output repository from `flatpak-builder`, not the repository for
an installed Flatpak copy. The current manifest does not require a temporary
user installation: Flatpak records the `extra-data` metadata in the ref and
downloads the RPM when the bundle is installed. These commands do not configure
an application remote for updates; see “Updating” for the system installation
path.

See the Flatpak documentation for [sources of type `extra-data`](https://docs.flatpak.org/en/latest/module-sources.html#extra-data)
and [single-file bundles](https://docs.flatpak.org/en/latest/single-file-bundles.html).

## Inspecting permissions

The manifest defines baseline permissions through `finish-args`; local
overrides can change them. Inspect the installed application's effective
permissions and overrides separately:

```bash
# For a user installation
flatpak info --user --show-permissions com.openai.ChatGPT
flatpak override --user --show com.openai.ChatGPT

# For a system installation
flatpak info --system --show-permissions com.openai.ChatGPT
flatpak override --system --show com.openai.ChatGPT
```

The current manifest allows network and IPC, Wayland with X11 fallback,
PulseAudio, GPU access through `dri`, selected D-Bus names, and a private
`.codex`. Check the current manifest and your installation after updates; the
permissions can change.

### Optional: disable the X11 fallback

To use Wayland without the X11 fallback, add a per-user override:

```bash
flatpak override --user \
  --nosocket=fallback-x11 \
  com.openai.ChatGPT

flatpak override --user --show com.openai.ChatGPT
flatpak info --show-permissions com.openai.ChatGPT
```

To remove all per-user overrides for the app and restore the manifest settings,
run:

```bash
flatpak override --user --reset com.openai.ChatGPT
```

`--reset` removes every per-user override for the app, including other settings
if you have any. The presence of a Wayland socket and the absence of
`fallback-x11` in effective permissions do not prove which display backend a
particular launch used.

### Optional: login keyring access

Upstream deliberately does not grant the app access to
`org.freedesktop.secrets`: Secret Service does not guarantee per-application
secret isolation. Without this permission, Chromium uses local storage inside
the private Flatpak data directory. Grant access only if you accept this risk:

```bash
flatpak override --user \
  --talk-name=org.freedesktop.secrets \
  com.openai.ChatGPT
```

If the app does not detect the backend automatically, upstream also describes
explicitly selecting a password store. For example, for `gnome-libsecret`:

```bash
flatpak override --user \
  --env=ELECTRON_EXTRA_LAUNCH_ARGS=--password-store=gnome-libsecret \
  com.openai.ChatGPT
```

For KDE, upstream lists `kwallet6`; choose the backend installed in your desktop
environment. To revoke access and remove this variable:

```bash
flatpak override --user \
  --no-talk-name=org.freedesktop.secrets \
  --unset-env=ELECTRON_EXTRA_LAUNCH_ARGS \
  com.openai.ChatGPT
```

You may need to sign in again after switching password stores.

## Optional: Codex sandbox host broker

The ChatGPT interface does not need the host broker for ordinary use. Codex uses
a nested bubblewrap sandbox, which Flatpak does not allow to create the required
namespaces. The packaging project provides a separate host-side broker for this
feature.

Before installing it, read upstream
[`SANDBOXING.md`](https://github.com/kk-daniel/chatgpt-desktop-flatpak/blob/main/SANDBOXING.md)
and [`host/README.md`](https://github.com/kk-daniel/chatgpt-desktop-flatpak/blob/main/host/README.md).
The broker requires Linux 6.5 or later, `x86_64`, and a systemd user session;
upstream does not support the broker on `aarch64`. It expands the syscall
surface and adds a host-side service that receives Codex requests, enters the
app's namespaces, and runs bubblewrap. This is not an ordinary Flatpak
permission. The installer needs no root access; it places files in `$HOME` and
enables a systemd user socket:

```bash
"$(flatpak info com.openai.ChatGPT -l)/files/extra/chatgpt/sandbox-host/install.sh"
```

Check the service with:

```bash
systemctl --user status flatpak-bwrap-broker@com.openai.ChatGPT.socket
```

After every Flatpak update, upstream says to run the installer again because
the host copy of the broker is updated separately from the app.

### Removing the broker

The broker is installed on the host separately from Flatpak and remains after
`flatpak uninstall`. At the end, the upstream `install.sh` prints the removal
commands. For the default XDG paths, they are:

```bash
systemctl --user disable --now \
  flatpak-bwrap-broker@com.openai.ChatGPT.socket

rm -rf \
  "$HOME/.local/libexec/flatpak-bwrap-broker" \
  "$HOME/.config/systemd/user/flatpak-bwrap-broker@.socket" \
  "$HOME/.config/systemd/user/flatpak-bwrap-broker@.service"

systemctl --user daemon-reload
```

If you used a custom `XDG_CONFIG_HOME` during installation, remove the unit
files from the path printed by `install.sh`.

## Updating

The upstream packaging project refreshes the manifest from signed metadata in
OpenAI's RPM repository and pins the new RPM URL, SHA-256, and size. Do not edit
these values by hand. Update the packaging repository and rebuild:

```bash
cd chatgpt-desktop-flatpak
git pull --ff-only

flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  --install \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml
```

For a system bundle, build the ref in `repo` without `--install`, create a new
bundle, and update the installed ref:

```bash
flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml

flatpak build-bundle \
  repo \
  ChatGPT.flatpak \
  com.openai.ChatGPT \
  --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo

flatpak install --system --or-update ./ChatGPT.flatpak
```

A local build does not configure an application remote. If the app has no
application remote, `flatpak update` will not get a new ChatGPT ref from the
packaging repository; it can still update runtimes and extensions from
configured remotes. Check the version and permissions after updating.

## Troubleshooting

### Error while downloading `extra-data`

Flatpak downloads the RPM directly from OpenAI's RPM repository, not from
Flathub. Check network access and the URL in the current upstream manifest. If
the checksum metadata has changed, update the packaging checkout and wait for
its manifest to be refreshed; do not change the URL, SHA-256, or size by hand.

## Removing the app

Uninstall the app from the installation where it was installed:

If you installed the Codex broker, remove it separately using the instructions
above; uninstalling the Flatpak does not remove the host component.

```bash
# User installation
flatpak uninstall --user com.openai.ChatGPT

# System installation
flatpak uninstall --system com.openai.ChatGPT
```

Do not run `flatpak uninstall --unused` blindly: it can remove runtimes that are
no longer used by other user applications. Do not remove the Flathub remote
automatically; first check `flatpak remotes --user` and `flatpak list --user`.

## Verify after installation or update

For the upstream user installation:

```bash
flatpak info --user com.openai.ChatGPT
flatpak info --user --show-permissions com.openai.ChatGPT
flatpak override --user --show com.openai.ChatGPT
```

For a system installation, add `--system` to the `flatpak info` commands and
inspect user and system overrides separately. Then check that:

- the app starts and sign-in works;
- the selected display path and file chooser/portal work;
- notifications work if you need them;
- Codex works if you use that feature;
- an update has not introduced unexpected permission drift.

`--persist=.codex` keeps separate Codex state in the private Flatpak data
directory at `$HOME/.var/app/com.openai.ChatGPT/.codex`. It is not shared with a
host-installed Codex CLI.

## Related material

- [General Flatpak guide](../flatpak/).
- [Applications on the ASUS ExpertBook B5402](../../systems/asus-b5402/applications/) — the state of that specific system.
- [Upstream README](https://github.com/kk-daniel/chatgpt-desktop-flatpak) — packaging installation and updates.
- [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).
