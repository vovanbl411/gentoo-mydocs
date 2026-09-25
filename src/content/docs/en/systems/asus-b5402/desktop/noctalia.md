---
title: Noctalia v5 on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

This page records the state of Noctalia on the reference system. Installation,
updates, and the general configuration model are described in
[`desktop/noctalia-shell.md`](../../../../desktop/noctalia-shell/).

## Current state

- `gui-apps/noctalia-5.1.0` is installed from the `noctalia-overlay`
  repository.
- USE includes `jemalloc` — a deliberate runtime memory-allocation policy for
  the long-running shell.
- The `~/.config/noctalia/config.toml` file exists.
- The `~/.local/state/noctalia/settings.toml` file exists.
- The contents of both TOML files were not checked in this audit.

## Package source

The public [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
is enabled in Portage. Its structure, setup, and update policy are described
in the `noctalia-overlay` README. The overlay tracks stable releases only;
future automation will create an Issue for a new release and will not change
ebuilds or the installed package.

The version, repository, and `USE=jemalloc` were confirmed on 2026-09-23.

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

Expected result:

```text
noctalia v5.1.0
noctalia-overlay
```

The check confirms the binary version and the repository of the installed
package. It does not check the contents of the user's TOML configuration; the
2026-09-23 audit confirmed only the presence of `config.toml` and
`settings.toml`.

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
