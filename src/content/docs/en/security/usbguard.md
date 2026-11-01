---
title: USBGuard on Gentoo Linux
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

USBGuard applies a policy to USB devices: it allows, blocks or rejects them.
Prepare and review the initial rules before starting the daemon, and make sure
they preserve access to the devices you need.

> **Important:** Without a suitable policy, USBGuard can block your keyboard,
> mouse, phone, storage or another required device. Before the first start,
> prepare a recovery path that does not depend on the USB devices you plan to
> filter.

## 1. Install and create the initial policy

```bash
doas emerge -av sys-apps/usbguard
```

Create and review `/etc/usbguard/rules.conf` before the first start of
`usbguard.service`. The Gentoo ebuild explicitly warns you to create or generate
the policy before starting USBGuard to avoid locking yourself out.

`usbguard generate-policy` prints rules for devices currently connected to
standard output. Review the list and remove any devices you do not want to
trust:

```bash
doas usbguard generate-policy > rules.conf
less rules.conf

doas install -m 0600 -o root -g root \
  rules.conf /etc/usbguard/rules.conf
```

The `>` redirection creates `rules.conf` in the current directory as the
regular user; `install` copies the reviewed file to `/etc/usbguard/` with the
required permissions. Do not start the service until the policy and recovery
path are ready.

## 2. Daemon settings

File: `/etc/usbguard/usbguard-daemon.conf`

Do not replace the whole file with a template. Check the current values and
change only the settings whose behavior you need to control:

| Setting | Purpose |
|---------|---------|
| `RuleFile` | Main policy file; the initial policy above is written to `rules.conf`. |
| `RuleFolder` | Optional directory for policy fragments. Since USBGuard 1.1.3, the upstream default enables both `RuleFile` and `RuleFolder`; files in `rules.d/` are read in alphanumeric order, so use clear prefixes such as `10-` and `20-`. |
| `ImplicitPolicyTarget` | Decision for a device that matches no rule. `block` denies devices by default; a separate unconditional `block` at the end of the basic policy is not needed. |
| `PresentDevicePolicy` | Decision for devices already connected when the daemon starts. `apply-policy` checks them against the policy again and can change their authorization state. |
| `InsertedDevicePolicy` | Decision for devices connected after startup. `apply-policy` checks them against the policy. |
| `AuditBackend` | Selects `FileAudit` or `LinuxAudit`. Gentoo's `sys-process/audit` dependency does not by itself mean that `auditd` must be running for USB policy enforcement. |

`ImplicitPolicyTarget=block`, `PresentDevicePolicy=apply-policy` and
`InsertedDevicePolicy=apply-policy` are a common strict setup, not universal
requirements. Choose the behavior based on the devices you need and your
recovery path.

If you use `RuleFolder`, keep fragments in `/etc/usbguard/rules.d/` and give
them numeric prefixes. Do not assume a relative load order between `RuleFile`
and `RuleFolder` unless the documentation for your USBGuard version defines
one.

## 3. Rule order and device decisions

USBGuard checks rules sequentially. The first matching rule sets the decision;
later rules do not override it. Put more specific `allow`, `block` and `reject`
rules before broader rules. Files in `RuleFolder` are also considered in
alphanumeric filename order.

This is a syntax example; replace the placeholders with attributes from your
devices:

```text
allow id <vendor-id>:<product-id>
```

With `ImplicitPolicyTarget=block`, a device that matches no rule is already
blocked. Do not add an unconditional `block` to the basic policy: it can make
later `allow` rules unreachable.

`list-devices` shows internal device IDs, not VID:PID values:

| Action | Runtime decision | Permanent rule |
|--------|------------------|----------------|
| Allow | `doas usbguard allow-device <id>` | `doas usbguard allow-device -p <id>` |
| Block | `doas usbguard block-device <id>` | `doas usbguard block-device -p <id>` |
| Reject and remove from the system | `doas usbguard reject-device <id>` | `doas usbguard reject-device -p <id>` |

A command without `-p` changes the device's current authorization state but
does not save a device-specific rule. That decision can change when the device
is unplugged and reconnected, the daemon restarts or the policy is reapplied—
before the next system reboot.

The `-p` flag adds a permanent device-specific rule to the current policy.
After the command, check `doas usbguard list-rules` and
`doas usbguard list-devices`. If an earlier, broader `block` or `reject` rule
already matches, an `allow` appended at the end may not allow the device.

