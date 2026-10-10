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
B5402. The kernel requirements and boot parameters below are general
descriptions and examples, not a fixed configuration of the reference system.

## 1. Before enabling

Before changing the system you need:

- AppArmor and audit support in the kernel;
- the AppArmor userspace packages;
- AppArmor present in the kernel's active LSM list;
- an understanding that a profile in Enforce mode can block an application's
  actions if the required permissions are not described.

### Kernel support

AppArmor requires `CONFIG_SECURITY_APPARMOR=y` (the LSM itself) and
`CONFIG_AUDIT=y` (violation logging). The existing kernel configuration
example from the document:

```conf
CONFIG_SECURITY_APPARMOR=y
CONFIG_SECURITY_APPARMOR_BOOTPARAM_VALUE=1
CONFIG_AUDIT=y
```

Enabling AppArmor in the kernel alone is not enough: it must be present in
the list of LSMs the kernel activates at boot. The preferred way is to set a
correct `CONFIG_LSM` in the kernel configuration with AppArmor in the list.

### Boot parameters: `lsm=` and `security=`

The `lsm=` parameter is an override of the full LSM list: it defines both the
set and the order of all activated LSMs and takes precedence over
`CONFIG_LSM`. Passing a short fixed list via `lsm=` silently drops other
enabled LSMs — for example `lockdown`, `yama` or `integrity`. There is no
universal `lsm=...` string for every system, so do not use one as a baseline.
If you genuinely need `lsm=`, first determine the current LSM list, preserve
all the LSMs you need and their order, and only then add or move AppArmor in
it.

The `security=apparmor` parameter selects AppArmor as the major security
module; it is only needed if the kernel configuration requires it. If `lsm=`
is specified, `lsm=` takes precedence.

To check the active LSM list:

```bash
cat /sys/kernel/security/lsm
```

This is a general verification command; its output for the ASUS B5402 is not
recorded in this document.

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

This guide focuses on the two modes used in the basic workflow:

- **Enforce** — the profile is applied: policy violations are blocked;
- **Complain** — policy violations are allowed but logged; the mode for
  profile development and diagnostics.

AppArmor also supports additional profile modes that are outside this
guide's scope.

Disable is not a loaded-profile mode. `aa-disable <profile>` unloads the
profile and prevents its automatic loading — this is profile management.

### Basic commands

| Command | Description |
|---------|-------------|
| `apparmor_status` | Show the AppArmor status |
| `aa-status` | Brief profile status |
| `aa-complain <profile>` | Switch a profile to complain mode |
| `aa-enforce <profile>` | Switch a profile to enforce mode |
| `aa-disable <profile>` | Unload a profile and disable its auto-loading |
| `apparmor_parser -r /path/to/profile` | Reload a profile |

Before moving a new or modified profile to Enforce, check the application's
behavior in Complain: this way potentially missing permissions first appear in
the log instead of blocking the application.

## 4. Creating and updating a profile

### 4.1. Generating a profile

The main workflow for a new application starts with `aa-genprof`:

```bash
doas aa-genprof /usr/bin/application
```

`aa-genprof` itself creates the profile (via `aa-autodep` if it does not
exist yet), puts it into complain mode, prompts you to launch the application
and perform typical actions, scans the log, updates the rules, and on Finish
switches the created profiles to enforce.

### 4.2. Training the profile

While `aa-genprof` is running, open another terminal or session, launch the
application and perform its real usage scenarios. Return to the wizard, add
the accumulated events via Scan, and repeat until the scenarios are covered;
then finish via Finish.

### 4.3. Refining an existing profile

If the profile already exists and you want to keep learning and fine-tuning
it manually, switch it to complain (`aa-complain`), exercise the
application's scenarios, and pick up the missing rules from the log with
`aa-logprof`. Reload a hand-edited profile with
`apparmor_parser -r /path/to/profile` from the table above; the mode can be
changed with `aa-complain` and `aa-enforce`.

## 5. Profile example

Below is a simplified example of typical rule types. It is not a working
profile of a real application.

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
}
```

## 6. Utilities

- **aa-genprof** — creating and training a new profile;
- **aa-logprof** — updating an existing profile from audit/log events;
- **aa-notify** — notifications about AppArmor events.

## 7. Checking and diagnostics

The state of AppArmor and the loaded profiles are shown by `apparmor_status`
and `aa-status` from the basic commands table. For diagnosing violations and
checking a specific profile, use the existing examples:

```bash
# View violation logs
dmesg | grep -i apparmor

# Or via journalctl
journalctl -b | grep -i apparmor

# Profile syntax check without loading it into the kernel
apparmor_parser -d /etc/apparmor.d/profile.name
```

`apparmor_parser -d` checks how the parser reads the profile and does not
load it; it is not a runtime denial analysis — look for violations in the
log with the commands above. For a verbose dump of the parser's
interpretation there is a separate debug mode with a repeated `-d` (`-dd`).

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
