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

- Running Noctalia reports version `5.2.1` (2026-10-07).
- `GetServerInformation` returns `noctalia / noctalia-dev / 5.2.1 / 1.2`:
  Noctalia owns `org.freedesktop.Notifications`.
- DND is off; an external D-Bus notification is displayed — PASS.
- Migration to `virtual/notification-daemon-0-r1::noctalia-overlay` is pending:
  final resolver PASS without temporary `package.provided` has not been
  supplied. See the [notification guide](../../../../desktop/notifications/) for criteria.

The following details retain their previous verification dates; they were not
re-checked on 2026-10-07:

- USE includes `jemalloc` — a deliberate runtime memory-allocation policy for
  the long-running shell.
- The `~/.config/noctalia/config.toml` file exists.
- The `~/.local/state/noctalia/settings.toml` file exists.
- The contents of both TOML files were not checked in this audit.

## Package source

The public [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
is enabled in Portage. Its structure, setup, and update policy are described
in the `noctalia-overlay` README. The overlay tracks stable releases only.
Release automation checks the new release, prepares a candidate ebuild and
Manifest, updates version rotation, and opens a Draft PR. Merge is performed
manually after review and runtime validation; the package is not installed
automatically on the workstation.

The 2026-09-30 check confirmed package 5.2.0 from `noctalia-overlay` and
`USE=jemalloc`; the 2026-10-07 check confirmed running service version 5.2.1,
without a new package metadata audit.

## Configuration

`~/.config/noctalia/config.toml` and
`~/.local/state/noctalia/settings.toml` are present on the system. The general
configuration model is described in the Noctalia guide; the 2026-09-23 check
confirmed only that the files exist, not their contents.

## Keyword policy

File: `/etc/portage/package.accept_keywords/noctalia`

```text
gui-apps/noctalia                ~amd64
dev-cpp/sdbus-c++                ~amd64
```

The rules reflect the Portage plan on the verification date. Before removing
or extending the list, repeat `emerge --pretend` for the current version.

## Verification

```bash
noctalia --version
cat /var/db/pkg/gui-apps/noctalia-*/repository
```

Check the service version in the current desktop session:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

Confirmed result on 2026-10-07:

```text
('noctalia', 'noctalia-dev', '5.2.1', '1.2')
```

An external `Notify` call displayed a visual notification — PASS. This does
not check user TOML contents; the 2026-09-23 check confirmed only the presence
of `config.toml` and `settings.toml`.

## History

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
