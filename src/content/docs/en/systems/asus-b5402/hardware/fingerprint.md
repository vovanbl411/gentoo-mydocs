---
title: ELAN fingerprint reader on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

## Current state

- Sensor: `04f3:0c77 Elan Microelectronics Corp. ELAN:ARM-M4`; its USB
  interface is Vendor Specific Class, interface 0, with no kernel driver.
- Installed packages: `dev-libs/libgusb-0.4.9`,
  `sys-auth/libfprint-1.94.7`, `sys-auth/fprintd-1.94.3-r1`.
- Portage patches: `/etc/portage/patches/sys-auth/libfprint-1.94.7/`, using
  the full 11-patch `patches/series` from Alexys829's patchset.
- `fprintd` discovery, `right-index-finger` enrollment, and subsequent
  verification: PASS.
- Noctalia v5 lockscreen fingerprint unlock: PASS.
- greetd fingerprint login: PASS.
- doas fingerprint authentication: PASS.
- polkit fingerprint authentication and password fallback: PASS.
- Shared `system-auth` was not modified; PAM integration is local to the
  relevant service files. Noctalia uses its own `fprintd`/D-Bus integration.

The state above was checked on 2026-09-27. The greetd password fallback was
not separately runtime-tested.

## Verification evidence

The doas audit record confirms successful fingerprint authentication; the local
account name is replaced with a placeholder:

```text
op=PAM:authentication grantors=pam_fprintd acct="<user>" exe="/usr/bin/doas" res=success
```

## Known observation

After a failed fingerprint match, listing returned
`Slot 0 returned status 0xff while listing`. With this firmware and patchset,
the failed listing avoids returning an incomplete set that could make
`fprintd` delete local fingerprints. The enrolled print remained available,
and later verification matched. This did not block operation.

## Related docs

- [ELAN 04f3:0c77 Gentoo guide](../../../../hardware/elan-fingerprint-04f3-0c77/)
