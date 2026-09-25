---
title: "Firefox: native Gentoo/Wayland application"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Firefox on Gentoo can be built with Clang, optionally with PGO, and run as a
Wayland application with hardware acceleration. `profile-sync-daemon` remains
an optional profile optimization:

```text
Firefox from Gentoo
→ Clang
→ optional PGO
→ Wayland
→ hardware acceleration
→ optional profile-sync-daemon
```

The actual package policy for the ASUS B5402 remains in
[applications.md](../../systems/asus-b5402/applications/) and
[boot-and-portage.md](../../systems/asus-b5402/system/boot-and-portage/).

## Build policy

USE flags describe the features built into the package; they do not describe
the browser's actual runtime or the system as a whole.

| USE flag | Purpose |
|----------|---------|
| `clang` | Build Firefox with the LLVM/Clang toolchain. |
| `pgo` | Build an optimized binary using profiling data; this significantly increases build time. |
| `jumbo-build` | Affects the build process by combining source files for compilation. It does not, by itself, promise faster Firefox runtime performance. |
| `hwaccel` | Adds hardware-acceleration support; operation also depends on the driver, Mesa, VA-API, and runtime. |
| `wayland` | Adds the Wayland backend. |
| `pulseaudio` | Adds the Firefox audio backend through libpulse/apulse. PipeWire can provide its PulseAudio-compatible runtime. |
| `system-pipewire` | Uses system `media-video/pipewire` for WebRTC and screencast instead of the bundled library. |
| `system-*` libraries | Use system libraries where supported by the ebuild, for example AV1, HarfBuzz, ICU, JPEG, libevent, libvpx, PNG, and WebP. |
| `wasm-sandbox` | Enables the RLBox/WebAssembly sandbox for supported third-party libraries. |
| `wifi`, `jpegxl`, `telemetry` | Not universal policy: enable or disable them based on required features and after checking the current ebuild. |

Building Firefox with `USE=-telemetry` disables Mozilla data-reporting and
telemetry build options. This should not be treated as an absolute guarantee
that the browser makes no network service requests of any kind.

## Wayland and acceleration

For native Wayland, Firefox needs `USE=wayland`. `USE=-X` is relevant only on
a deliberately pure Wayland system where the X11 backend is not needed; it is
not a prerequisite for Wayland Firefox.

`USE=hwaccel` only adds build support. Check runtime operation separately:
kernel driver, Mesa, VA-API, and Firefox settings. `USE=pulseaudio` describes
Firefox's audio backend through libpulse/apulse; the PipeWire runtime can
provide its PulseAudio-compatible layer. `USE=system-pipewire` separately
selects system `media-video/pipewire` for WebRTC and screencast instead of the
bundled library.

Configure Firefox associations for HTTP(S), HTML, and PDF through
[default applications (XDG MIME)](../../desktop/default-applications/).

## Example package.use

This is an example feature set, not a universal recommended policy. Check the
current ebuild's flags and select only those you need:

File: `/etc/portage/package.use/40-multimedia`

```makefile
media-libs/libpng          apng
media-libs/libvpx          postproc
www-client/firefox         clang pgo jumbo-build hwaccel wayland pulseaudio openh264 system-pipewire wasm-sandbox system-av1 system-harfbuzz system-icu system-jpeg system-libevent system-libvpx system-webp system-png -telemetry -wifi -jpegxl
```

If you genuinely do not need the X11 backend, add `-X` as a separate,
deliberate choice after checking application dependencies.

## Optional: profile-sync-daemon

`profile-sync-daemon` temporarily places the browser profile in tmpfs or an
overlay, then syncs persistent state back. This reduces writes to persistent
storage during a session, but you need to understand its memory use and sync
behavior on shutdown or suspend.

File: `~/.config/psd/psd.conf`

```bash
# Use Overlayfs
USE_OVERLAYFS="yes"
# Sync on suspend
USE_SUSPSYNC="yes"
# Only the required browser
BROWSERS=(firefox)
```

## Verification

```bash
systemctl --user status psd.service
```

In Firefox, check the selected Wayland backend, hardware-acceleration
availability, and audio/WebRTC operation in the runtime you use. For PSD, check
the user unit's status and the expected profile mount point.

## Related docs

- [Firefox on the ASUS B5402](../../systems/asus-b5402/applications/) — actual package policy and system state.
- [Portage and boot on the ASUS B5402](../../systems/asus-b5402/system/boot-and-portage/) — system build settings.
- [Default applications](../../desktop/default-applications/) — MIME associations.
