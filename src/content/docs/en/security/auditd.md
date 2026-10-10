---
title: Auditd on Gentoo Linux
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

Auditd logs security-relevant events and lets you track file access, system
calls, and the actions of processes and users. This guide shows the basic
daemon configuration, an example ruleset, and ways to search and analyze
events.

The ruleset below is an example policy, not a universal production
recommendation. It needs to be adapted to the specific system and threat
model.

## 1. Before enabling

Audit rules can generate a significant log volume, affect performance and
require adaptation to the specific system and threat model. Before applying
them, decide which files, system calls and actions actually need to be
tracked in this environment.

## 2. Installation and service

Install the package:

```bash
emerge -av sys-process/audit
```

Enable and start the service:

```bash
doas systemctl enable --now auditd
```

## 3. Basic configuration

File: `/etc/audit/auditd.conf`

```conf
# Log file
log_file = /var/log/audit/audit.log

# Maximum file size
max_log_file = 100

# Action on overflow
max_log_file_action = rotate

# On-disk record format
log_format = RAW
```

Valid `log_format` values are `RAW` and `ENRICHED`. The timestamp format of
audit records is not configurable through `auditd.conf`.

## 4. Audit rules

File: `/etc/audit/rules.d/security.rules`

The `/etc/audit/rules.d/` directory holds `*.rules` fragments processed by
`augenrules` (section 5). Below is an example policy, not a universal
recommendation: adapt the set to your specific system and threat model.

```bash
# Changes to critical files
-a always,exit -F arch=b64 -F path=/etc/passwd -F perm=wa -F key=passwd_changes
-a always,exit -F arch=b64 -F path=/etc/shadow -F perm=wa -F key=shadow_changes
-a always,exit -F arch=b64 -F path=/etc/doas.conf -F perm=wa -F key=doas_conf_changes
# Optional, only if sudo is used:
# -a always,exit -F arch=b64 -F path=/etc/sudoers -F perm=wa -F key=sudoers_changes
# Optional, only if an OpenSSH server is used and the file exists:
# -a always,exit -F arch=b64 -F path=/etc/ssh/sshd_config -F perm=wa -F key=sshd_config_changes

# Execution of privilege escalation tools
-a always,exit -F arch=b64 -F path=/usr/bin/doas -F perm=x -F key=doas_exec
# Optional, only if sudo is used:
# -a always,exit -F arch=b64 -F path=/usr/bin/sudo -F perm=x -F key=sudo_exec

# Kernel module load and unload
-a always,exit -F arch=b64 -S init_module,finit_module,delete_module -F key=kernel_modules

# Optional broad example: all connect() calls
-a always,exit -F arch=b64 -S connect -F key=network_connect
```

Keep only paths that actually exist and matter on your system:

- `/etc/doas.conf` is a relevant example for this project's reference
  system, not a universal requirement;
- `/etc/sudoers` only makes sense if sudo is used;
- `/etc/ssh/sshd_config` only if an OpenSSH server is used and the file
  exists.

> **Note**: the examples use `arch=b64` — rules for the 64-bit syscall ABI.
> On bi-arch systems, syscall rules may require matching `b32` variants; do
> not treat `b64` as universally correct for every architecture.

The `kernel_modules` rule tracks kernel module load and unload themselves
(the `init_module`, `finit_module`, `delete_module` syscalls). That is not
the same as changes to files under `/usr/lib/modules`: the latter would
need a separate filesystem watch, and such a watch does not record the fact
that a module was loaded.

> **Important**: the `-S connect` rule is very broad: it records every
> `connect()` call, including local sockets, not only remote connections.
> Such a watch can generate a high volume of events, so it stays an
> optional broad example.

## 5. Applying the rules

```bash
doas augenrules --load
doas auditctl -l
```

`augenrules` assembles all `*.rules` fragments from `/etc/audit/rules.d/`
into the resulting `/etc/audit/audit.rules` and loads that ruleset.
`auditctl -l` shows the actually loaded rules — check them after each load.

The `auditctl -R <file>` command can also load a specific rules file, but
with `rules.d` it must not be the primary method: it bypasses the other
fragments in the directory.

## 6. Checking and usage

### 6.1. Checking the service and rules

| Command | Description |
|---------|-------------|
| `auditctl -l` | Show the current rules |
| `auditctl -s` | Show the status |
| `ausearch -k doas_exec` | Search by key |
| `ausearch -ui 1000` | Search by user UID |
| `aureport --summary` | Summary report |
| `aureport --failed` | Failed attempts only |

### 6.2. Viewing and searching events

```bash
# View in real time
tail -f /var/log/audit/audit.log

# Search events by key
ausearch -ts today -k doas_exec

# Report for today
aureport -ts today
```

### 6.3. Search examples

The commands below search for specific observable record types. A record in
the log is not a security interpretation by itself — evaluate events in the
context of your system.

```bash
# AVC records (for example, kernel-enforced denials from MAC subsystems
# such as AppArmor); userspace-mediated AppArmor events may land in USER_AVC
ausearch -i -m AVC,USER_AVC

# connect() syscall records — including local sockets
ausearch -i -sc connect

# Program execution records (execve)
ausearch -i -sc execve
```

## 7. AppArmor integration

AppArmor generates its own audit/security events, and auditd can record
them: kernel-enforced denials end up in the audit log as AVC records, while
userspace-mediated AppArmor events may also appear as USER_AVC — both are
found with the command from section 6.3. An extra filesystem watch on the
system log file is not needed for that — such a watch would record writes
to a log file, not the security event itself.

For profile setup and diagnostics, see
[the AppArmor guide](../app-armor/).

## 8. Rollback and recovery

If a new ruleset causes problems:

1. restore the previous version of the
   `/etc/audit/rules.d/security.rules` fragment;
2. reload the rules: `doas augenrules --load`;
3. check the actually loaded rules: `doas auditctl -l`.

## Related docs

- [AppArmor on Gentoo Linux](../app-armor/) — profile setup and violation
  diagnostics.
