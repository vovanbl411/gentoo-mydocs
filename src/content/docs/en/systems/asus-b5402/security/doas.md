---
title: doas policy on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Current state

- The `wheel` group runs commands with `persist`.
- The environment is preserved for the local user.
- Running `snapper` is permitted separately.

## Configuration

The active configuration is `/etc/doas.conf` on the machine. The exact lines
are not published: the user name is not disclosed.

## Verification

- The policy was confirmed by checking `/etc/doas.conf` on 2026-09-22.

## Related docs

- [doas: configuration](../../../../security/doas-configuration/) — general
  configuration and options.
