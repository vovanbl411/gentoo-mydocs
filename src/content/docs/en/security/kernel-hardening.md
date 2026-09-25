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

### Hardened gentoo-sources

The kernel is built with additional protective measures:

- PIE (Position Independent Executable);
- Stack Protector;
- RELRO (Relocation Read-Only).

The wording about Hardened gentoo-sources was not verified and not replaced
with new technical claims during the structural migration.

## 3. Example sysctl policy

File: `/etc/sysctl.d/99-hardened-kernel.conf`

The existing hardening policy example is preserved below. The specific values
and comments need to be checked and adapted to the environment; they were not
fixed as part of this editorial migration.

```conf
# Enable Reverse Path Filtering (protection against IP spoofing)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# --- Filesystem protection ---
# Restrictions on FIFOs and regular files in sticky directories (/tmp)
# Value 2 is the strictest mode (Full)
fs.protected_fifos = 2
fs.protected_regular = 2

# --- Hiding pointers and restricting perf ---
kernel.kptr_restrict = 2
kernel.perf_event_paranoid = 3

# --- BPF hardening ---
kernel.unprivileged_bpf_disabled = 1
net.core.bpf_jit_harden = 2

# --- System integrity and dumps ---
# Critical for the Secure Boot + UKI combination
kernel.kexec_load_disabled = 1
fs.suid_dumpable = 0

# TTY restriction
dev.tty.ldisc_autoload = 0

# Restriction on creating memory dumps
kernel.core_pattern = |/bin/false

# Protection against attacks via reboots (cold boot attack)
kernel.panic = 10
kernel.panic_on_oops = 1
```

## 4. Module silencing

Disabling the loading of unused modules and restricting access to module
information.

## 5. Verification

After the change, check the actual runtime values, make sure the needed sysctl
file is loaded, and test the workloads the restrictions can affect. This
document does not record the results of such checks.

## 6. Verification tools

The following tools are listed as possible verification means; the document
does not claim they are installed or have already been used:

- `hardened-gentoo-hardened-check` — checking the protection status;
- `lynis` — security audit;
- `aide` — intrusion detection.

## 7. Rollback

Save the previous sysctl policy before the change. If a regression appears,
restore the previous values and re-check the affected workload.
