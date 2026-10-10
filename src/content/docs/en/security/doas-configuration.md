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
# wheel: authentication required, temporary persist, environment retained
permit persist keepenv :wheel
```

Rule format:

```text
permit|deny [options] identity [as target] [cmd command [args ...]]
```

Semantics to keep in mind:

- The **last matching rule** determines the outcome, not the first; options
  from several matching rules are not combined. If you need both `persist`
  and `keepenv`, they must live in a single rule — as in the example above.
- `persist` — after a successful authentication, re-authentication is not
  required for some time; the accumulated state is cleared with `doas -L`.
- `keepenv` — the user's environment variables are not scrubbed.
- `nopass` — the matching rule is executed without authentication.
- For `cmd`, an absolute path is preferred.
- Rule order matters: a later specific rule overrides an earlier general one
  exactly for the commands it matches.

### Optional: passwordless for a specific command

Allowing a single command to run without authentication is a separate,
deliberate policy. It is not required for normal doas operation, and `persist`
is not a substitute for it: passwordless is only `nopass`.

```conf
# Optional example: snapper for a specific user without authentication
permit nopass <username> as root cmd /usr/bin/snapper
```

A later command-specific rule overrides a more general rule for the command it
matches. This illustrates a possible policy and is not a statement about the
actual ASUS B5402 configuration.

### Gentoo: building with persist support

On Gentoo, `persist` support is enabled by the USE flag:

```text
app-admin/doas[persist]
```

Without this flag the `persist` option is not supported in rules.

## 3. Basic commands

| Command | Description |
|---------|-------------|
| `doas <command>` | Run a command as root |
| `doas -s` | Start a root shell |
| `doas -u <user> <command>` | Run a command as a specific user |

## 4. Verification

Check the configuration syntax before applying it, if the installed version
supports a config check:

```bash
doas -C /etc/doas.conf
```

The `-C` flag only parses and checks the configuration and runs no command
(see `man doas` for your version's exact semantics). After the change, check
that an ordinary permitted command runs. Then check the command-specific rule
separately and make sure no extra privileges have appeared. This document does
not record the results of such a check.

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
