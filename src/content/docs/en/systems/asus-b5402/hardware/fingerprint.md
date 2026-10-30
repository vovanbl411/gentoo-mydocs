---
title: ELAN fingerprint reader on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- The ASUS ExpertBook B5402 uses the `04f3:0c77 Elan Microelectronics Corp. ELAN:ARM-M4` reader. `sys-auth/libfprint` and `sys-auth/fprintd` support it; this device requires a hardware-specific ELAN patchset for libfprint.
- The installed `sys-auth/libfprint-1.94.7` uses `/etc/portage/patches/sys-auth/libfprint-1.94.7/` with the full 11-patch `patches/series` from Alexys829. In particular, `10-elanmoc-list-never-under-report.patch` prevents an incomplete fingerprint list from being reported as successful.
- `fprintd` detects the reader, and `right-index-finger` is enrolled for the user. The service starts on demand and is not left running after the fingerprint list is checked.
- Fingerprint authentication is configured for greetd, doas, and polkit. The polkit PAM configuration calls `pam_fprintd` first, then includes `system-auth`. Noctalia uses its own `fprintd`/D-Bus integration.
- KeePassXC Linux Quick Unlock calls polkit, where fingerprint authentication is configured. The current `app-admin/keepassxc-2.8.0` gets the required D-Bus metatype registration from the Gentoo ebuild; the separate local patch for the old snapshot is not needed for this package. For details and the error history, see [the Quick Unlock and polkit diagnosis](../../../../troubleshooting/keepassxc-quick-unlock-polkit/).

The shared PAM `system-auth` stack was not changed: `pam_fprintd` calls are configured in the individual PAM files for greetd, doas, and polkit.

## Slot read error

`Slot 0 returned status 0xff while listing` indicates a read error for one of the reader's slots. The libfprint patchset in use does not report an incomplete fingerprint list as successful, so `fprintd` cannot mistake it for a complete list and delete missing prints.

The `0xff` status alone does not explain the cause of the reader-side error.

## Related docs

- [ELAN 04f3:0c77 Gentoo guide](../../../../hardware/elan-fingerprint-04f3-0c77/)
- [KeePassXC Quick Unlock: polkit/D-Bus error](../../../../troubleshooting/keepassxc-quick-unlock-polkit/)
