---
title: Linux kernel hardening
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Check hardening in layers: build settings, the actual Kconfig of the running kernel, current runtime defaults, and only then additional restrictions for a specific goal. There is no universal sysctl set for every Gentoo system; values can depend on the kernel, init system, and workload.

## 1. Gentoo kernel build

A Portage profile such as `default/linux/amd64/23.0/no-multilib/hardened/systemd` and the `hardened` USE flag for `sys-kernel/gentoo-kernel` are separate mechanisms. The profile defines policy for Gentoo packages and the toolchain; the USE flag participates in building the kernel Kconfig. The profile does not automatically enable every kernel hardening option.

The current `sys-kernel/gentoo-kernel` ebuild adds `hardened-base.config` and, when present, `hardened-<arch>.config` when the flag is enabled. With GCC it also adds `hardened-gcc-plugins.config`. The base hardened fragment follows Kernel Self-Protection Project recommended settings with Gentoo-specific changes.

The amd64 Fedora input config already enables examples such as `STRICT_KERNEL_RWX`, `STRICT_MODULE_RWX`, `STACKPROTECTOR_STRONG`, `HARDENED_USERCOPY`, `SLAB_FREELIST_HARDENED`, `FORTIFY_SOURCE`, and `VMAP_STACK`. Hardened fragments repeat some of these settings and add others, such as `INIT_ON_FREE_DEFAULT_ON`, `PANIC_ON_OOPS`, and disabling `KEXEC`; `hardened-amd64.config` also sets `RANDOMIZE_BASE`. The USE flag alone therefore cannot establish the final Kconfig.

`savedconfig` and the source version also affect the result. The source of truth for build-time protections is the final configuration of the running kernel. For a fully custom kernel, use KSPP as a reference, not as a checklist to copy blindly.

## 2. Check the running kernel Kconfig

First match the config to `uname -r`. If the kernel exports `/proc/config.gz`, it contains the running kernel configuration. Otherwise check the matching `/boot/config-$(uname -r)`; do not use a config from another version. This command prints selected options only, not the full `.config`.

```bash
pattern='^(# )?CONFIG_(STRICT_KERNEL_RWX|STRICT_MODULE_RWX|STACKPROTECTOR_STRONG|HARDENED_USERCOPY|SLAB_FREELIST_RANDOM|SLAB_FREELIST_HARDENED|RANDOM_KMALLOC_CACHES|KMALLOC_PARTITION_CACHES|SHUFFLE_PAGE_ALLOCATOR|INIT_ON_ALLOC_DEFAULT_ON|INIT_ON_FREE_DEFAULT_ON|VMAP_STACK|REFCOUNT_FULL|FORTIFY_SOURCE|SECURITY_DMESG_RESTRICT|RANDOMIZE_BASE|BPF_UNPRIV_DEFAULT_OFF|KEXEC|KEXEC_FILE|PANIC_ON_OOPS|PANIC_TIMEOUT|MODULE_SIG|MODULE_SIG_FORCE)(=| is not set)'
zgrep -E "$pattern" /proc/config.gz 2>/dev/null ||
    grep -E "$pattern" "/boot/config-$(uname -r)" 2>/dev/null || true
```

A line such as `# CONFIG_NAME is not set` means the option is off. The absence of a line does not by itself prove that it is disabled: the symbol may have changed or disappeared in that kernel version. Check it against the matching kernel sources and inspect the final config after `savedconfig` is merged.

## 3. Runtime policy knobs

Start by checking the current value with `sysctl` and finding what sets it. Change a value only when the goal is clear and compatibility has been reviewed.

| Parameter | What it restricts | Main trade-off |
|---|---|---|
| `kernel.kptr_restrict` | `0` applies minimal restrictions and hashes addresses; `1` restricts `%pK` output with capability checks; `2` hides those addresses regardless of privileges. | kernel debugging and observability |
| `kernel.perf_event_paranoid` | A value of `>=2` blocks unprivileged kernel profiling; upstream documents the thresholds `-1`, `>=0`, `>=1`, and `>=2`. | `perf`, profilers, and observability; `3` is not a distinct portable recommendation |
| `kernel.unprivileged_bpf_disabled` | `0` allows unprivileged BPF; `1` disables it until reboot with no way to re-enable it; `2` disables it but allows a later change. With `CONFIG_BPF_UNPRIV_DEFAULT_OFF=y`, the initial value is already `2`. | BPF workloads; changing `2 → 1` makes the restriction irreversible until reboot |
| `net.core.bpf_jit_harden` | `0` disables JIT hardening; `1` enables it for unprivileged users; `2` enables it for everyone. | performance; use only when the knob exists and BPF JIT is in use |
| `fs.protected_fifos`, `fs.protected_regular` | `1` restricts `O_CREAT` opens of existing FIFOs or regular files not owned by the caller in world-writable sticky directories; `2` also applies in group-writable sticky directories. | compatibility with some applications; check kernel defaults and existing system policy |
| `fs.suid_dumpable` | Controls core dumps for setuid and other protected processes. The upstream default is `0`, but system configuration may choose another value for its collector. | crash diagnostics; do not add an override if the current value already meets the chosen policy |
| `dev.tty.ldisc_autoload` | `0` prevents ordinary users from automatically loading line-discipline modules. | workloads that need automatic line-discipline loading |
| `kernel.kexec_load_disabled` | Disables `kexec_load` and `kexec_file_load` when kexec support is built into the kernel. The value `1` cannot be reversed until reboot. | later kexec or kdump use; if `CONFIG_KEXEC` and `CONFIG_KEXEC_FILE` are disabled, the knob is unnecessary |

