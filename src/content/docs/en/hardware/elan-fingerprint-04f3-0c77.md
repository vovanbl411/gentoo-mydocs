---
title: ELAN fingerprint reader 04f3:0c77 on Gentoo
kind: guide
scope: general
status: current
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

The ELAN:ARM-M4 fingerprint reader with USB ID `04f3:0c77` works on Gentoo
with `fprintd` after applying the 11-patch series from
[Alexys829/elan-0c77-libfprint](https://github.com/Alexys829/elan-0c77-libfprint)
to Gentoo's `sys-auth/libfprint` package. Enrollment and verification were
confirmed on an ASUS ExpertBook B5402. Stock `libfprint-1.94.7` does not
support this device.

## Applicability

This procedure applies to the USB device reported as:

```text
04f3:0c77 Elan Microelectronics Corp. ELAN:ARM-M4
```

On the tested system, its USB interface is Vendor Specific Class, interface 0,
with no kernel driver. The fingerprint stack was absent before setup. The
procedure was verified on Gentoo on an ASUS ExpertBook B5402; other systems
with the same USB ID have not been checked.

## Install Gentoo packages

Install the packaged dependencies through Portage:

```bash
doas emerge --ask dev-libs/libgusb sys-auth/libfprint sys-auth/fprintd
```

The tested versions were `dev-libs/libgusb-0.4.9`,
`sys-auth/libfprint-1.94.7`, and `sys-auth/fprintd-1.94.3-r1`.

## Apply the libfprint patchset

Gentoo's user patch mechanism keeps the change outside the package source and
applies it during a normal Portage build. The directory is scoped to
`libfprint-1.94.7`:

```text
/etc/portage/patches/sys-auth/libfprint-1.94.7/
```

Clone the patchset, inspect `patches/series`, and confirm it lists all 11
patches in the supplied order. Copy the complete contents of `patches/`,
including `series`, into the version-scoped Portage directory:

```bash
git clone https://github.com/Alexys829/elan-0c77-libfprint.git /tmp/elan-0c77-libfprint
cat /tmp/elan-0c77-libfprint/patches/series
doas install -d /etc/portage/patches/sys-auth/libfprint-1.94.7
doas cp -a /tmp/elan-0c77-libfprint/patches/. /etc/portage/patches/sys-auth/libfprint-1.94.7/
```

Keep the order from `patches/series`. The tested build applied the full series
successfully. No upstream commit SHA is recorded here.

Rebuild the package through Portage:

```bash
doas emerge --ask --oneshot =sys-auth/libfprint-1.94.7
```

Do not install a manually built library into `/usr`; Portage must own the
installed package and apply the user patchset.

## Enroll and verify

Confirm that `fprintd` sees the sensor, then enroll and verify a finger. Replace
`YOUR_USER` with the account being enrolled:

```bash
fprintd-list YOUR_USER
fprintd-enroll -f right-index-finger YOUR_USER
fprintd-verify -f right-index-finger YOUR_USER
```

On the tested system, `fprintd` reported:

```text
found 1 devices
Device at /net/reactivated/Fprint/Device/0
Elan MOC Sensors
```

Enrollment of `right-index-finger` succeeded. Verification first returned
`verify-retry-scan` and `verify-no-match` after an unsuccessful scan; later
checks returned `verify-match` twice.

### Known observation

After a failed match, this message was observed:

```text
Failed to query prints: Slot 0 returned status 0xff while listing
```

With this firmware and patchset, listing can fail safely instead of returning
an incomplete fingerprint list. This prevents `fprintd` from treating local
fingerprints as absent and deleting them. The enrolled fingerprint remained
available and later verification matched. This is a known observation, not a
blocker.

## Desktop and authentication integrations

Configure only the PAM service or application that needs fingerprint
authentication. Keep the ordinary password path available.

### Noctalia lockscreen

Noctalia v5 uses its own `fprintd`/D-Bus integration for the lockscreen. The
lockscreen was confirmed to unlock with a fingerprint. No `pam_fprintd` entry
is needed for this integration.

### greetd and tuigreet

For a `greetd + tuigreet → niri-session` login, add fingerprint auth at the
start of `/etc/pam.d/greetd`, before the existing `login` stack:

```text
auth            sufficient      pam_fprintd.so timeout=10
auth            include         login
account         include         login
password        include         login
session         include         login
```

Fingerprint login was confirmed on the tested system. The `login` include
remains after the fingerprint line; password fallback was not separately
runtime-tested there.

### doas

Add fingerprint auth locally to `/etc/pam.d/doas`, before the existing
`system-auth` stack:

```text
#%PAM-1.0
auth            sufficient      pam_fprintd.so timeout=10
auth            include         system-auth
account         include         system-auth
session         include         system-auth
```

Fingerprint authentication through `doas` was confirmed. Keep this change in
the `doas` service file; do not add `pam_fprintd` to the shared `system-auth`
stack for this integration.

### polkit

Create a local PAM override at `/etc/pam.d/polkit-1`; leave the vendor file
`/usr/lib/pam.d/polkit-1` unchanged:

```text
#%PAM-1.0

auth       sufficient   pam_fprintd.so timeout=10
auth       include      system-auth
account    include      system-auth
password   include      system-auth
session    include      system-auth
```

The vendor polkit admin rule selects `unix-user:0` (root). If the enrolled
fingerprint belongs to a regular interactive account, add a local rule at
`/etc/polkit-1/rules.d/49-local-admin.rules` to select that account:

```js
polkit.addAdminRule(function(action, subject) {
    return ["unix-user:YOUR_USER"];
});
```

Replace `YOUR_USER` with the intended local administrator account. This changes
polkit's administrator identity policy; it is more than a fingerprint prompt
adjustment. Review the access consequences before applying it. On the tested
system, polkit fingerprint authentication, password fallback, and
`pkexec /usr/bin/id` were confirmed.

## Verification

Check device discovery and enrollment with `fprintd-list`,
`fprintd-enroll`, and `fprintd-verify` as shown above. Then test each configured
integration directly: the Noctalia lockscreen, greetd fingerprint login,
`doas`, and a polkit action. Test password fallback separately for each PAM
service if it is a requirement; a successful fingerprint result does not
prove fallback behavior.

## Rollback

Before editing PAM files or the polkit rule, save their current contents and
keep an administrative session open.

- Remove the `pam_fprintd.so` line from `/etc/pam.d/greetd` or
  `/etc/pam.d/doas` to disable that service integration.
- Remove the local `/etc/pam.d/polkit-1` override and
  `/etc/polkit-1/rules.d/49-local-admin.rules` to return polkit to its vendor
  PAM file and administrator rule.
- To remove device support, remove the version-scoped patch directory and
  force a Portage rebuild:

  ```bash
  doas emerge --ask --oneshot --rebuild =sys-auth/libfprint-1.94.7
  ```

  The unpatched package does not support `04f3:0c77`.
- Remove the enrolled print with `fprintd-delete -f right-index-finger
  YOUR_USER` if it is no longer needed.

## References

- [ELAN 04f3:0c77 libfprint patchset](https://github.com/Alexys829/elan-0c77-libfprint)
- [ELAN fingerprint discussion](https://github.com/depau/elanpoc/issues/2)
- [Linux Surface discussion](https://github.com/linux-surface/linux-surface/issues/1380)
- [Gentoo Wiki: Portage](https://wiki.gentoo.org/wiki/Portage)

For the tested ASUS B5402 configuration and dated results, see the
[system fingerprint state](../../systems/asus-b5402/hardware/fingerprint/).
