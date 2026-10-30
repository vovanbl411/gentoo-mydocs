---
title: doas policy on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

In `/etc/doas.conf`, `:wheel` has one rule with both `persist` and `keepenv`.
There is no separate rule for an individual user or for `snapper`; `snapper`
uses the same `:wheel` policy. Fingerprint authentication remains local to
`/etc/pam.d/doas`; the shared `system-auth` stack does not call
`pam_fprintd.so`.

## Configuration

File: `/etc/doas.conf`

The active rule is:

```text
permit persist keepenv :wheel
```

Both options are in one rule because `doas` applies the last matching rule and
does not merge options across rules. Details are covered in the
[general doas guide](../../../../security/doas-configuration/).

## Fingerprint authentication

In the service-local `/etc/pam.d/doas`, the `auth` stack tries
`pam_fprintd.so` with the `sufficient` control before including `system-auth`.
The `account` and `session` stacks also include `system-auth`. The shared
`/etc/pam.d/system-auth` file does not call `pam_fprintd.so`. The [ELAN
fingerprint system page](../../hardware/fingerprint/) describes the device and
its integrations.

## Related docs

- [doas configuration](../../../../security/doas-configuration/) — general
  options and rule semantics.
- [ELAN fingerprint on ASUS B5402](../../hardware/fingerprint/) — device state
  and integrations.
