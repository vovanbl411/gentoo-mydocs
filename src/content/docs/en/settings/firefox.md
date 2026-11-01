---
title: "Firefox: native Gentoo/Wayland application"
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

Firefox USE flags select build features; verify Wayland, graphics, and audio
separately after installation. You can use `profile-sync-daemon` separately if
you want a RAM-backed working copy of the profile:

```text
current ebuild
→ selected USE features
→ build
→ runtime verification
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
| `clang` | Builds Firefox with LLVM/Clang. |
| `pgo` | Enables build-time Profile-Guided Optimization and increases build time. The current ebuild requires `jumbo-build` with it. |
| `jumbo-build` | Changes the build process by combining source files for compilation; it does not, by itself, promise faster Firefox runtime performance. |
| `hwaccel` | Installs Gentoo preferences that force-enable hardware rendering. The actual runtime depends on Firefox, Mesa, and the graphics stack. |
| `wayland` | Adds the native Wayland backend; the current ebuild also requires `dbus`. |
| `pulseaudio` | Selects Firefox's ordinary audio backend through `libpulse` or `apulse`. PipeWire can provide this backend's PulseAudio-compatible API. |
| `system-pipewire` | Uses system `media-video/pipewire` for WebRTC and screencast. It does not select Firefox's ordinary audio output. |
| `system-*` | The available set and defaults depend on the current ebuild; check it before selecting system libraries. |
| `wasm-sandbox` | Enables the RLBox/WebAssembly sandbox for supported third-party libraries. |
| `-telemetry` | Disables Mozilla build/data-reporting options and installs Gentoo telemetry preferences. This does not guarantee the absence of all network requests. |

Before changing USE, check the flags and Portage plan for the current tree:

```bash
emerge --pretend --verbose www-client/firefox
```

The checked ebuild has the conditions `|| ( X wayland )`,
`pgo? ( jumbo-build )`, `wayland? ( dbus )`, and `wifi? ( dbus )`. These can
change with the ebuild.

## Wayland and acceleration

`USE=wayland` adds the native Wayland backend. The current ebuild requires at
least one backend: `X` or `wayland`. `USE=-X` disables the X11 backend and is a
separate choice for a pure Wayland policy; it is not required for native
Wayland.

With `USE=hwaccel`, Gentoo installs preferences that force-enable
hardware-accelerated rendering. This is build/config policy, not a guarantee
that GPU acceleration works. Check Firefox under **Help → Troubleshooting
Information** (`about:support`). Review `Window Protocol`, `Compositing`,
graphics/WebRender state, and audio/media information when needed.

Configure Firefox associations for HTTP(S), HTML, and PDF through
[default applications (XDG MIME)](../../desktop/default-applications/).

## Optional: profile-sync-daemon

`profile-sync-daemon` is an optional way to manage a working profile copy:
persistent Firefox profile ↔ PSD ↔ tmpfs or overlayfs. During a session, the
working state lives in RAM-backed storage and may reduce writes to the
persistent profile; practical benefit depends on the workload. PSD is not
required for SSDs.

Back up the profile before first use. Firefox must be included in the browser
list in the current PSD config; overlayfs is an optional mode, and
`USE_SUSPSYNC` separately controls sync on suspend. Check the current syntax and
options in the [upstream documentation](https://github.com/graysky2/profile-sync-daemon).

## Verification

```bash
systemctl --user status psd.service --no-pager
```

Check Firefox under **Help → Troubleshooting Information** (`about:support`):
`Window Protocol`, `Compositing`, graphics/WebRender, and audio/media when
needed. Use the `systemctl` command only if you use PSD; build flags alone do
not show runtime state.

## Related docs

- [Firefox on the ASUS B5402](../../systems/asus-b5402/applications/) — actual package policy and system state.
- [Portage and boot on the ASUS B5402](../../systems/asus-b5402/system/boot-and-portage/) — system build settings.
- [Default applications](../../desktop/default-applications/) — MIME associations.
