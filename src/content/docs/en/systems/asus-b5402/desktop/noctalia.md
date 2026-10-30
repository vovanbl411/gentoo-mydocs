---
title: Noctalia v5 on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

This page records the state of Noctalia on the reference system. Installation,
updates, and the general configuration model are described in
[`desktop/noctalia-shell.md`](../../../../desktop/noctalia-shell/).

## Current state

Noctalia is the desktop shell and notification handler. Applications can send
notifications to it through the `x11-libs/libnotify` library.
`gui-apps/noctalia` is installed from [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
with USE `jemalloc`.

The installed `virtual/notification-daemon::noctalia-overlay` virtual package
lets Portage recognize Noctalia as a notification provider; the virtual package
itself starts nothing. Delivery and its verification are described in the
[notifications guide](../../../../desktop/notifications/).

## Package source

The public [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
is enabled in Portage. Its structure, setup, and update policy are described
in the `noctalia-overlay` README. The overlay tracks stable releases only.

## Configuration

`~/.config/noctalia/config.toml` and
`~/.local/state/noctalia/settings.toml` are present on the system. The general
configuration model is described in the Noctalia guide; the 2026-09-23 check
confirmed only that the files exist, not their contents.

## Keyword policy

Historical file at the previous check: `/etc/portage/package.accept_keywords/noctalia`

```text
gui-apps/noctalia                ~amd64
dev-cpp/sdbus-c++                ~amd64
```

The rules reflect the Portage plan on the verification date. Before removing
or extending the list, repeat `emerge --pretend` for the current version.

## Verification

Installed package sources were checked on 2026-10-30; Noctalia notification
delivery under Umbriel was not tested separately.

```bash
noctalia --version
cat /var/db/pkg/gui-apps/noctalia-*/repository
```

The first command shows the Noctalia version; the second shows the installed
package repository (`noctalia-overlay`). To see who displays notifications
in the current session, run:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

If Noctalia displays notifications, the server name in the response is
`noctalia`. Result under Niri on 2026-10-07:

```text
('noctalia', 'noctalia-dev', '5.2.1', '1.2')
```

An external `Notify` call displayed a visual notification — PASS. This does
not check user TOML contents; the 2026-09-23 check confirmed only the presence
of `config.toml` and `settings.toml`.

## History

The 2026-09-30 check confirmed package 5.2.0 from `noctalia-overlay` and
`USE=jemalloc`; the 2026-10-07 check confirmed running service version 5.2.1,
without a new package metadata audit.

Version `5.0.1` replaced Noctalia Shell `4.7.7`. After moving to the GURU
package, the former local `/var/db/repos/noctalia-local` overlay and its entry
in `/etc/portage/repos.conf/` were removed. The current `noctalia-overlay` is
a separate public overlay created later: the candidate was checked with
`emerge --pretend` on 2026-09-15, then
`gui-apps/noctalia-5.1.0::noctalia-overlay` replaced `5.0.1::guru` with
`USE="jemalloc"` on 2026-09-22.

## Related docs

- [Noctalia v5 for Niri](../../../../desktop/noctalia-shell/) — installation,
  updates, configuration model.
