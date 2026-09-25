---
title: Configuring doas
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

`doas` is used to run commands with elevated privileges and offers a compact
configuration. Its policy is defined in `/etc/doas.conf`. The guide shows a
basic example of the rules and the main commands. The actual ASUS B5402 policy
lives in [the system section](../../systems/asus-b5402/security/doas/); the
exact system configuration is not duplicated here.

## 1. Before changing

A mistake in `/etc/doas.conf` can take away the user's expected way to elevate
privileges. Before the change, prepare a working root/recovery path and save
the previous configuration. Placeholders such as `<username>` must be replaced
with real values.

## 2. Configuration

File: `/etc/doas.conf`

Below is an example policy, not the exact published ASUS B5402 configuration.

```conf
# Allow the user to run commands as root, keeping the password for the session
permit persist :wheel

# Keep environment variables for a specific user
permit keepenv <username>

# Allow running snapper without entering a password (for snapshots)
permit persist :wheel as root cmd snapper
```

## 3. Basic commands

| Command | Description |
|---------|-------------|
| `doas <command>` | Run a command as root |
| `doas -s` | Start a root shell |
| `doas -u <user> <command>` | Run a command as a specific user |

## 4. Verification

After the change, check that an ordinary permitted command runs. Then check
the command-specific rule separately and make sure no extra privileges have
appeared. This document does not record the results of such a check.

## 5. Advantages of doas

- Lightweight and simple
- Fewer dependencies than sudo
- Easier to configure for basic tasks

## 6. Rollback and recovery

Save the previous working `/etc/doas.conf`. If the new policy does not work,
restore the old configuration through the root/recovery access prepared in
advance.

## Related docs

- [The actual doas policy on the ASUS B5402](../../systems/asus-b5402/security/doas/)
