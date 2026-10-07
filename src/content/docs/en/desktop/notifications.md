---
title: Desktop notifications
kind: guide
scope: general
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

This guide helps check desktop notification delivery in a Wayland session:
from the application through a client library and D-Bus to the shell. Run the
commands as the regular user in the active desktop session; you need `gdbus`
and, for the libnotify test, `notify-send`.

The 2026-10-07 date applies to the explicitly marked ASUS B5402 results below,
supplied by the user. Final Portage migration verification remains unconfirmed.

## 1. Desktop notification stack

For applications using libnotify, the path to Noctalia looks like this:

```text
application
    ↓
libnotify
    ↓
org.freedesktop.Notifications
    ↓
Noctalia
```

The application decides when to send a notification; the library passes the
request; the notification daemon displays it. Application sound alone does
not prove that a visual notification reached the daemon. Other applications
may call D-Bus directly or use the portal API.

## 2. org.freedesktop.Notifications

Ordinary Freedesktop desktop notifications use the session D-Bus service
`org.freedesktop.Notifications` and object path `/org/freedesktop/Notifications`.
The `Notify` method sends a notification, while `GetServerInformation` returns
the server name, vendor, version, and supported specification version.
See the [Desktop Notifications Specification](https://specifications.freedesktop.org/notification/latest/protocol.html).

This is a different interface from `org.freedesktop.portal.Notification` and
its backend `org.freedesktop.impl.portal.Notification`. Portal Notification
belongs to the [XDG Desktop Portal API](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Notification.html).
Choosing a Notification backend in `xdg-desktop-portal` does not determine
the owner of `org.freedesktop.Notifications`. Portal backend selection is
covered in [Wayland portals](../wayland-portals/).

## 3. The notification daemon's role

The notification daemon serves the standard notification service. A shell,
including Noctalia, can perform this role; it does not require a separate
daemon. Check who actually serves the D-Bus name, and do not start a second
daemon just to have a package named `notification-daemon`.

If a request arrives but the notification is hidden, check DND and display
settings in the current daemon.

## 4. libnotify and applications

[libnotify](https://gnome.pages.gitlab.gnome.org/libnotify/) is a client
library for desktop notifications, not a daemon. In Gentoo it is
`x11-libs/libnotify`; the `x11-libs` category prefix alone does not mean that
an application must run through X11.

On ASUS B5402, Thunderbird 157.0 requires libnotify for the verified system
notification path. The ebuild offers it as an optional feature, so having
Thunderbird installed does not guarantee the library is present. Account
settings and application diagnostics are in the [Thunderbird guide](../../settings/thunderbird/).

## 5. Noctalia on the reference system

Verified on ASUS ExpertBook B5402 / Gentoo / Niri on 2026-10-07:

- Noctalia serves `org.freedesktop.Notifications` and returns
  `('noctalia', 'noctalia-dev', '5.2.1', '1.2')`.
- DND is off; a direct external D-Bus notification is displayed — PASS.
- After installing libnotify, Thunderbird sends `Notify`, and Noctalia
  displays a visual notification — PASS.

This is an example of a working stack, not a requirement to use Noctalia on
all systems. Machine details are in the [Noctalia system entry](../../systems/asus-b5402/desktop/noctalia/).

## 6. Portage integration

The package dependency chain for integration with Noctalia:

```text
x11-libs/libnotify
    ↓
virtual/notification-daemon
    ↓
gui-apps/noctalia
```

As checked on 2026-10-07, libnotify has
`PDEPEND="virtual/notification-daemon"`, but `virtual/notification-daemon-0::gentoo`
does not recognize Noctalia as a provider. The resolver attempted to add
`x11-misc/notification-daemon`, `libXcursor`, `gtk+[X]`, and `cairo[X]` — an
unsuitable fallback for the accepted pure Wayland configuration.

The noctalia-overlay provides `virtual/notification-daemon-0-r1`: it preserves
upstream semantics and adds `gui-apps/noctalia` to the fallback provider
OR-group with `-gnome -kde`. The implementation and setup instructions are
maintained in the [noctalia-overlay README](https://github.com/vovanbl411/noctalia-overlay/blob/main/README.md).

**Pending migration:** final live resolver PASS after removing temporary
`package.provided` has not been supplied. The local virtual is not yet recorded
as accepted integration on the reference machine. A temporary entry in
`/etc/portage/profile/package.provided` is a diagnostic workaround that
substitutes for satisfying the dependency; it is not the recommended final
state. It must no longer be used after migration to the local virtual.

On the reference workstation, `x11-libs/libnotify` is installed as an explicit
world package: the current Thunderbird ebuild has no mandatory `RDEPEND` on
it and only reports `optfeature "desktop notifications" x11-libs/libnotify`.

## 7. Verification

Check the server in the current user session:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

On the verified ASUS B5402, expect the tuple from section 5. The name and
version may differ on another system. Then check the libnotify client path:

```bash
notify-send "Notification test" "libnotify → desktop daemon"
```

With DND off, a visual notification should appear. This test does not verify
the notification policy for mail accounts.

Inspect the Portage plan without installing packages:

```bash
emerge -pv virtual/notification-daemon
emerge -pv --tree x11-libs/libnotify
```

Accepting the local virtual requires both resolver outputs after removing the
temporary entry and confirmation that `/etc/portage/profile/package.provided`
is no longer used:

- `virtual/notification-daemon-0-r1::noctalia-overlay` is selected.
- Installed `gui-apps/noctalia` satisfies the provider dependency.
- Neither `x11-misc/notification-daemon` nor `libXcursor` is required.
- There is no requirement to enable `USE=X` for `gtk+` or `cairo`.

## 8. Troubleshooting

For applications using the ordinary Freedesktop notification path, observe
request delivery, then trigger a test notification:

```bash
dbus-monitor --session \
  "interface='org.freedesktop.Notifications',member='Notify'"
```

If no `Notify` appears, check application settings, its client backend, and
runtime libraries. A successful external daemon test does not confirm that
the application backend works. If `Notify` is visible but no banner appears,
check the service owner, DND, and display settings. For portal applications,
the absence of a direct `Notify` from the application alone does not prove a
failure: check the selected portal path.

## 9. Related docs

- [Noctalia](../noctalia-shell/) — shell installation and configuration.
- [Wayland portals](../wayland-portals/) — the separate portal path.
- [Thunderbird](../../settings/thunderbird/) — account selection and mail acceptance.
