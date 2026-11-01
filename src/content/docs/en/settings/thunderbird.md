---
title: "Thunderbird: native Gentoo and Wayland"
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

Gentoo can build Thunderbird with a native Wayland backend. Check package
capabilities separately from application behavior: USE flags do not confirm
the backend or renderer selected at runtime.

## Build capabilities

Check the available version and Portage plan before changing USE flags:

```bash
thunderbird --version
emerge --pretend --verbose mail-client/thunderbird
```

The meaning of individual USE flags depends on the current ebuild. The main
distinctions are:

| USE flag | What it changes |
|----------|-----------------|
| `wayland` | Adds the native Wayland backend. `-X` disables the X11 backend, but is not required for Wayland and can coexist with `wayland`. If you want Wayland only, check the current ebuild's `REQUIRED_USE` constraints. |
| `pulseaudio` | Builds the audio backend through libpulse. PipeWire can serve it through its PulseAudio compatibility layer. |
| `system-pipewire` | Uses system PipeWire for WebRTC and screencasting. This is separate from ordinary audio output. |
| `hwaccel` | Applies Gentoo preferences that force-enable accelerated rendering. The flag does not show which renderer the application is running. |
| `pgo` | Enables Profile-Guided Optimization during the build when the current version and profile allow it. Check the Portage plan; availability can change. |
| `system-*` | Selects system libraries instead of bundled copies for the corresponding libraries. The set of flags depends on the ebuild. |

`clang` selects Clang as the compiler. `jumbo-build` enables unified builds
and can increase build memory use. These and other build-time options do not
by themselves guarantee faster UI or mail handling.

## Set up mail accounts

Start with Thunderbird's account autodiscovery. Check the selected protocol,
server, and authentication method; if they are wrong, enter the values from
the provider's current documentation. IMAP keeps mail on the server and syncs
it with the client; POP uses a different storage model.

Use authentication supported by the provider. Gmail usually connects through
**Sign in with Google** and OAuth2. Use an app password only if the provider
supports it and recommends it for a mail client. Do not put passwords, OAuth
tokens, or app passwords in documentation.

Gmail stores messages sent through SMTP on its server. Check whether enabling
Thunderbird's `Place a copy in` creates duplicate Sent messages in your setup;
Google documents the option with Thunderbird's copy disabled.

## Check Wayland and runtime behavior

Open **Help → Troubleshooting Information** (`about:support`) and check
**Window Protocol**, **Compositing**, **Audio Backend**, and **Profile
Directory**. Check GPU details when investigating the graphics path.

`USE=wayland` adds a backend but does not confirm that the application uses it.
Likewise, `USE=-hwaccel` does not prevent Thunderbird from enabling WebRender
on its own, and `USE=hwaccel` does not prove that the renderer is using hardware
acceleration. Check runtime behavior in `about:support`.

## Profile and local storage

Use **Profile Directory** in `about:support` to find the profile. Neither
`~/.config/thunderbird/` nor `~/.thunderbird/` is a universal path. To check
profile size, use the actual path:

```bash
du -sh -- "/path/from/Profile Directory"
```

In **Account Settings → Synchronization & Storage**, choose which messages and
folders to keep locally. Full offline synchronization uses more disk space but
lets you read synchronized mail without a network connection. Global Search
indexes messages and uses local space for its search database; full-text
message-body search is available for synchronized messages. Choose local
storage based on available space and offline needs.

## Notifications

Mail notifications depend on Thunderbird's settings and the running desktop
notification handler. The Gentoo Thunderbird ebuild may offer
`x11-libs/libnotify` as an optional feature for desktop notifications; it is
not a mandatory dependency. Check the current ebuild and Portage plan. Sound
and visual banners can use different paths.

If an alert sound plays but no banner appears, check Thunderbird's system
notification setting, the optional feature, and the desktop notification
handler. The [desktop notifications guide](../../desktop/notifications/)
covers `libnotify`, D-Bus, and the notification server.

## Troubleshooting and verification

| Symptom | What to check |
|---------|---------------|
| The window is not using Wayland | USE `wayland`, launch context, and **Window Protocol** in `about:support`. |
| Renderer GPU use is unclear | **Compositing** and GPU details in `about:support`; `hwaccel` alone does not confirm it. |
| Audio does not work | **Audio Backend**; `pulseaudio` and `system-pipewire` control different parts of the build. |
| Sign-in or sending fails | Authentication method, server settings, and provider requirements. |
| Mail is unavailable offline or the profile is large | Message and folder synchronization in **Synchronization & Storage**. |
| No desktop banner appears | Thunderbird's notification settings and the [desktop notifications guide](../../desktop/notifications/). |

Check that the Portage plan matches the chosen capabilities, Thunderbird reports
the expected **Window Protocol**, audio works, mail can be sent and received,
and storage and notifications match the selected policy.

## Related material

- [Thunderbird automatic account configuration](https://support.mozilla.org/en-US/kb/automatic-account-configuration)
- [Add Gmail to another email client](https://support.google.com/mail/answer/7126229?hl=en)
- [IMAP synchronization](https://support.mozilla.org/en-US/kb/imap-synchronization)
- [Global Search](https://support.mozilla.org/en-US/kb/global-search)
- [Thunderbird profiles](https://support.mozilla.org/en-US/kb/profiles-where-thunderbird-stores-user-data)
- [Desktop notifications](../../desktop/notifications/)
- [Applications on ASUS B5402](../../systems/asus-b5402/applications/)
