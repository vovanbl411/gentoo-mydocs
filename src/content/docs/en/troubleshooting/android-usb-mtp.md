---
title: Connecting an Android phone to Gentoo Linux over USB
kind: troubleshooting
scope: general
status: current
last_verified: null
verified_on: []
---

Trace the problem by layer: USB enumeration → kernel authorization → USBGuard → userspace permissions → MTP/PTP mode → desktop or FUSE client. A failure at one layer does not by itself prove the cause at another.

## 1. Does the USB subsystem see the phone?

```bash
lsusb
doas journalctl -k -b --no-pager | grep -Ei 'usb|mtp|ptp|authorized|authorization' || true
```

If the phone is absent from `lsusb`, first check that the cable supports data, try another physical port, and connect directly instead of through a problematic hub or dock. Look in the kernel journal for enumeration errors such as `error -71`, `device descriptor read`, or `not accepting address`. MTP diagnosis is premature until the device appears at the USB layer.

## 2. Is the USB device authorized?

If the journal reports `Device is not authorized for usage`, find the device name in the kernel log or sysfs and read its state. For example, if the device is named `3-1`:

```bash
cat /sys/bus/usb/devices/3-1/authorized
```

`0` means the USB device is currently unauthorized; `1` means it is authorized. This state does not identify which policy set it. First determine whether USBGuard, a custom udev rule, or another mechanism manages it.

For USBGuard, check the service state, the device decision, and the loaded rules:

```bash
systemctl is-active usbguard.service
doas usbguard list-devices
doas usbguard list-rules
```

If USBGuard shows no decision for the phone, check custom udev rules and other local components that may change USB authorization:

```bash
grep -R -n 'authorized' /etc/udev/rules.d /usr/lib/udev/rules.d 2>/dev/null || true
```

Find the phone's internal ID and decision in `list-devices`. If it is blocked and you decide to allow this specific instance, use `doas usbguard allow-device -p <internal-id>`. The `-p` option saves a decision for that device by adding a corresponding rule to the current policy. Afterward, check `list-rules` and `list-devices`: USBGuard uses the first matching rule, so an earlier broad `block` or `reject` can prevent the new `allow` from taking effect. USBGuard rules identify a VID:PID with `id <vendor-id>:<product-id>`; `with-vid` is not valid rule syntax.

Do not bypass a running USBGuard policy by writing `authorized=1` or adding a generic udev authorization rule. Do not stop USBGuard or regenerate the entire ruleset to allow one phone. See the [USBGuard guide](../../security/usbguard/) for rule order and device decisions.

When switching a phone between charging, MTP, and ADB, its USB descriptors, interfaces, or PID may change; USBGuard may process the new configuration separately. This can explain a repeat block, but it is not universal behavior. If the problem occurs during a mode change, compare `lsusb`, `doas usbguard list-devices`, and `doas usbguard list-rules` before and after the change.

## 3. Can userspace access the device?

The Gentoo `media-libs/libmtp` udev rule assigns MTP devices to the `plugdev` group with mode `0660`. Check the user's active groups and the rule:

```bash
id
getent group plugdev
grep -R 'plugdev' /usr/lib/udev/rules.d 2>/dev/null | grep -Ei 'mtp|android|usb' || true
```

Compare those results with the group and permissions on the USB device node. This check applies to libmtp/MTP access; it is not a universal ADB requirement. ADB rules may use a different access method, so inspect the installed rule instead of adding `plugdev` by default.

In the current Gentoo tree, `mtp-detect` is provided by `media-libs/libmtp`.

## 4. Is MTP selected on the phone?

For the MTP path described here, select **File transfer / MTP**, not Photo transfer (PTP). Unlock the phone and approve data access if Android prompts for it. Keep the screen unlocked during this first check. Behavior with a locked screen depends on the device and its state, so a locked screen alone does not prove the cause of a failure.

Before running `mtp-detect`, check whether another client has opened an MTP session:

```bash
pgrep -a -f 'gvfs.*mtp|kio.*mtp|mtpfs|jmtpfs|simple-mtpfs' || true
```

A matching process is a reason to check its open session, but does not by itself prove that the client has claimed the phone. Close the session normally in its application; do not terminate processes automatically. If installed, `mtp-detect` checks userspace MTP detection by opening its own MTP session.

`PTP_ERROR_IO` and `NULL device` do not point to one cause. After the checks above, they may relate to device access, another active MTP session, the phone's mode or state, its implementation, or a client/libmtp issue. Compare them with observations from the earlier layers and the `mtp-detect` output.

## 5. Which client is opening MTP?

MTP usually has one active client at a time, so a desktop automounter and a manual FUSE client may conflict. For desktop integration, identify the framework used by the application:

- GIO/GVfs applications use the `gnome-base/gvfs[mtp]` MTP backend.
- Dolphin uses the separate KDE KIO backend from `kde-apps/kio-extras[mtp]`.
- For other file managers, check their framework documentation and available backend.

For a separate test, or if the desktop backend is unavailable, run one manual FUSE client after closing other MTP sessions. Example with `jmtpfs`:

```bash
mkdir -p ~/phone
jmtpfs ~/phone
ls ~/phone
fusermount -u ~/phone
```

Gentoo also has `sys-fs/mtpfs` and `sys-fs/simple-mtpfs`; if you choose one, check the installed client's help first. Do not run multiple MTP clients at the same time.

## ADB is a separate channel

`dev-util/android-tools` provides `adb` and `fastboot`; its `udev` USE flag pulls in `dev-util/android-udev-rules`. ADB requires USB debugging to be enabled on the phone and the computer's trust prompt to be approved. ADB is a separate management and debugging channel, not an MTP filesystem backend; `android-tools` does not provide `adbfs`.

## Sources

- Gentoo: [`media-libs/libmtp`](https://packages.gentoo.org/packages/media-libs/libmtp), [`sys-fs/mtpfs`](https://packages.gentoo.org/packages/sys-fs/mtpfs), [`sys-fs/simple-mtpfs`](https://packages.gentoo.org/packages/sys-fs/simple-mtpfs), [`sys-fs/jmtpfs`](https://packages.gentoo.org/packages/sys-fs/jmtpfs).
- Gentoo: [`gnome-base/gvfs`](https://packages.gentoo.org/packages/gnome-base/gvfs), [`kde-apps/kio-extras`](https://packages.gentoo.org/packages/kde-apps/kio-extras), [`dev-util/android-tools`](https://packages.gentoo.org/packages/dev-util/android-tools).
- Upstream: [USBGuard command](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard.1.adoc) and [USBGuard rule language](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard-rules.conf.5.adoc); [Linux USB authorization](https://docs.kernel.org/usb/authorization.html).
- Upstream: [libmtp diagnostics](https://github.com/libmtp/libmtp); Android: [file transfer over USB](https://support.google.com/android/answer/9064445) and [Android Debug Bridge](https://developer.android.com/tools/adb).
