---
title: "CPU optimization: Intel Alder Lake (i7-1260P)"
kind: system
scope: system
status: draft
last_verified: "2026-10-10"
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

### Empirical validation: `-march=alderlake` vs `-march=x86-64-v3`

The completed comparison supplied by the owner on 2026-10-10 found no
practically significant performance penalty from portable `x86-64-v3`
relative to workstation-specific `-march=alderlake` in three workload classes:
compression/decompression, crypto/SIMD and Mesa shader compilation.
This provides empirical support for the accepted builder policy, not a
universal guarantee for every package or a reason to change the workstation's
local Alder Lake policy.

#### zstd 1.5.7-r1

Both builds are `app-arch/zstd-1.5.7-r1`: the workstation target is
`-march=alderlake`, the builder target is `-march=x86-64-v3`; the other
material production policy is comparable. The execution host is an ASUS
ExpertBook B5402CBA, Intel Core i7-1260P, pinned to CPU 1 via `taskset`.
Input: `Rocky-8.10-x86_64-boot.iso`, 1086324736 bytes; `zstd -b3 -e3`,
6 runs per variant. The table reports median speeds.

| Workload | `-march=alderlake`, MB/s | `-march=x86-64-v3`, MB/s | Observed difference |
|----------|-------------------------|-------------------------|---------------------|
| Compression | 815.5 | 812.7 | Alder Lake ≈ +0.35% |
| Decompression | 5746.7 | 5728.0 | Alder Lake ≈ +0.33% |

No practically significant loss from portable V3 was found for this workload.

#### OpenSSL 3.5.8

Both builds are OpenSSL 3.5.8. The execution host is the same i7-1260P,
CPU 1; 3 interleaved runs per variant, `openssl speed`, 16384-byte blocks,
a 5-second window. The OpenSSL runtime CPU capability mask was identical.
The table reports median throughput.

| Workload | `-march=alderlake`, kB/s | `-march=x86-64-v3`, kB/s | Observed difference |
|----------|-------------------------|-------------------------|---------------------|
| SHA-256 | 1,056,758 | 1,057,178 | V3 ≈ +0.04% |
| AES-256-GCM | 3,321,747 | 3,340,073 | V3 ≈ +0.55% |
| ChaCha20 | 1,869,817 | 1,866,987 | Alder Lake ≈ +0.15% |

Sub-percent differences do not establish a real advantage for either build.
No practically significant V3 regression was found in any of the three crypto
workloads.

#### Mesa 26.2.4

Mesa 26.2.4 builds were compared using Mesa shader-db on real Intel
Alder Lake-P GT2 / Iris Xe hardware with the real iris userspace driver.
CPU 2, `-j1`, shader cache disabled; warm-up preceded the measured runs.
Separate Mesa trees were selected via `LD_LIBRARY_PATH` /
`LIBGL_DRIVERS_PATH`. There were 3 interleaved measured runs per variant;
each run compiled 8539 shaders.

| Wall time | `-march=alderlake`, s | `-march=x86-64-v3`, s |
|-----------|----------------------|----------------------|
| Run 1 | 113.494 | 103.311 |
| Run 2 | 104.167 | 107.721 |
| Run 3 | 113.034 | 105.198 |
| Mean | ≈ 110.232 | 105.410 |
| Median | 113.034 | 105.198 |

V3 showed ≈ 4.37% lower mean wall time and ≈ 6.93% lower median wall time.
This does not prove that V3 is faster: the Alder Lake runs vary considerably
more, and the sample is small. `x86-64-v3` showed no runtime regression in
this shader-db workload; the observed V3 advantage cannot confidently be
attributed to the CPU target.

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
synchronization completed on 2026-10-09; the owner confirmed local binpkg
production on 2026-10-10: GPKGs were successfully built for
`app-arch/zstd-1.5.7-r1`, `dev-libs/openssl-3.5.8` and
`media-libs/mesa-26.2.4`; the `Packages` index was created during the first
zstd pilot.
The private binhost, end-to-end installation, automatic consumption and
server ON/OFF source fallback are CLOSED / PASS, accepted by the owner on
2026-10-10; see the
[binary build host production workflow](../../system/boot-and-portage/#gentoo-binary-build-host--production)
for OFF-test limits (source path confirmed; the full rebuild/merge was stopped).

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
