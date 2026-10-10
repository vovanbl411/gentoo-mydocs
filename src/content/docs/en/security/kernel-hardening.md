---
title: Linux kernel hardening
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

The document covers several levels of kernel hardening: protective kernel
build features, sysctl runtime parameters, module restriction and verification
tools. The values below form an example hardening policy, not a universally
safe configuration for any system.

Some restrictions can break existing workloads. Before applying them, match
them against the specific environment and verify it after the change.

## 1. Scope and risks

Hardening sysctl parameters can affect:

- networking;
- debugging and perf;
- BPF workloads;
- kexec;
- crash dumps;
- panic/recovery behaviour.

Save the previous policy and decide in advance which workloads need to be
checked after the change.

## 2. Kernel build hardening

`sys-kernel/gentoo-sources` provides Linux sources with the Gentoo patchset.
Using `gentoo-sources` by itself does not imply any specific set of hardening
options: for a kernel you build yourself, hardening is determined primarily by
its Kconfig.

`sys-kernel/gentoo-kernel` has a local USE flag `hardened`, which enables a
selection of hardening options recommended by the Kernel Self Protection
Project.

`PIE`, ELF `RELRO` and similar mechanisms are userspace toolchain hardening —
a separate protection level that should not be conflated with kernel Kconfig
hardening.

## 3. Example sysctl policy

File: `/etc/sysctl.d/99-hardened-kernel.conf`

The policy below is an example, not a recommendation for an arbitrary system
and not a description of an applied configuration on a specific machine. Check
and adapt the values and comments to the environment.

```conf
# Reverse Path Filtering: 1 is strict mode (protection against IP spoofing)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# --- Filesystem protection ---
# Restrictions on FIFOs and regular files in sticky directories (/tmp)
fs.protected_fifos = 2
fs.protected_regular = 2

# --- Hiding pointers and restricting perf ---
kernel.kptr_restrict = 2
kernel.perf_event_paranoid = 3

# --- BPF hardening ---
kernel.unprivileged_bpf_disabled = 1
net.core.bpf_jit_harden = 2

# --- System integrity and dumps ---
kernel.kexec_load_disabled = 1
fs.suid_dumpable = 0

# TTY restriction
dev.tty.ldisc_autoload = 0

# The core dump is piped to a userspace helper via stdin (/bin/false discards it)
kernel.core_pattern = |/bin/false

# panic_on_oops = 1: a kernel oops/BUG becomes a panic
# panic = 10: reboot 10 seconds after a panic
kernel.panic_on_oops = 1
kernel.panic = 10
```

### Notes on individual parameters

**rp_filter.** `1` is strict reverse-path filtering: the best reverse route for
an incoming source address must go through the same interface the packet
arrived on. Strict mode can interfere with asymmetric routing, policy routing,
multihoming and some VPN/network setups; loose mode (`2`) sometimes fits such
environments better.

**fs.protected_fifos / fs.protected_regular.** `1` restricts `O_CREAT` for
objects owned by others in world-writable sticky directories; `2` extends this
protection to group-writable sticky directories as well.

**kernel.unprivileged_bpf_disabled.** `1` disables unprivileged `bpf()` and,
once set to `1`, cannot be returned to `0` until a reboot. The value `2` also
disables unprivileged BPF but remains reversible.

**net.core.bpf_jit_harden.** `2` enables JIT hardening for all users. It has a
performance cost and only makes sense in the context of the BPF JIT in use.

**kernel.kexec_load_disabled.** Disables the `kexec_load` and `kexec_file_load`
syscalls; the transition to `1` is irreversible until the next boot. It reduces
the ability to replace or load a new kernel image via kexec, but is
incompatible with normal subsequent kexec use and may affect
kdump/crash-kernel workflows. The parameter is not required for Secure Boot,
UKI or systemd-boot.

**kernel.core_pattern.** A string starting with `|` means the kernel passes the
core dump to a userspace helper via stdin. `|/bin/false` effectively directs
the core stream to `/bin/false`, which discards it.

> ⚠️ **Important nuance**: such a setting replaces the normal core-dump
> collector and can interfere with crash diagnostics and system coredump
> handling. Apply it only if the intent is really to opt out of userspace core
> dumps.

**fs.suid_dumpable = 0** separately forbids core dumps for setuid and other
protected processes in the standard mode.

**kernel.panic_on_oops / kernel.panic.** `panic_on_oops = 1` turns a kernel
oops/BUG into a panic; `panic = 10` reboots the system 10 seconds after a
panic. This is an availability/recovery policy, not protection against cold
boot attacks or RAM remanence. Trade-off: failing fast can be preferable to
continuing on corrupted kernel state, but an automatic reboot can interfere
with crash-dump/debugging workflows and, with a persistent panic cause, can
lead to a reboot loop.

## 4. Module loading considerations

Restricting module loading (a full ban, blacklisting, signing requirements) is
a separate policy with possible compatibility consequences for hardware and
workloads. This document does not define specific rules.

## 5. Verification

After the change, check the actual runtime values, make sure the needed sysctl
file is loaded, and test the workloads the restrictions can affect. This
document does not record the results of such checks.

## 6. Verification tools

The following tools are listed as possible verification means; the document
does not claim they are installed, present in the Gentoo repository or have
already been used:

- `kernel-hardening-checker` — an external tool for checking Kconfig, the
  kernel command line and sysctl;
- `lynis` — general security auditing.

## 7. Rollback

Save the previous sysctl policy before the change. If a regression appears,
restore the previous values and re-check the affected workload.
