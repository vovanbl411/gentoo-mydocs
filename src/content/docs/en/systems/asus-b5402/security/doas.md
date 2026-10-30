---
title: doas policy on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

On the ASUS B5402, `doas` rules are defined in `/etc/doas.conf`: the `wheel`
group has a `persist` rule, the local user has a separate `keepenv` rule, and
`snapper` has its own command-specific rule with `persist`. Fingerprint
authentication is configured in `/etc/pam.d/doas`; the shared `system-auth`
stack does not call `pam_fprintd.so`.

## Configuration

File: `/etc/doas.conf`

The active rules, with the username redacted, are:

```text
permit persist :wheel
permit keepenv <username>
permit persist :wheel as root cmd snapper
```

The `snapper` rule does not use `nopass`. It names the command `snapper`, whose
executable is installed at `/usr/bin/snapper`. The meanings of `persist`,
`keepenv`, and `nopass`, and last-match rule semantics, are covered in the
[general doas guide](../../../../security/doas-configuration/).

## Fingerprint authentication

The service-local `/etc/pam.d/doas` stack lists `pam_fprintd.so` with the
`sufficient` control, followed by `system-auth` for authentication. The account
and session stacks also include `system-auth`. The shared
`/etc/pam.d/system-auth` file does not call `pam_fprintd.so`. The [ELAN
fingerprint system page](../../hardware/fingerprint/) describes the device and
its integrations.

## Related docs

- [doas configuration](../../../../security/doas-configuration/) — general
  options and rule semantics.
- [ELAN fingerprint on ASUS B5402](../../hardware/fingerprint/) — device state
  and integrations.
