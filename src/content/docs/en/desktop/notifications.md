---
title: Desktop notifications
kind: guide
scope: general
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

Noctalia displays desktop notifications. An application sends it a message
through D-Bus, the message bus within the user session. The `libnotify`
library helps applications send these messages.

Below are the library installation, Noctalia's integration with Portage and
troubleshooting steps for missing notifications. Run the checks as the regular
user in the graphical session.

## 1. How delivery works

For an application using libnotify, the path looks like this:

```text
application → libnotify → D-Bus → Noctalia → notification on screen
```

Noctalia acts as the notification handler. You do not need to start a separate
`notification-daemon` alongside it. Sound and the visual message can be sent
through different paths: hearing a sound does not mean the application sent
a request to display a notification.

## 2. Installing libnotify and integrating with Portage

In Gentoo, the library is `x11-libs/libnotify`. The `x11-libs` category does
not force applications to run through X11: the library sends D-Bus messages
and works with Wayland.

Thunderbird offers libnotify as an optional feature. To receive desktop mail
notifications, install the library explicitly:

```bash
doas emerge --ask x11-libs/libnotify
```

To let Portage recognize Noctalia as a notification handler,
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay) supplies the
virtual package `virtual/notification-daemon`. It starts nothing itself:
it declares a dependency on a program providing the required function.

Enable the overlay using its README and inspect the plan:

```bash
emerge -pv virtual/notification-daemon
emerge -pv --tree x11-libs/libnotify
```

With USE flags `gnome` and `kde` disabled, the virtual package from
`noctalia-overlay` allows selecting the installed Noctalia. The plan should
show the source `::noctalia-overlay`; a second notification handler is not
needed. After reviewing the plan, install the virtual package if it is absent:

```bash
doas emerge --ask virtual/notification-daemon::noctalia-overlay
```

### Portage proposes X11 dependencies

If the plan adds `x11-misc/notification-daemon`, `libXcursor`, or requires
`USE=X` for GTK/cairo, check the virtual package's source and USE flags.
The standard `virtual/notification-daemon` may not recognize Noctalia and can
therefore select another handler. The overlay's version adds Noctalia to the
list of suitable programs.

If you previously added `virtual/notification-daemon` to
`/etc/portage/profile/package.provided` to work around this issue, remove only
that line and inspect the plan again. Such an entry tells Portage the dependency
is already satisfied instead of installing the actual package. Do not remove
the file's other contents.

## 3. Checking notifications

First find out which program receives the messages:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

The response should contain the server name `noctalia`, the vendor, and server
and protocol versions. If another program responds, check whether a second
notification handler is being started.

Send a test notification:

```bash
notify-send "Notification test" "Message sent through libnotify"
```

With Do Not Disturb disabled, a Noctalia banner should appear. If the test is
visible but mail notifications are missing, check
[Thunderbird settings](../../settings/thunderbird/): the application decides
which accounts and events generate notifications.

## 4. Finding the cause

If the test message is not visible, first check that Noctalia is running,
Do Not Disturb is disabled and notification display is allowed.

To watch requests from an application, run in a terminal:

```bash
dbus-monitor --session \
  "interface='org.freedesktop.Notifications',member='Notify'"
```

Then trigger an event that should display a notification, such as receiving
new mail. Stop monitoring with `Ctrl+C`.

- `Notify` appears but no banner is shown: check Noctalia's display settings
  for notifications.
- No request appears but `notify-send` works: check the application settings
  and whether libnotify is installed, if the application uses that library.
- `GetServerInformation` cannot find the server: check Noctalia's startup
  and log.

Some applications send notifications directly through D-Bus; sandboxed
applications may use the portal. The absence of a call specifically from
libnotify is not an error for these applications.

## 5. Notifications and portals

The ordinary notification handler uses the D-Bus name
`org.freedesktop.Notifications`. The portal offers a different interface:
`org.freedesktop.portal.Notification`.

Choosing a Notification backend in `portals.conf` does not select the program
owning `org.freedesktop.Notifications`. Changing the portal backend therefore
does not replace starting Noctalia. Other portal settings are described in
the [separate guide](../wayland-portals/).

## Related material

- [Noctalia — installation and configuration](../noctalia-shell/)
- [Noctalia on ASUS B5402](../../systems/asus-b5402/desktop/noctalia/)
- [Notification specification](https://specifications.freedesktop.org/notification/latest/protocol.html)
- [libnotify](https://gnome.pages.gitlab.gnome.org/libnotify/)
