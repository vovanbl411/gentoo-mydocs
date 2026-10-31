---
title: Auditd on Gentoo Linux
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Linux Audit sends kernel and userspace events to the `auditd` daemon, which
writes them to a log. This guide installs Audit on Gentoo with systemd, adds a
small example ruleset, and shows how to check the rules and search for events.
The example does not define a policy for a specific workstation.

## Kernel requirements

The syscall rules in this guide require `CONFIG_AUDIT=y` and
`CONFIG_AUDITSYSCALL=y` in the running kernel configuration. Check them with:

```bash
zgrep -E '^CONFIG_AUDIT=|^CONFIG_AUDITSYSCALL=' /proc/config.gz 2>/dev/null || \
grep -E '^CONFIG_AUDIT=|^CONFIG_AUDITSYSCALL=' "/boot/config-$(uname -r)" 2>/dev/null
```

If policy requires processes started before `auditd` to be marked auditable
too, add `audit=1` to the kernel command line. `audit=1` is not required for
basic logging after the daemon starts.

## Installation and services

Install the package and enable `auditd.service` at boot:

```bash
doas emerge -av sys-process/audit
doas systemctl enable auditd.service
```

To start it now without rebooting:

```bash
doas systemctl start auditd.service
```

In the standard Audit 4.x model, `auditd.service` pulls in
`audit-rules.service` through `Wants=`. Systemd starts `auditd.service` before
the rules loader. `audit-rules.service` is a `oneshot` unit with
`ExecStart=/sbin/augenrules --load`: it exits after loading rules and may show
as `inactive (dead)`. When `auditd.service` is enabled, `audit-rules.service`
does not need to be enabled separately. This is a weak dependency: the daemon
can start even if rule loading fails, so check the loaded rules with
`auditctl -l`.

The standard `auditd.service` sets `RefuseManualStop=yes`, which prevents a
manual stop through the unit. Rule changes do not require restarting `auditd`.

## `auditd` configuration

File: `/etc/audit/auditd.conf`

This file sets the log path and format, rotation, and behavior when space runs
low or writes fail. Parameters such as `log_file`, `max_log_file`, and
`max_log_file_action` control log storage; choose values for your system. If
you have specific retention or write-failure requirements, also choose
`space_left_action`, `disk_full_action`, and `disk_error_action`. Defaults are
not a universal security policy.

## Rules

File: `/etc/audit/rules.d/70-local.rules`

`augenrules` reads only `*.rules` files from `/etc/audit/rules.d/`, combines
them in natural sort order, and creates `/etc/audit/audit.rules`. Fragment
names determine their order; `70-local.rules` is suitable for local rules.

```text
# Record writes and attribute changes to account files
-a always,exit -F arch=b64 -F path=/etc/passwd -F perm=wa -F key=identity
-a always,exit -F arch=b64 -F path=/etc/shadow -F perm=wa -F key=identity

# Optional: set this to an installed privilege escalation utility path, then uncomment
# -a always,exit -F arch=b64 -F path=/usr/bin/doas -F perm=x -F key=privilege_tool

# Optional: kernel module load and unload syscalls
# -a always,exit -F arch=b64 -S init_module,finit_module,delete_module -F key=kernel_modules
```

Use the syscall form `-F path=...` for file rules; the legacy `-w` watch form
is deprecated. In this example, `arch=b64` means the 64-bit syscall ABI. On
amd64, add matching `b32` rules if the 32-bit ABI is used and should also be
audited; on other architectures, select the appropriate ABI. The module rule
tracks module load and unload syscalls, not changes to files under
`/usr/lib/modules`.

## Loading and checking rules

Before loading, you can check whether the assembled rules have changed:

```bash
doas augenrules --check
```

`--check` reports whether the rules differ from `/etc/audit/audit.rules`
without overwriting that file. It is not a full syntax or runtime validation.
To assemble and load the rules:

```bash
doas augenrules --load
doas auditctl -s
doas auditctl -l
```

At startup, `auditd.service` automatically starts `audit-rules.service`. After
changing fragments, load them with `augenrules --load`; `auditd` does not need
to be restarted. `auditctl -s` shows Audit status, and `auditctl -l` shows the
rules loaded in the kernel.

## Searching events

```bash
doas ausearch -k identity
doas aureport --summary
```

The key search may return no records until an event matching the rule occurs.

## If rules do not work

- Run `doas auditctl -l` and check that the required rules are loaded.
- If syscall rules are loaded but do not match, check the list for
  `never,task`: this rule disables syscall rule processing for new processes.
- In `doas auditctl -s`, `enabled 2` means immutable mode; the rules cannot be
  changed until reboot.

AppArmor sends security events through the Linux Audit subsystem. If `auditd`
receives these events, you can search for them with `ausearch`. A filesystem
watch on the log file is unnecessary: it would record writes to the log, not
the security event itself. See [the AppArmor guide](../app-armor/) for profile
setup.

## Rollback

1. Restore the previous version of `/etc/audit/rules.d/70-local.rules`.
2. Run `doas augenrules --check` to see whether the assembled rules differ
   from `/etc/audit/audit.rules`.
3. Load the restored rules with `doas augenrules --load`.
4. Check the active rules with `doas auditctl -l`.

If `auditctl -s` shows `enabled 2`, rollback is not possible until reboot.

## Related material

- [AppArmor on Gentoo Linux](../app-armor/) — profile setup and diagnostics.
- [Gentoo `sys-process/audit` package](https://packages.gentoo.org/packages/sys-process/audit).
- [Linux Audit documentation](https://github.com/linux-audit/audit-userspace/tree/master/docs).
