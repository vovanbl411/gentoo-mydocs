---
title: "KeePassXC Quick Unlock: QMap error during polkit authentication"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

## 1. Symptom

In KeePassXC `2.8.0-snapshot`, Linux Quick Unlock failed with:

```text
Failed to authenticate with Quick Unlock: Polkit returned an error:
Marshalling failed: Unregistered type QMap<QString,QString> passed in arguments
```

The tested system had `app-admin/keepassxc-2.8.0_pre20260629-r1` and
`sys-apps/keyutils-1.6.3-r1` installed. The policy file
`/usr/share/polkit-1/actions/org.keepassxc.KeePassXC.policy` was present;
`pkaction` reported `implicit active: auth_self` for action
`org.keepassxc.KeePassXC.unlockDatabase`. The fingerprint reader and polkit
already worked in other scenarios. The error occurred before polkit/PAM
authentication.

## 2. Cause

This Gentoo ebuild is based on upstream commit
[`ce28e2afb7a59ab5c4b64512b7119eec4a9f2008`](https://github.com/keepassxreboot/keepassxc/commit/ce28e2afb7a59ab5c4b64512b7119eec4a9f2008).
Its Linux Quick Unlock code does not register `QMap<QString, QString>` as a
D-Bus metatype. As a result, the polkit `CheckAuthorization` call cannot
marshal its `details` argument: KeePassXC fails before fingerprint
authentication begins.

[Upstream PR #13089](https://github.com/keepassxreboot/keepassxc/pull/13089)
includes a separate fix for this error that registers the type.

## 3. Fix

For **this exact package version**, use a local Portage user patch. Portage
applies it during a normal rebuild; PAM and polkit rules are unaffected.

Directory: `/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1/`.

File: `/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1/01-fix-quick-unlock-qmap-dbus.patch`.

Create the file in `bash`. The `sed` command adds a space to the empty line
inside the diff, marking it as unchanged context so the patch applies:

```bash
patch_dir=/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1
doas install -d "$patch_dir"
sed 's/^$/ /' <<'EOF' | doas tee "$patch_dir/01-fix-quick-unlock-qmap-dbus.patch" >/dev/null
--- a/src/quickunlock/Polkit.cpp
+++ b/src/quickunlock/Polkit.cpp
@@ -48,6 +48,7 @@ Polkit::Polkit()
 {
     PolkitSubject::registerMetaType();
     PolkitAuthorizationResults::registerMetaType();
+    qDBusRegisterMetaType<QMap<QString, QString>>();

     /* Note we explicitly use our own dbus path here, as the ::systemBus() method could be overridden
        through an environment variable to return an alternative bus path. This bus could have an application
EOF
```

Then rebuild the package through Portage:

```bash
doas emerge --ask --oneshot --rebuild =app-admin/keepassxc-2.8.0_pre20260629-r1
```

## 4. Verification

Retry KeePassXC Quick Unlock with a fingerprint. On the ASUS ExpertBook B5402,
unlocking succeeded after the rebuild. An audit record confirmed that the
polkit helper authenticated the user through `pam_fprintd`:

```text
op=PAM:authentication grantors=pam_fprintd acct="<user>" exe="/usr/lib/polkit-1/polkit-agent-helper-1" res=success
```

Polkit reported successful one-shot authorization for the action initiated by
the KeePassXC process:

```text
successfully authenticated as unix-user:<user>
to gain ONE-SHOT authorization for action
org.keepassxc.KeePassXC.unlockDatabase
```

`<user>` replaces the local account name. Successful Quick Unlock and these
records confirm the KeePassXC → polkit → PAM → fingerprint path.

## 5. Rollback / maintenance

After a KeePassXC upgrade, check whether the new source includes
`qDBusRegisterMetaType<QMap<QString, QString>>()`. If the upstream fix is
included, remove the local patch and rebuild the package without it. The
version-scoped directory does not apply to other KeePassXC versions; do not
carry the patch forward without checking.

To roll back this version, remove the named patch and rebuild the same package.
This restores the original Quick Unlock behavior; the fingerprint and polkit
configuration remain independent of this patch.

## 6. References

- [KeePassXC upstream PR #13089](https://github.com/keepassxreboot/keepassxc/pull/13089)
- [ELAN fingerprint reader guide](../../hardware/elan-fingerprint-04f3-0c77/)
- [ASUS B5402 fingerprint state](../../systems/asus-b5402/hardware/fingerprint/)
