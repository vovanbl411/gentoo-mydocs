---
title: "CPU optimization: Intel Alder Lake (i7-1260P)"
kind: system
scope: system
status: draft
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Current state

- CPU: Intel Core i7-1260P, Alder Lake (hybrid P/E cores).
- Userspace compilation flags: `-march=alderlake`; the `CPU_FLAGS_X86` set was recorded
  from the output of `cpuid2cpuflags` (see below).
- Kernel: `CONFIG_X86_NATIVE_CPU=y` — standard native CPU optimization,
  confirmed by the owner on 2026-10-07.
- Frequency driver: intel_pstate in active mode.
- HFI / Intel Thread Director: `CONFIG_INTEL_HFI_THERMAL=y`.
- BOLT is not used (disabled since 2026-07; see below).
- IOMMU is enabled; TXT support is enabled in the kernel configuration.
- TDX does not apply: this CPU has no TDX hardware.

## Compilation flags and instructions

For userspace, `make.conf` uses `-march=alderlake`. This enables support for instructions
specific to this architecture, except those blocked by hardware (for example,
AVX-512).

The instruction set recorded for the i7-1260P from `cpuid2cpuflags`:

```makefile
# Optimal set for the i7-1260P in make.conf
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"
```

### Empirical benchmark: zstd

The results supplied by the owner compare zstd builds using
`-march=alderlake` and `-march=x86-64-v3`; the speeds below are medians.
The supplied confirmation does not specify the execution machine, zstd and
compiler versions, other build flags, input data, compression level, thread
count or number of runs. These results therefore do not yet describe a
reproducible measurement method.

| Workload | `-march=alderlake`, MB/s | `-march=x86-64-v3`, MB/s | Alder Lake advantage |
|----------|-------------------------|-------------------------|----------------------|
| Compression | 815.5 | 812.7 | +0.35% |
| Decompression | 5746.7 | 5728.0 | +0.33% |

No practically significant loss from `x86-64-v3` was found for this workload.
This is not a universal guarantee for other packages; the result does not
change the workstation's local Alder Lake policy.

## Kernel CPU optimization

The owner's check on 2026-10-07 confirmed that `CONFIG_X86_NATIVE_CPU=y`
enables standard native CPU optimization through upstream Kconfig. Manual
`KCFLAGS="-march=alderlake"` is not required for this and is correctly left
commented out. The kernel is planned to remain locally built so that
`native` means Alder Lake itself.

The accepted builder target `x86-64-v3` applies only to portable userspace
binpkgs and does not replace the local Alder Lake policy. The owner verified
on 2026-10-08 that `-march=x86-64-v3` and the production LLVM/Clang/LLD policy
are applied; the final `@world` resolver is clean. Userspace package policy
synchronization completed on 2026-10-09; the first local
`app-arch/zstd-1.5.7-r1` pilot is PASS (`gpkg`, `Packages` index created).
The private HTTP binhost, end-to-end installation on the workstation and
server ON/OFF fallback remain pending; see the
[binary build host plan](../../system/boot-and-portage/#gentoo-binary-build-host--plan).

## Scheduler, Thread Director, and frequency management

Linux uses the Hardware Feedback Interface (HFI) to distribute tasks between
performance (P) and efficiency (E) cores. The saved `.config` record contains
the following settings:

- **Intel Thread Director (HFI)**: the kernel has
  `CONFIG_INTEL_HFI_THERMAL=y` enabled. This module collects processor
  telemetry and helps the scheduler distribute threads correctly across the
  hybrid cores.
- **Power management**: `CONFIG_INTEL_IDLE=y` and `CONFIG_INTEL_RAPL=y`
  (Running Average Power Limit) are used for precise control of idle states
  and power consumption.
- **Turbo boost**: `CONFIG_INTEL_TURBO_MAX_3=y` (Intel Turbo Boost Max
  Technology 3.0) is enabled to identify the fastest cores and direct
  single-threaded workloads to them.
- **Frequency driver**: intel_pstate in active mode is used for dynamic
  frequency scaling.

## Hardware security and virtualization

- **IOMMU (VT-d)**: enabled by default with scalable-mode support
  (`CONFIG_INTEL_IOMMU_DEFAULT_ON=y`,
  `CONFIG_INTEL_IOMMU_SCALABLE_MODE_DEFAULT_ON=y`, `CONFIG_INTEL_IOMMU_SVM=y`).
- **Intel TXT**: Trusted Execution Technology support is enabled in the kernel
  configuration (`CONFIG_INTEL_TXT=y`).
- **Intel TDX**: does not apply to this CPU — TDX exists only on server Xeon
  systems (Sapphire Rapids and newer); client Alder Lake has no such hardware.
  `CONFIG_INTEL_TDX_HOST` is not enabled in the kernel, and enabling it has no
  purpose (checked on 2026-09-22 in `/proc/config.gz`).

## BOLT: why disabled

BOLT is currently not used — it has been temporarily disabled since 2026-07;
the project is waiting for a stable LLVM 23 release and new profiling. The
instructions are preserved in
[`archive/bolt.md`](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/bolt.md) as historical reference. An old profile must not be used blindly; see
[`CHECKPOINT.md`](https://github.com/vovanbl411/gentoo-mydocs/blob/main/CHECKPOINT.md).

Previously, BOLT (Binary Optimization and Layout Tool) was used for critical
components (the LLVM toolchain and Clang) to reorder code within binaries based
on performance profiles (perf). This gave a noticeable compilation-speed gain
on Alder Lake.

## Related docs

- [Boot and Portage](../../system/boot-and-portage/) — toolchain,
  optimization, `-O2` + ThinLTO policy.
- [BOLT (archive)](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/bolt.md)
