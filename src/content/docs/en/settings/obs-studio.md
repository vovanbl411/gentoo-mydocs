---
title: OBS Studio on Gentoo and Niri
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

The goal is to get OBS Studio working, capture the Wayland screen through
portals and PipeWire, and check which encoders are actually available. There
are two independent installation models:

```text
Option A: Flatpak OBS
OBS runtime + bundled dependencies
→ Wayland
→ XDG Desktop Portal
→ PipeWire capture

Option B: native Gentoo OBS
Portage package + system FFmpeg/libraries
→ USE policy
→ Wayland / screencast support
```

The ASUS B5402 uses OBS Flatpak. That describes this particular machine; it is
not a universal recommendation. Details are recorded in
[the system section](../../systems/asus-b5402/applications/).

## Installation models

### Option A: Flatpak OBS

Install OBS from Flathub and first inspect the permissions already granted to
the package:

```bash
flatpak install flathub com.obsproject.Studio
flatpak info com.obsproject.Studio
flatpak info --show-permissions com.obsproject.Studio
```

OBS uses the portal frontend. Do not add Flatpak overrides for the backend's
internal D-Bus interfaces without a specific, diagnosed symptom.

### Option B: native Gentoo OBS

`media-video/obs-studio-32.2.2` provides these features:

| USE flag | What it adds |
|----------|--------------|
| `wayland` | Wayland support. |
| `screencast` | Screen/video capture through PipeWire. |
| `qsv` | Intel Quick Sync Video. |
| `nvenc` | NVIDIA hardware encoding. |
| `browser` | Browser source. |
| `fdk` | LibFDK AAC support. |
| `pulseaudio` | PulseAudio audio support. |
| `v4l` | Video4Linux support. |
| `websocket` | WebSocket API. |

The current ebuild has no `pipewire` USE flag. A minimal example for Wayland
capture is:

File: `/etc/portage/package.use/obs-studio`

```makefile
media-video/obs-studio wayland screencast
```

Add `qsv`, `nvenc`, `browser`, `fdk`, `pulseaudio`, `v4l`, `websocket`, and
other features as needed, after checking the current ebuild.

QSV and VA-API are different mechanisms. For hardware encoding through VA-API,
the ebuild lists this optional dependency separately:

```text
media-video/ffmpeg[vaapi]
```

## Wayland capture on Niri

The working capture path for Niri is:

```text
OBS
→ xdg-desktop-portal
→ GNOME ScreenCast backend
→ Niri ScreenCast API
→ PipeWire stream
```

- `xdg-desktop-portal` is the frontend that OBS calls;
- the GNOME backend handles ScreenCast and Screenshot through an API
  compatible with Niri;
- the GTK backend handles general dialogs and settings;
- the WLR backend is not needed for this Niri configuration.

Backend routing is described in
[XDG Desktop Portals](../../desktop/wayland-portals/).

In OBS, add this source:

```text
Screen Capture (PipeWire)
```

The portal chooser should offer a monitor, window, or another available source.
The old XScreenCapture is not a solution for native Wayland capture.

## PipeWire services

Do not enable user services from a universal template: activation depends on
the system configuration. Use these read-only checks:

```bash
systemctl --user status pipewire.service
systemctl --user status wireplumber.service
wpctl status
```

Check `pipewire-pulse.service` separately only if the actual audio runtime uses
a PulseAudio-compatible interface. Screen capture through PipeWire and
PulseAudio audio compatibility are separate functions.

## Encoders

| Encoder family | Description |
|----------------|-------------|
| x264 | Software H.264. |
| QSV | Intel hardware encoding. |
| VA-API | Linux hardware video API. |
| NVENC | NVIDIA hardware encoding. |
| HEVC / AV1 | Availability depends on the GPU, driver, build, and target platform. |

### Choosing an encoder

1. See which encoders the installed OBS lists.
2. Account for the requirements of the streaming platform or player.
3. Make a short test recording.
4. Check quality, dropped frames, and GPU/CPU load in OBS Stats and the log.

There is no universal ranking or set of bitrate/CQ/CRF values for every GPU
and use case.

### Encoder verification

For native Portage OBS, these checks help inspect the host stack:

```bash
vainfo
ffmpeg -encoders
```

`vainfo` shows the VA-API driver's capabilities, while `ffmpeg -encoders` shows
those of the system FFmpeg. Neither command alone proves that an encoder is
available in OBS Flatpak.

For Flatpak, the main checks are the encoder list inside OBS, the OBS log, and
a short test recording.

## Audio

OBS audio capture depends on the selected installation model and runtime.
PipeWire can provide a PulseAudio-compatible interface. The native Gentoo
ebuild has separate audio USE features, while Flatpak provides its own runtime
integration. Choose an available encoder based on the output platform's
requirements and check it with a test recording; do not choose `libfdk_aac`
without considering the available runtime and output requirements.

## Backup and restore

First identify the installation type, then copy the matching configuration
directory:

```text
Native OBS:  ~/.config/obs-studio/
Flatpak OBS: ~/.var/app/com.obsproject.Studio/config/obs-studio/
```

Example backup of one selected directory:

```bash
cp -a <obs-config-directory> <backup-directory>/
```

Before restoring, close OBS and save the current directory separately. Backing
up all of `/etc/portage/` is outside the scope of this guide.

## Verification

### Flatpak

```bash
flatpak info com.obsproject.Studio
flatpak info --show-permissions com.obsproject.Studio
```

### Session

```bash
echo "$XDG_SESSION_TYPE"
echo "$XDG_CURRENT_DESKTOP"

systemctl --user status xdg-desktop-portal.service
systemctl --user status xdg-desktop-portal-gnome.service
systemctl --user status pipewire.service
systemctl --user status wireplumber.service
```

### Functional gate

1. OBS starts.
2. `Screen Capture (PipeWire)` is available.
3. The portal chooser opens.
4. The selected screen or window appears in the preview.
5. A test recording is created and plays back.
6. The encoder list matches the actual hardware and runtime.

These commands and checks are for the user; they were not run automatically
while editing this document.

## Troubleshooting

### `Screen Capture (PipeWire)` is missing

Check the Wayland session, portal frontend, GNOME backend for Niri, PipeWire,
and the OBS log. For native OBS, also check `USE=screencast`.

### The portal chooser does not appear

Check routing and user services using the
[XDG Desktop Portals guide](../../desktop/wayland-portals/). Do not add
arbitrary Flatpak D-Bus overrides before identifying the cause.

### Hardware encoder is missing

Check each layer separately:

```text
hardware capability
→ driver/runtime
→ native package build flags or Flatpak runtime
→ OBS encoder support
```

`vainfo` is part of VA-API diagnostics, but it is not the only evidence that an
encoder is available in OBS.

### Recording fails or overloads the system

Open OBS Stats and the log, then check dropped frames, encoder errors, and
system load. Do not switch encoders based only on a general recommendation;
first compare the result of a short test recording.

## Related docs

- [Flatpak](../flatpak/) — permissions and overrides.
- [Niri](../../desktop/niri/) — starting a Wayland session.
- [XDG Desktop Portals](../../desktop/wayland-portals/) — portal routing for Niri.
- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — the verified machine state.
- [OBS Studio on Gentoo Packages](https://packages.gentoo.org/packages/media-video/obs-studio) — current versions and USE flags.
