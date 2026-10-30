---
title: "KeePassXC Quick Unlock: QMap error during polkit authentication"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current fix

The error `Marshalling failed: Unregistered type QMap<QString,QString> passed in arguments` occurred in Linux Quick Unlock on `app-admin/keepassxc-2.8.0_pre20260629-r1`: KeePassXC did not register `QMap<QString, QString>` as a D-Bus metatype before calling polkit.

The current Gentoo `app-admin/keepassxc-2.8.0` ebuild already includes the required registration. It applies `keepassxc-2.8.0-polkit-register-details.patch`, which calls `qDBusRegisterMetaType<QMap<QString, QString>>()`. If you have the old snapshot installed, update to `app-admin/keepassxc-2.8.0`. Do not carry over the local patch for the snapshot: it remains in a directory scoped to `2.8.0_pre20260629-r1` and is not part of the current setup.

## Error history

### Symptom and cause

On `2.8.0_pre20260629-r1`, Linux Quick Unlock failed with:

```text
Failed to authenticate with Quick Unlock: Polkit returned an error:
Marshalling failed: Unregistered type QMap<QString,QString> passed in arguments
```

The snapshot build was based on upstream commit [`ce28e2afb7a59ab5c4b64512b7119eec4a9f2008`](https://github.com/keepassxreboot/keepassxc/commit/ce28e2afb7a59ab5c4b64512b7119eec4a9f2008). KeePassXC could not marshal the `details` argument for the polkit `CheckAuthorization` call because Qt did not know `QMap<QString, QString>` as a D-Bus metatype. The error occurred inside KeePassXC before polkit/PAM authentication, so a fingerprint reader and polkit that worked in other scenarios did not prevent it.

The polkit settings did not cause this error: policy `/usr/share/polkit-1/actions/org.keepassxc.KeePassXC.policy` was present, and action `org.keepassxc.KeePassXC.unlockDatabase` used `implicit active: auth_self`.

The failure occurred earlier, while KeePassXC serialized the `details` argument.

### Old workaround for `2.8.0_pre20260629-r1`

The local Portage patch for the snapshot added
`qDBusRegisterMetaType<QMap<QString, QString>>()` to polkit type registration.
The old file was:
`/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1/01-fix-quick-unlock-qmap-dbus.patch`.

After rebuilding the snapshot with the local patch, Quick Unlock worked again through polkit and `pam_fprintd`.

This workaround applies only to `2.8.0_pre20260629-r1`; Gentoo `2.8.0` already includes the fix in its ebuild.

## Verify Quick Unlock

When Quick Unlock starts, KeePassXC should request polkit authentication. Check that polkit completes the configured fingerprint or password authentication and that `Unregistered type QMap<QString,QString>` no longer appears.

For an auditd check of the polkit path, successful fingerprint authentication by the polkit helper looks like this:

```text
op=PAM:authentication grantors=pam_fprintd acct="<user>" exe="/usr/lib/polkit-1/polkit-agent-helper-1" res=success
```

`<user>` is a placeholder for the local account name. This record confirms PAM authentication by the helper, but does not by itself prove that Quick Unlock succeeded; check the result in KeePassXC as well.

## References

- [KeePassXC upstream PR #13848](https://github.com/keepassxreboot/keepassxc/pull/13848)
- [KeePassXC upstream PR #13089](https://github.com/keepassxreboot/keepassxc/pull/13089)
- [ELAN 04f3:0c77 fingerprint reader guide](../../hardware/elan-fingerprint-04f3-0c77/)
- [ASUS B5402 fingerprint state](../../systems/asus-b5402/hardware/fingerprint/)