Use `append-rule` for manual policy editing:

```bash
doas usbguard append-rule 'allow id <vendor-id>:<product-id>'
doas usbguard append-rule --after <rule-id> 'allow id <vendor-id>:<product-id>'
doas usbguard list-rules
```

The command adds a rule to the ordered list. `--after <rule-id>` sets its
position relative to an existing rule; inspect the result with `list-rules`.

## 4. IPC access control

The USBGuard CLI communicates with the daemon over IPC. If only an
administrator will manage it, full access for root is sufficient:

```text
IPCAllowedUsers=root
```

`IPCAllowedUsers` and `IPCAllowedGroups` grant full IPC access to the listed
users or groups. Do not add `wheel` unless that access is needed. For a
non-root user, upstream recommends ACLs with narrowly scoped privileges in
`/etc/usbguard/IPCAccessControl.d/` or the `usbguard add-user` command:

```bash
doas usbguard add-user <username> \
  --devices=list,modify,listen \
  --policy=list \
  --exceptions=listen
```

This example allows device management and policy listing, but not policy
modification. Manually created ACL files must have mode `0600`. An ACL created
with `add-user` takes effect after the daemon restarts; keep in mind that with
`PresentDevicePolicy=apply-policy`, a restart checks already connected devices
again.

The D-Bus bridge is an optional Gentoo feature (`USE=dbus`). Its authorization
uses D-Bus/Polkit and does not replace native USBGuard IPC ACLs.

## 5. First start and safe checks

Review the policy, the devices that must remain allowed and your local recovery
path once more, then start the service:

```bash
doas systemctl start usbguard.service
```

Do not restart the daemon “just in case.” If `PresentDevicePolicy=apply-policy`,
starting or restarting it can immediately change the authorization state of
connected devices.

These commands read the daemon state and do not change device decisions:

```bash
systemctl status usbguard.service --no-pager
doas usbguard get-parameter ImplicitPolicyTarget
doas usbguard list-rules
doas usbguard list-devices
doas journalctl -b -u usbguard.service --no-pager
```

`list-rules` shows the loaded policy and its order; `list-devices` shows the
current decisions for devices.

If all checks pass, enable the service at boot:

```bash
doas systemctl enable usbguard.service
```

If a check fails, do not enable the service at boot until you have addressed
the cause and checked the policy again.

## 6. Gentoo: `.keep` warning

If the journal contains:

```text
Ignoring access control file because of malformed name: .keep_sys-apps_usbguard-0
```

check that it refers to the Gentoo placeholder in
`/etc/usbguard/IPCAccessControl.d/`. ACL filenames must identify a user or
group, so the daemon ignores `.keep`. If that exact placeholder exists, remove
only that file:

```bash
doas rm -- /etc/usbguard/IPCAccessControl.d/.keep_sys-apps_usbguard-0
```

Do not remove real ACL or policy files. The daemon does not need to be
restarted just to remove the placeholder.

## 7. Rollback

Before changing anything, save `/etc/usbguard/usbguard-daemon.conf`,
`/etc/usbguard/rules.conf` and the entire `/etc/usbguard/rules.d/` directory in
a backup directory with mode `0700`, accessible only to root:

```bash
backup_dir="/root/usbguard-backup-$(date +%F-%H%M%S)"
doas install -d -m 0700 "$backup_dir"
doas cp -a /etc/usbguard/. "$backup_dir/"
```

If the new policy blocks a required device:

1. Use local or other recovery access that does not depend on the blocked USB
   device.
2. Restore the previous daemon configuration and policy from the backup.
3. Check the rule order and any conflicting matches.
4. Only then apply the restored policy or restart the daemon. With
   `PresentDevicePolicy=apply-policy`, a restart checks connected devices
   again.
5. Check `list-rules`, `list-devices`, the service status and the journal.

## Sources

- [Gentoo: `sys-apps/usbguard`](https://packages.gentoo.org/packages/sys-apps/usbguard)
- [Upstream: `usbguard(1)`](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard.1.adoc)
- [Upstream: `usbguard-daemon.conf(5)`](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard-daemon.conf.5.adoc)
- [Upstream: `usbguard-rules.conf(5)`](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard-rules.conf.5.adoc)
