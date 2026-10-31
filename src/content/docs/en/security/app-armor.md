---
title: AppArmor on Gentoo Linux
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

AppArmor is an LSM for Mandatory Access Control (MAC). A profile defines which
files, capabilities and other resources an application may access. In Enforce
mode, violations are blocked; in Complain mode, they are allowed and logged.

## Check kernel support

AppArmor requires `CONFIG_SECURITY_APPARMOR=y`. This option enables the
required Audit hooks; checking `CONFIG_AUDIT` can help with diagnostics, but
it is not a separate AppArmor setting.

`CONFIG_SECURITY_APPARMOR=y` makes the LSM available to the kernel.
`CONFIG_LSM` sets the ordered list of selectable LSMs. After boot, check the
active list:

```bash
cat /sys/kernel/security/lsm
```

The list must contain `apparmor`. If it does not, profiles will not provide
the expected process confinement.

The `lsm=` parameter replaces the list from `CONFIG_LSM`; it does not append
to it. If you need it, first check the intended LSM list, preserve the
required modules and their order, and then add AppArmor. There is no universal
`lsm=` list.

`security=apparmor` remains a supported way to select the major LSM, but
normal configuration should use `CONFIG_LSM`. If `lsm=` is set, it determines
the final list. The `apparmor=1` parameter can explicitly enable AppArmor if
the kernel build permits it, but it does not replace checking the active list
and is unnecessary when `apparmor` is already in
`/sys/kernel/security/lsm`.

## Install and load profiles

Install the parser, init scripts and profile management helpers:

```bash
doas emerge -av sys-apps/apparmor sys-apps/apparmor-utils
```

`sys-apps/apparmor` provides the parser and startup integration;
`sys-apps/apparmor-utils` adds profile management tools.

After AppArmor appears in the active LSM list, enable and start the unit:

```bash
doas systemctl enable apparmor.service
doas systemctl start apparmor.service
```

The current upstream unit has type `oneshot` and `RemainAfterExit=yes`: it
loads profiles when started, and the restrictions remain in the kernel after
the unit process exits. `ExecStart` and `ExecReload` run the profile loading
routine; `ConditionSecurity=apparmor` prevents the unit from starting when
AppArmor is inactive. Unit contents vary by package version, so inspect the
installed unit with:

```bash
systemctl cat apparmor.service
```

Use `reload` to reload all profiles:

```bash
doas systemctl reload apparmor.service
```

First check that the installed unit defines `ExecReload`. Do not use `stop`
or `restart` for ordinary policy reloads. The upstream unit sets `ExecStop`
to a no-op so systemd does not unload profiles when stopping or restarting;
unloading the full policy is a separate action.

Check the status and number of loaded profiles with:

```bash
doas aa-status
```

The command reports whether AppArmor is enabled and how many profiles are
loaded in Enforce and Complain modes.

## Enforce and Complain

- **Enforce** — profile violations are blocked.
- **Complain** — violations are allowed and logged. Explicit `deny` rules
  remain enforced in this mode.

Change the mode only for the profile you need:

```bash
doas aa-complain <profile>
doas aa-enforce <profile>
```

`doas aa-disable <profile>` is not a third mode: it unloads the profile from
the kernel and disables automatic loading.

## Create or update a profile

For a new application, run the profile generator:

```bash
doas aa-genprof /usr/bin/<application>
```

If a profile does not exist, `aa-genprof` creates it and puts it in Complain
mode. Run the application in another terminal, exercise real usage scenarios
and review the suggested rules. When you choose Finish, the generator puts
the profiles it created into Enforce mode, so first make sure the scenarios
are covered and the rules match the required behavior.

For an existing profile:

```bash
doas aa-complain <profile>
# Exercise the application's required scenarios.
doas aa-logprof
```

`aa-logprof` reviews events and saves the selected rules. If AppArmor is
running, it reloads changed profiles when it exits. Review its suggestions:
the log shows observed accesses, but does not determine which ones the
application needs.

## Check and apply a profile

To check syntax without loading a profile into the kernel, use
`apparmor_parser -d`:

```bash
apparmor_parser -d /etc/apparmor.d/<profile>
```

A single `-d` checks syntax. Two (`-dd`) also print the parser's
interpretation. This check does not test the application's runtime behavior.

After editing a profile manually, load the replacement for that profile:

```bash
doas apparmor_parser -r /etc/apparmor.d/<profile>
```

To reload the full set, use `doas systemctl reload apparmor.service` if the
installed unit supports `ExecReload`.

## Diagnose denials

If an application's access is unexpectedly blocked, check its mode and look
for AppArmor events:

```bash
doas aa-status
doas ausearch -m AVC,USER_AVC 2>/dev/null
doas journalctl -k -b | grep -i apparmor
```

Use `ausearch` when the Audit userspace tools are available. Without a running
`auditd`, kernel events may be available in the kernel journal. AppArmor
enforces restrictions as an LSM; Auditd helps retain and search security
events, but it is not required for enforcement. See the [Auditd guide](../auditd/).

## Rollback

To temporarily stop one profile from blocking actions while keeping it
loaded:

```bash
doas aa-complain <profile>
```

Reproduce the problem and inspect the denial. Fix the profile, check its
syntax, reload only that profile, then return it to Enforce and check the
application:

```bash
apparmor_parser -d /etc/apparmor.d/<profile>
doas apparmor_parser -r /etc/apparmor.d/<profile>
doas aa-enforce <profile>
```

To disable the profile completely, use `doas aa-disable <profile>`: it will
be unloaded from the kernel and excluded from automatic loading. Do not
disable other profiles.

## Related material

- [Auditd on Gentoo Linux](../auditd/) — retaining and searching security events.

## Sources

- [AppArmor — Linux kernel documentation](https://docs.kernel.org/admin-guide/LSM/apparmor.html)
- [Linux Security Modules — kernel documentation](https://docs.kernel.org/admin-guide/LSM/index.html)
- [AppArmor Kconfig in Linux](https://github.com/torvalds/linux/blob/master/security/apparmor/Kconfig)
- [Linux kernel command-line parameters](https://docs.kernel.org/admin-guide/kernel-parameters.html)
- [Upstream AppArmor systemd unit](https://gitlab.com/apparmor/apparmor/-/raw/v5.0.2/init/apparmor.service)
- [Upstream `apparmor_parser(8)`](https://gitlab.com/apparmor/apparmor/-/raw/v5.0.2/parser/apparmor_parser.pod)
- [sys-apps/apparmor in Gentoo](https://packages.gentoo.org/packages/sys-apps/apparmor)
- [sys-apps/apparmor-utils in Gentoo](https://packages.gentoo.org/packages/sys-apps/apparmor-utils)
