---
title: OBS Studio on Gentoo
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

In a Wayland session, OBS captures the screen through the ScreenCast portal and
PipeWire. OBS calls the `org.freedesktop.portal.ScreenCast` interface provided
by `xdg-desktop-portal`, which routes the request to the backend for the current
session.

```text
OBS
→ org.freedesktop.portal.ScreenCast
  (through org.freedesktop.portal.Desktop)
→ xdg-desktop-portal
→ ScreenCast backend for the current session
→ PipeWire stream
```

The ScreenCast backend must support the current desktop session. Its selection
and routing are covered in the [XDG Desktop Portals guide](../../desktop/wayland-portals/).

## Installation models

Flatpak OBS and native Gentoo OBS are independent options. Choose based on
sandboxing, system libraries, and maintenance needs; neither is a universal
default.

### Flatpak OBS

Install OBS from Flathub and inspect the permissions already granted to it:

```bash
flatpak install flathub com.obsproject.Studio
flatpak info com.obsproject.Studio
flatpak info --show-permissions com.obsproject.Studio
```

OBS uses the portal frontend. Do not add Flatpak overrides before diagnosing a
specific problem.

### Native Gentoo OBS

The `media-video/obs-studio` package is built with USE flags. These cover the
main OBS features relevant here; they are not the ebuild's complete flag list:

| USE flag | What it enables |
|----------|-----------------|
| `wayland` | Wayland platform support. |
| `screencast` | The PipeWire screen/video capture plugin and a dependency on `media-video/pipewire`. |
| `qsv` | Intel Quick Sync Video; the ebuild adds `media-libs/libvpl`. |
| `nvenc` | NVIDIA hardware encoding support. |
| `browser` | Browser source. |
| `fdk` | LibFDK AAC support. |
| `alsa` | Audio capture through ALSA. |
| `pulseaudio` | Audio capture through a PulseAudio-compatible API. |
| `v4l` | Video4Linux support. |
| `websocket` | WebSocket API. |

Check the current ebuild's USE flags before installing. In the current Gentoo
ebuild, `wayland` controls Wayland platform support through
`-DENABLE_WAYLAND=$(usex wayland)`, while `screencast` enables PipeWire
screen/video capture through `-DENABLE_PIPEWIRE=$(usex screencast)`. OBS has no
separate `pipewire` USE flag for screen capture.

File: `/etc/portage/package.use/obs-studio`

```makefile
media-video/obs-studio wayland screencast
```

Then install the package:

```bash
doas emerge --ask media-video/obs-studio
```

QSV and VA-API are different mechanisms. The ebuild uses `media-libs/libvpl`
for QSV. It lists VA-API separately as an optional feature through
`media-video/ffmpeg[vaapi]`; `media-video/obs-studio` has no `vaapi` USE flag.

## Wayland screen capture

In OBS, add the `Screen Capture (PipeWire)` source. OBS creates a ScreenCast
portal session, the chooser offers available sources, and OBS connects to the
PipeWire stream after selection. Available source types and chooser behavior
depend on the ScreenCast backend implementation.

`Screen Capture (XSHM)` is for X11 and is not the native Wayland screen-capture
path.

## Checking the portal and PipeWire

Check the current session variables, the portal frontend, running backend
services, and PipeWire:

```bash
echo "$XDG_SESSION_TYPE"
echo "$XDG_CURRENT_DESKTOP"

systemctl --user status xdg-desktop-portal.service
systemctl --user --type=service --state=running \
  | grep 'xdg-desktop-portal' || true
systemctl --user status pipewire.service
systemctl --user status wireplumber.service
wpctl status
```

Do not enable user services from a universal template: activation depends on
the system. Check `pipewire-pulse.service` separately if the audio runtime uses
a PulseAudio-compatible interface. It is not required for Wayland screen
capture.

## Audio capture

Screen and audio capture are separate features:

```text
Wayland screen capture → ScreenCast portal / PipeWire video stream
Native Gentoo build    → USE=screencast enables the screen/video plugin
Audio capture          → OBS audio backend / optional PipeWire audio plugin
```

`USE=screencast` enables screen/video capture, not PipeWire audio capture in
OBS. Built-in audio capture needs at least one of `alsa` or `pulseaudio`; the
current Gentoo ebuild prints a post-install message if both are disabled. The
ebuild also lists `media-plugins/obs-pipewire-audio-capture` as an optional
package for native PipeWire audio capture. For other audio paths, account for
the `alsa` and `pulseaudio` features in the OBS build. PipeWire can provide a
PulseAudio-compatible interface through `pipewire-pulse`; that is a separate
audio path, not a ScreenCast requirement.

## Hardware encoders

Encoder availability depends on several layers:

```text
hardware capability
→ driver and runtime
→ FFmpeg and required libraries
→ OBS build or runtime
→ encoder appears in OBS
```

There is no universal encoder ranking or bitrate/CQ/CRF setting. For native
OBS, software encoding through x264 and hardware encoding through QSV, VA-API,
or NVENC may be available. HEVC and AV1 support depends on the hardware, driver,
build, and target platform. These checks help inspect the host stack:

```bash
vainfo
ffmpeg -encoders
```

`vainfo` shows the VA-API driver's capabilities, while `ffmpeg -encoders` lists
encoders from the system FFmpeg. Neither proves that an encoder is available
inside OBS, especially in Flatpak with its separate runtime. Confirm
availability in OBS's encoder list and log, then make a short test recording.

## Backup

Copy the configuration directory for the selected installation:

```text
Native OBS:  ~/.config/obs-studio/
Flatpak OBS: ~/.var/app/com.obsproject.Studio/config/obs-studio/
```

Close OBS before copying or restoring. Scene collections can reference media
files outside the configuration directory; save those files separately.

Example of copying the selected directory:

```bash
cp -a <obs-config-directory> <backup-directory>/
```

## Verification

1. OBS starts.
2. The Wayland session is detected as expected.
3. `Screen Capture (PipeWire)` is available in the source list.
4. The portal chooser opens.
5. The selected source appears in the preview.
6. A short test recording is created and plays back.
7. The OBS log has no encoder errors, and OBS Stats shows no unexpected dropped
   frames.
8. The selected encoder appears in OBS's encoder list.

## Troubleshooting

If `Screen Capture (PipeWire)` is missing in native Gentoo OBS, check
`USE=screencast` first: this flag enables the PipeWire source. `USE=wayland`
separately controls OBS's native Wayland platform support. For Flatpak, check
that the installed build includes the source.

If the chooser does not open or the source does not appear, check each layer in
order:

```text
OBS source
→ xdg-desktop-portal frontend
→ ScreenCast backend for the current session
→ session environment and routing
→ PipeWire
→ OBS log
```

See the [XDG Desktop Portals guide](../../desktop/wayland-portals/) for
backend-specific routing. Do not change the desktop session or install another
backend before identifying the cause. Open the current OBS log in the
application UI; if you need the file, use the actual path for your installation
model.

If an encoder is missing, check the hardware, driver/runtime, FFmpeg, libraries,
and OBS build or runtime separately. For recording problems, check OBS Stats
and the log for encoder errors, dropped frames, and system load, then try a
short test recording.

## Related material

- [Flatpak](../flatpak/) — permissions and overrides.
- [XDG Desktop Portals](../../desktop/wayland-portals/) — portal routing for the current session.
- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — the system's actual state.
- [OBS Studio in Gentoo Packages](https://packages.gentoo.org/packages/media-video/obs-studio) — ebuild versions and USE flags.
- [XDG Desktop Portal ScreenCast interface](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html).
- [OBS PipeWire ScreenCast implementation](https://github.com/obsproject/obs-studio/blob/master/plugins/linux-pipewire/screencast-portal.c).