`net.ipv4.conf.*.rp_filter` is network/routing policy, not a general kernel hardening recommendation. Strict mode can interfere with asymmetric or policy routing, multihoming, and VPNs; choose anti-spoofing settings for the network topology.

`kernel.core_pattern` selects core-dump handling. The value `|/bin/false` discards dumps and can disable `systemd-coredump` and application diagnostics. Choose a collector as a separate policy. `kernel.panic_on_oops` and `kernel.panic` define failure and recovery behavior: for example, the timeout changes whether the system reboots after a panic. These are not a universal hardening preset.

Keep module signing, Secure Boot, and runtime module bans distinct. `CONFIG_MODULE_SIG_FORCE` enforces signature checks in the kernel; Secure Boot verifies the boot chain. `kernel.modules_disabled=1` prevents modules from being loaded or unloaded until reboot. This is a high-impact choice: first make sure all required hardware and workload modules are available. Module autoloading may also be required and is not the same as explicit module loading.

## 4. Apply a selected value

This example shows the process; it does not recommend setting `kernel.kptr_restrict=2`.

1. Record the current value: `sysctl kernel.kptr_restrict`.
2. Check how the change affects the tools and workloads you need.
3. If the setting is reversible, you may test it temporarily:

   ```bash
   doas sysctl -w kernel.kptr_restrict=2
   ```

4. After validation, save only the selected value.

   File: `/etc/sysctl.d/90-local-hardening.conf`

   ```ini
   kernel.kptr_restrict = 2
   ```

5. Load only this file and check the result:

   ```bash
   doas sysctl -p /etc/sysctl.d/90-local-hardening.conf
   sysctl kernel.kptr_restrict
   ```

Record the previous value before a reversible change. To roll it back, restore it with `doas sysctl -w <key>=<previous-value>`, then correct or remove the local entry.

Values such as `kernel.unprivileged_bpf_disabled=1`, `kernel.kexec_load_disabled=1`, and `kernel.modules_disabled=1` cannot be undone by writing another value before reboot. Do not use them for casual live testing: check Kconfig and the current state, establish a recovery path, and then make a separate policy decision. If the value is already persisted in sysctl configuration, remove or correct that entry before rebooting, then verify the effective value after boot.

## 5. Verify after a change

Check each layer separately:

- **Build-time:** `uname -r` and the matching running Kconfig in `/proc/config.gz` or `/boot/config-$(uname -r)`.
- **Runtime:** actual values of selected keys with `sysctl <key>`.
- **Persistent source:** only entries for the selected keys in `/etc/sysctl.conf`, `/etc/sysctl.d/`, `/run/sysctl.d/`, and `/usr/lib/sysctl.d/`.
- **Boot parameters:** `cat /proc/cmdline`.
- **Workload:** test the affected function, such as perf/profilers, BPF, kexec/kdump, the core-dump collector, networking, or hardware module loading.

Use system data and targeted workload checks; treat external scanners as supplementary tools.

## Sources

- [Linux Kernel Self-Protection](https://docs.kernel.org/security/self-protection.html)
- Gentoo [sys-kernel/gentoo-kernel ebuild](https://github.com/gentoo/gentoo/tree/master/sys-kernel/gentoo-kernel)
- Gentoo [hardened-base.config](https://github.com/gentoo/gentoo-kernel-config/blob/master/hardened-base.config) and [hardened-amd64.config](https://github.com/gentoo/gentoo-kernel-config/blob/master/hardened-amd64.config)
- Linux kernel [kernel sysctl](https://docs.kernel.org/admin-guide/sysctl/kernel.html), [filesystem sysctl](https://docs.kernel.org/admin-guide/sysctl/fs.html), [network sysctl](https://docs.kernel.org/admin-guide/sysctl/net.html), and [IP sysctl](https://docs.kernel.org/networking/ip-sysctl.html)
