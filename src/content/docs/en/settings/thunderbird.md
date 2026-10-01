---
title: "Thunderbird: native Gentoo and Wayland"
kind: guide
scope: general
status: current
last_verified: "2026-10-01"
verified_on: [asus-b5402]
---

Thunderbird from Gentoo fits a Wayland-first desktop with several IMAP
providers. When setting it up, check build-time capabilities separately from
the application's actual runtime behavior: USE flags alone do not confirm
Wayland, rendering, or the audio backend.

The choices below describe the ASUS ExpertBook B5402 reference system. They
show one verified setup; Portage rules and local mail storage size are not
universal Gentoo recommendations.

## Build policy

The checked resolver output for `mail-client/thunderbird-157.0` shows:

| Choice | Value and meaning |
|--------|-------------------|
| Wayland | `wayland` enables the native Wayland backend. The reference system also selects `-X` as a deliberate pure Wayland policy; it is not required for the Wayland backend itself. |
| Audio | `pulseaudio` adds the audio backend through libpulse. At runtime, the PipeWire/PulseAudio-compatible stack serves it. `system-pipewire` is not required for this and is disabled in the resolver output. |
| Rendering | `-hwaccel` does not prevent the runtime from using WebRender. Do not force hardware-acceleration support when runtime verification already shows WebRender. |
| System libraries | The resolver output enables `system-av1`, `system-harfbuzz`, `system-jpeg`, `system-libevent`, `system-librnp`, `system-libvpx`, and `system-webp`. |
| PGO | `pgo` is masked by the current profile and is not enabled. Do not describe this build as a PGO build. |

The resolver also shows `clang`, `hardened`, and `jumbo-build`. These describe
the current build; they do not mean that the interface or mail handling will
automatically become faster.

On the reference system, the heavy build is assigned `p-cores ssd`:

```text
mail-client/thunderbird → p-cores ssd
```

`p-cores` sets CPU affinity for the build, while `ssd` directs the large build
tree to the SSD-backed `PORTAGE_TMPDIR` (`/var/tmp/portage-disk` on Btrfs)
instead of tmpfs. This is a local choice for a heavy Mozilla build, not a
general Gentoo requirement.

## Provider setup

The reference setup uses six IMAP accounts: four Gmail accounts, one Yandex
account, and one Mail.ru account. Do not put email addresses, OAuth tokens, app
passwords, or saved credentials in documentation.

| Provider | Setup |
|----------|-------|
| Gmail | IMAP `imap.gmail.com:993` with SSL/TLS and Gmail SMTP; OAuth2. Gmail stores sent mail server-side, so the reference setup disables Thunderbird's `Place a copy in` option for the Sent folder. |
| Yandex | IMAP/SMTP with an app password or another provider-supported authentication method for external clients. |
| Mail.ru | IMAP/SMTP with an external-app password or another provider-supported authentication method. |

For Yandex and Mail.ru, use the provider's current connection settings; this
example does not specify servers or ports. Sending and receiving were checked
for all six accounts.

## Runtime verification

Open **Help → Troubleshooting Information** (`about:support`) and check the
selected backend and renderer. The ASUS reference-system acceptance recorded:

| `about:support` field | Result |
|-----------------------|--------|
| Window Protocol | `wayland` |
| Desktop Environment | `niri` |
| Compositing | `WebRender` |
| GPU | Intel Iris Xe ADL GT2 through Mesa `iris` |
| Audio Backend | `pulse-rust`, served by the current PipeWire/Pulse stack |

`USE=-hwaccel` describes build capability; it does not force software
rendering. Use the runtime renderer and GPU shown in `about:support`.

## Profile and storage

Get the exact directory from **about:support → Profile Directory**. The profile
on the reference system uses this path pattern:

```text
~/.config/thunderbird/<profile>.default-release
```

The last measurement was about 648 MiB for the profile and about 574 MiB for
`ImapMail`. Full offline synchronization of all messages remains enabled:
this actual size causes no issue on this system. These sizes depend on mail
volume and are not targets for other profiles.

## Working policy

The six accounts on the reference system use these settings:

- Unified Folders are enabled; the message list is threaded and sorted by Date
  descending.
- Full offline synchronization is enabled; Global Search is enabled.
- Thunderbird's adaptive spam controls are disabled for all accounts; spam
  filtering remains with the providers.
- Remote content is blocked globally.
- Automatic destructive retention is not configured.
- End-to-End Encryption is not configured: no OpenPGP keys or S/MIME
  certificates were added. Configure it only when there is an actual workflow.
- Return Receipts: do not request outgoing receipts automatically; respond to
  incoming requests with `Ask me`.
- User notifications and sound are enabled only for two selected Gmail
  accounts; the other accounts sync without notification. The profile has
  `NTFNTF: Notify on This Folder Not That Folder` 1.3.1 installed for this.

## Acceptance checklist

- [x] Native Wayland — PASS.
- [x] WebRender — PASS.
- [x] Audio — PASS.
- [x] Sending and receiving checked for the configured providers — PASS.
- [x] Gmail stores one copy of sent mail — PASS.
- [x] Local offline store is present.
- [x] Notification for selected accounts versus silent sync for the others was
  tested — PASS.
