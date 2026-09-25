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

# Time format
disp_format = raw
time_format = %Y-%m-%d %H:%M:%S
```

## 4. Audit rules

File: `/etc/audit/rules.d/security.rules`

The existing example policy is preserved below. Do not apply it as a
universal production ruleset without checking and adapting it to your system
and threat model.

```bash
# Monitor changes in important directories
-w /etc/passwd -p wa -k passwd_changes
-w /etc/shadow -p wa -k shadow_changes
-w /etc/sudoers -p wa -k sudoers_changes
-w /etc/ssh/sshd_config -p wa -k sshd_config_changes

# Monitor program execution
-a always,exit -F arch=b64 -S execve -F path=/usr/bin/sudo -F key=sudo_exec
-a always,exit -F arch=b64 -S execve -F path=/usr/bin/doas -F key=doas_exec

# Monitor network connections
-a always,exit -F arch=b64 -S connect -F key=network_connect

# Monitor kernel module loading
-w /usr/lib/modules/ -p wa -k modules
```

## 5. Applying the rules

Load the rules from the file:

```bash
doas auditctl -R /etc/audit/rules.d/security.rules
```

## 6. Checking and usage

### 6.1. Checking the service and rules

| Command | Description |
|---------|-------------|
| `auditctl -l` | Show the current rules |
| `auditctl -s` | Show the status |
| `ausearch -k sudo_exec` | Search by key |
| `ausearch -ui 1000` | Search by user UID |
| `aureport --summary` | Summary report |
| `aureport --failed` | Failed attempts only |

### 6.2. Viewing and searching events

```bash
# View in real time
tail -f /var/log/audit/audit.log

# Search events
ausearch -ts today -k sudo_exec

# Report for today
aureport -ts today
```

### 6.3. Security analysis examples

```bash
# Unauthorized access attempts
ausearch -i --msg type=AVC

# Remote connections
ausearch -sc connect -i

# Suspicious processes
ausearch -sc execve -i | grep -v sudo
```

## 7. AppArmor integration

Auditd can work together with AppArmor and record related security events.
The guide already used the following example rule:

```bash
# Add a rule for tracking denied AppArmor events
-w /var/log/kern.log -p wa -k apparmor_denied
```

This is an existing example from the document, not a confirmed setup for any
systemd system. The `/var/log/kern.log` path needs to be checked against the
specific logging configuration; it was not fixed during this migration.
For configuring and diagnosing profiles, see
[the AppArmor guide](../app-armor/).

AppArmor events can be searched with the example saved above,
`ausearch -i --msg type=AVC`.

## 8. Rollback and recovery

If a new ruleset causes problems, restore the previous version of
`/etc/audit/rules.d/security.rules`, load it again with
`doas auditctl -R /etc/audit/rules.d/security.rules` and check the actually
loaded rules with `auditctl -l`.

## Related docs

- [AppArmor on Gentoo Linux](../app-armor/) — profile setup and violation
  diagnostics.
