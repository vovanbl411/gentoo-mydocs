---
title: USBGuard on Gentoo Linux
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

USBGuard applies a policy to connected USB devices and lets you allow, block
or reject them. The guide covers the daemon configuration, the initial
policy, device management, IPC, monitoring and security aspects.

A strict policy can block a device you need. Prepare the configuration and
the initial rules before enabling the service and applying strict mode.

## 1. Before enabling

Before starting the service:

- decide which USB devices are connected now and which of them must remain
  allowed;
- check the policy path — in the example it is `/etc/usbguard/rules.conf`;
- keep in mind that `PresentDevicePolicy=apply-policy` can re-apply the
  policy to already connected devices;
- prepare a recovery path in case a wrong ruleset blocks the keyboard, mouse,
  USB storage or another device you need.

## 2. Installation

```bash
emerge -av sys-apps/usbguard
```

## 3. Daemon configuration

File: `/etc/usbguard/usbguard-daemon.conf`

```conf
# Rules file
RuleFile=/etc/usbguard/rules.conf

# Reaction to already connected and newly inserted devices
ImplicitPolicyTarget=block
PresentDevicePolicy=apply-policy
PresentControllerPolicy=keep
InsertedDevicePolicy=apply-policy
RestoreControllerDeviceState=false

# Kernel notification backend
DeviceManagerBackend=uevent

# Who may talk to the daemon over IPC (Unix domain socket)
IPCAllowedUsers=root
IPCAllowedGroups=wheel
IPCAccessControlFiles=/etc/usbguard/IPCAccessControl.d/

# Audit
AuditBackend=FileAudit
AuditFilePath=/var/log/usbguard/usbguard-audit.log
```

### IPC over a Unix domain socket

> **Important:** `usbguard-daemon.conf` has no `IpAddress` / `Port` options.
> IPC is a Unix domain socket, not TCP. With such lines present, the daemon
> will not start. See
> [usbguard.github.io: Configuration](https://usbguard.github.io/documentation/configuration)
> and [RHEL 8 Security hardening: USBGuard](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/security_hardening/protecting-systems-against-intrusive-usb-devices_security-hardening).

## 4. `.keep` files in configuration directories

The Gentoo package may leave empty `.keep_sys-apps_usbguard-0` placeholder
files to preserve directories. For USBGuard these are not configuration: a
file name in `IPCAccessControl.d` must denote a user, UID or group, and files
in `rules.d` should start with a two-digit number. A `.keep` in
`IPCAccessControl.d` triggers a warning about an incorrect name. The
same-named file in `rules.d` is not a rule and is not needed either.

If this warning appears in the journal, remove only the placeholder files:

```bash
doas rm -- \
  /etc/usbguard/IPCAccessControl.d/.keep_sys-apps_usbguard-0 \
  /etc/usbguard/rules.d/.keep_sys-apps_usbguard-0
```

> **Important:** do not delete real ACL files in `IPCAccessControl.d`, rules
> in `rules.d` or `/etc/usbguard/rules.conf`.

Do not restart USBGuard just to get rid of the warnings: with
`PresentDevicePolicy=apply-policy` a restart would re-apply the policy to
connected devices. Check the journal after the next regular boot:

```bash
doas journalctl -b -u usbguard --no-pager
```

If the `.keep` files come back after a `sys-apps/usbguard` update, report it
in the Gentoo Bugzilla: the package puts placeholder files into directories
that USBGuard processes as configuration.

## 5. Creating the initial policy

The existing example command from the document is preserved below. The shell
redirection semantics were not fixed during this migration.

```bash
# Generate basic rules from the current devices
doas usbguard generate-policy > /etc/usbguard/rules.conf
```

## 6. Example rules file

This is an example policy, not a universal ruleset. Before applying, match
the rules against your devices.

```text
# Allow the keyboard and mouse
allow id 046d:c52b serial="*" name="Logitech Unifying Device" parent-id=1:1
allow id 046d:c534 serial="*" name="Logitech USB Receiver"

# Allow Android devices in PTP mode
allow id 0fce:71b2 serial="*" name="MTP Device"

# Block all unknown devices
block
```

## 7. Enabling the service

Enable the service after preparing the configuration and the initial policy:

```bash
doas systemctl enable --now usbguard
```

## 8. Management

### Basic commands

| Command | Description |
|---------|-------------|
| `usbguard list-devices` | Show all USB devices |
| `usbguard allow-device <id>` | Allow a device |
| `usbguard block-device <id>` | Block a device |
| `usbguard reject-device <id>` | Reject a device (remove) |
| `usbguard get-policy` | Show the current policy |
| `usbguard append-rule "allow ..."` | Add a rule |
| `usbguard remove-rule <id>` | Remove a rule |

### Usage examples

```bash
# View connected devices
usbguard list-devices

# Allow a device temporarily (until reboot)
usbguard allow-device 2

# Add a permanent rule
usbguard append-rule 'allow id 046d:c52b serial="*"'

# Block a specific device
usbguard block-device 3
```

The semantics of temporary and permanent rules in these existing examples was
not verified during the structural migration.

## 9. PAM integration

The existing PAM example is preserved below. It requires separate verification
against the specific PAM policy and is not a universally safe configuration.

```bash
# Add to /etc/pam.d/usbguard
auth sufficient pam_rootok.so
auth sufficient pam_permit.so
account sufficient pam_permit.so
session sufficient pam_permit.so
```

## 10. D-Bus integration

```bash
# Manage via D-Bus
dbus-send --system --dest=org.usbguard.Daemon1 /org/usbguard/Daemon1 org.usbguard.Daemon1.ListDevices
```

## 11. Checking and monitoring

Check the daemon state and journal, the current policy, the device list and
the audit log. These commands do not mean the check has already been performed
on the ASUS B5402.

```bash
# Daemon state
systemctl status usbguard

# Current policy and device list
usbguard get-policy
usbguard list-devices

# View logs
journalctl -u usbguard -f

# View the audit log
cat /var/log/usbguard/usbguard-audit.log
```

## 12. Security recommendations

The existing recommendations are preserved below. The `DefaultPolicy=block`
wording is not unified with `ImplicitPolicyTarget=block` from the main
configuration and needs a future content audit.

1. **DefaultPolicy=block** — block all unknown devices
2. **Update the rules regularly** — add only the devices you need
3. **Use serial numbers** — for unique identification
4. **Audit connections** — log all events

### Threat example

```text
# An attacker plugs in a Rubber Ducky
# USBGuard will block it and write to the log:
type=DEVICE_ADDED id=05ac:024f serial="..." name="USB Keyboard"
target=block policy_id=1
```

## 13. Rollback and recovery

Save the previous configuration and rules before the change. If the new
policy blocks devices you need, restore the old files and re-check the policy
and the device list. Do not restart USBGuard without a reason: with
`PresentDevicePolicy=apply-policy` a restart can re-apply the policy to
already connected devices.
