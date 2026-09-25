---
title: AppArmor on Gentoo Linux
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

AppArmor is a Mandatory Access Control (MAC) system that restricts
applications with profiles defining their access to files, capabilities and
other resources. This guide shows the basic AppArmor setup, profile modes and
management, creating your own profile, and diagnosing violations.

This is a general guide; it does not describe the confirmed state of the ASUS
B5402. The kernel and boot parameters shown below are existing examples from
the document, not a fixed configuration of the reference system.

## 1. Before enabling

Before changing the system you need:

- AppArmor and audit support in the kernel;
- the AppArmor userspace packages;
- correct boot parameters;
- an understanding that a profile in Enforce mode can block an application's
  actions if the required permissions are not described.

### Kernel support

The existing example kernel configuration enables the following options:

```conf
CONFIG_SECURITY_APPARMOR=y
CONFIG_SECURITY_APPARMOR_BOOTPARAM_VALUE=1
CONFIG_AUDIT=y
```

The existing example boot parameters (CMDLINE):

```text
security=apparmor lsm=landlock,bpf,apparmor
```

These values were not verified during the editorial migration and do not
confirm the current ASUS B5402 configuration.

## 2. Installation and enabling

Install the userspace packages:

```bash
emerge -av sys-apps/apparmor sys-apps/apparmor-utils
```

Enable and start the service:

```bash
doas systemctl enable apparmor
doas systemctl start apparmor
```

## 3. Profile modes and management

An AppArmor profile can run in one of three modes:

- **Enforce** — active protection, blocks violations;
- **Complain** — only logs violations, does not block;
- **Disable** — the profile is disabled.

### Basic commands

| Command | Description |
|---------|-------------|
| `apparmor_status` | Show the AppArmor status |
| `aa-status` | Brief profile status |
| `aa-complain <profile>` | Switch a profile to complain mode |
| `aa-enforce <profile>` | Switch a profile to enforce mode |
| `apparmor_parser -r /path/to/profile` | Reload a profile |

Before moving a new or modified profile to Enforce, check the application's
behavior in Complain: this way potentially missing permissions first appear in
the log instead of blocking the application.

## 4. Creating and updating a profile

### 4.1. Switching an application to Complain

```bash
doas aa-complain /usr/bin/application
```

### 4.2. Using the application

Launch the application and perform typical operations so that AppArmor records
accesses to the resources it needs.

### 4.3. Generating a profile

```bash
doas aa-genprof /usr/bin/application
```

Follow the interactive wizard to configure the rules. After changing a
profile, reload it with `apparmor_parser -r /path/to/profile` from the table
above. The mode can be changed with `aa-complain` and `aa-enforce`.

## 5. Profile example

The existing profile example is preserved below. Its syntax and semantics
were not verified during the structural migration.

```apparmor
#include <tunables/global>
/usr/bin/example {
  #include <abstractions/base>

  # Files
  /etc/example/** r,
  /var/lib/example/ rw,
  /home/*/.config/example/** rw,

  # Capabilities
  capability net_bind_service,

  # Network
  network inet stream,

  # Environment
  environment /etc/example/env,
}
```

## 6. Utilities

- **aa-notify** — notifications about violations;
- **logprof** — log analysis and profile updates;
- **genprof** — generating a profile from usage.

## 7. Checking and diagnostics

The state of AppArmor and the loaded profiles are shown by `apparmor_status`
and `aa-status` from the basic commands table. For diagnosing violations and
checking a specific profile, use the existing examples:

```bash
# View violation logs
dmesg | grep -i apparmor

# Or via journalctl
journalctl -b | grep -i apparmor

# Detailed analysis
apparmor_parser -d /etc/apparmor.d/profile.name
```

These commands are given as ways to check; the results of running them are not
recorded in this document.

## 8. systemd integration

Many services already have profiles in `/etc/apparmor.d/`. Check the
directory:

```bash
ls -la /etc/apparmor.d/
```

For services, reload AppArmor:

```bash
systemctl reload apparmor
```

## 9. Rollback and recovery

If a profile blocks an application, switch it to Complain with
`aa-complain <profile>`. Then fix or temporarily disable only the problematic
profile, leaving the others untouched. After the fix, reload the profile with
`apparmor_parser -r /path/to/profile` or reload the service with
`systemctl reload apparmor`, then check the status and the log again.

## Related docs

- [Auditd on Gentoo Linux](../auditd/) — recording and analyzing security
  events.
