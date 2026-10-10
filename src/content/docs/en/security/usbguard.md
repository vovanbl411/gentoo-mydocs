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
IPCAccessControlFiles=/etc/usbguard/IPCAccessControl.d/

# Audit
AuditBackend=FileAudit
AuditFilePath=/var/log/usbguard/usbguard-audit.log
```

`RuleFile` is the primary rules path. Current USBGuard versions additionally
support `RuleFolder=/etc/usbguard/rules.d/`; `RuleFile` and `RuleFolder` can
be used at the same time. The guide stays on `RuleFile` (for files in
`rules.d` see section 4).

### IPC over a Unix domain socket

> **Important:** `usbguard-daemon.conf` has no `IpAddress` / `Port` options.
> IPC is a Unix domain socket, not TCP. With such lines present, the daemon
> will not start. See
> [usbguard.github.io: Configuration](https://usbguard.github.io/documentation/configuration)
> and [RHEL 8 Security hardening: USBGuard](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/security_hardening/protecting-systems-against-intrusive-usb-devices_security-hardening).

### IPC access control

`IPCAllowedUsers` and `IPCAllowedGroups` are a legacy mechanism: the users
and groups listed there get full IPC access. That is why the baseline above
does not add the `wheel` group: root with full access is enough for
administration, and full modify access for a whole group is not a neutral
security baseline.

Grant non-root access granularly instead — via ACL files in
`/etc/usbguard/IPCAccessControl.d/` or the `usbguard add-user` command. An
ACL can separately allow `Devices=list/modify/listen`,
`Policy=list/modify`, `Exceptions=listen` and individual `Parameters`.
ACL files created manually must have mode `0600`.

An optional example of restricted access:

```bash
doas usbguard add-user <username> \
  --devices=list,modify,listen \
  --policy=list \
  --exceptions=listen
```

An ACL created via `usbguard add-user` takes effect only after restarting
`usbguard-daemon`; before the restart keep in mind the
`PresentDevicePolicy=apply-policy` effect (section 1). This is an example of
granular access, not a policy of a specific system.

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

`usbguard generate-policy` allows the devices connected at generation time,
so review the generated list before applying it.

The command `doas usbguard generate-policy > /etc/usbguard/rules.conf` is
wrong in terms of shell privilege semantics: the `>` redirection is performed
by the current user's shell before `doas` runs, so the file is opened with
the unprivileged user's permissions and the write to `/etc/usbguard/` fails
with permission denied.

Use the safe workflow instead:

```bash
# Generate basic rules from the current devices
doas usbguard generate-policy > rules.conf

# Review the generated rules before applying
less rules.conf

# Install the file with root ownership and a restrictive mode
doas install -m 0600 -o root -g root \
  rules.conf /etc/usbguard/rules.conf
```

## 6. Example rules file

This is an example policy, not a universal ruleset. Before applying, match
the rules against your devices.

```text
# Allow the keyboard and mouse
allow id 046d:c52b name "Logitech Unifying Device"
allow id 046d:c534 name "Logitech USB Receiver"

# Allow Android devices in PTP mode
allow id 0fce:71b2 name "MTP Device"

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
| `usbguard allow-device <id>` | Allow a device (runtime) |
| `usbguard block-device <id>` | Block a device (runtime) |
| `usbguard reject-device <id>` | Reject a device (runtime) |
| `usbguard list-rules` | Show the current policy |
| `usbguard append-rule "allow ..."` | Add a rule to the policy |
| `usbguard remove-rule <id>` | Remove a rule from the policy |

### Temporary vs permanent decisions

`allow-device`, `block-device` and `reject-device` without `-p` change the
device's authorization state at runtime only and do **not** persist a
device-specific rule in the policy. Such a decision does not live "until
reboot": it can lose effect earlier — on device disconnect and reconnect, a
daemon restart or a policy re-application. The main boundary here is
runtime-only versus persisted policy.

The permanent form adds the corresponding device-specific rule to the policy:

```bash
usbguard allow-device -p <id>
usbguard block-device -p <id>
usbguard reject-device -p <id>
```

For `append-rule` it is the other way round: a normal call modifies the
persistent policy, while `append-rule -t 'allow ...'` creates a temporary
rule and does not update the policy file.

### Usage examples

```bash
# View connected devices
usbguard list-devices

# Allow a device at runtime (no rule is added to the policy)
usbguard allow-device 2

# Add a permanent rule
usbguard append-rule 'allow id 046d:c52b'

# Block a device at runtime
usbguard block-device 3

# Show the current policy
usbguard list-rules
```

## 9. PAM

USBGuard does not require a custom PAM stack for its normal IPC or D-Bus
authorization path. Do not create /etc/pam.d/usbguard merely to grant
USBGuard access; use USBGuard IPC ACLs or, for the optional D-Bus bridge,
the corresponding D-Bus/Polkit authorization model.

## 10. D-Bus integration

The D-Bus bridge is an optional feature: in Gentoo `sys-apps/usbguard` is
built with the `dbus` USE flag, and a running daemon alone does not mean the
bridge is available. Authorization of D-Bus operations is a separate matter
of D-Bus/Polkit configuration.

A read-only device list query through the bridge:

```bash
busctl --system call \
  org.usbguard1 \
  /org/usbguard1/Devices \
  org.usbguard.Devices1 \
  listDevices \
  s match
```

Here `org.usbguard1` is the service name, `/org/usbguard1/Devices` is the
object path and `org.usbguard.Devices1` is the interface; the `listDevices`
method takes a string query.

## 11. Checking and monitoring

Check the daemon state and journal, the current policy, the device list and
the audit log. These commands do not mean the check has already been performed
on the ASUS B5402.

```bash
# Daemon state
systemctl status usbguard

# Current policy and device list
usbguard list-rules
usbguard list-devices

# View logs
journalctl -u usbguard -f

# View the audit log
cat /var/log/usbguard/usbguard-audit.log
```

## 12. Security recommendations

1. **ImplicitPolicyTarget=block** — the target for devices that match no
   policy rule. Allowed values are `allow`, `block` and `reject`; `block` is
   an example of a deny-by-default policy, not a value mandatory for every
   system.
2. **Update the rules regularly** — add only the devices you need.
3. **Device identity attributes** — a serial number, when present and
   reliable, makes a rule more specific, but it can be missing, incorrect or
   shared between devices. Combine the relevant attributes (`id`, `serial`,
   `name`, `via-port`, `hash`, `parent-hash`, `with-interface`) and always
   review a generated policy before applying it.
4. **Audit connections** — log connection events.

### Threat example

An unknown device is evaluated against the policy rules when inserted. If no
rule matches and `ImplicitPolicyTarget=block` is set, the device is blocked.
The exact audit record depends on the USBGuard version, the audit backend and
the device data — rely on the actual audit log rather than a specific message
format.

## 13. Rollback and recovery

Save the previous configuration and rules before the change. If the new
policy blocks devices you need, restore the old files and re-check the policy
and the device list. Do not restart USBGuard without a reason: with
`PresentDevicePolicy=apply-policy` a restart can re-apply the policy to
already connected devices.
