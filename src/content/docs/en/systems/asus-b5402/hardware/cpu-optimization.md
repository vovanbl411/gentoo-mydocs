---
title: "CPU optimization: Intel Alder Lake (i7-1260P)"
kind: system
scope: system
status: draft
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- CPU: Intel Core i7-1260P, Alder Lake, with P- and E-cores.
- Workstation userspace uses `-march=alderlake`, `-O2`, and ThinLTO.
- `CPU_FLAGS_X86` matches the instructions available to Portage on this system.
- `intel_pstate` manages CPU frequency in `active` mode.
- The running kernel configuration enables HFI, Intel Idle, RAPL, Turbo Boost
  Max 3.0, and IOMMU. `CONFIG_X86_NATIVE_CPU` and `CONFIG_INTEL_TXT` are
  disabled.
- BOLT is disabled; returning to it requires a separate experiment with a new profile.

## Userspace

The workstation's `CFLAGS` and `CXXFLAGS` use `-march=alderlake`. The current
`CPU_FLAGS_X86` set is:

```makefile
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"
```

Regular portable userspace binpkgs are built on `gentoo-builder-01` for
`x86-64-v3`. This is a separate builder policy; it does not change the Alder
Lake policy for local workstation userspace builds. The [Alder Lake vs
x86-64-v3 comparison](../../../../experiments/compiler-optimization/alderlake-vs-x86-64-v3/)
describes the results and limits of the experiment.

## Kernel

`sys-kernel/gentoo-kernel` for the workstation is built on `gentoo-builder-01`
as a GPKG and is not installed on the builder. The separate `workstation-kernel`
build environment sets `KCFLAGS` to `-march=alderlake -mtune=alderlake` and
`KRUSTFLAGS` to `-C target-cpu=alderlake`. The [boot and Portage
document](../../system/boot-and-portage/#kernel-update-build-a-gpkg-on-the-builder)
describes this workflow.

`CONFIG_X86_NATIVE_CPU` is disabled in the running kernel configuration. This
setting does not describe the compiler flags used for the separate builder
build. The following CPU and platform options are enabled:

- `CONFIG_INTEL_HFI_THERMAL=y` — Hardware Feedback Interface support for the
  hybrid CPU.
- `CONFIG_INTEL_IDLE=y`, `CONFIG_INTEL_RAPL=y`, and `CONFIG_INTEL_TURBO_MAX_3=y`.
- `CONFIG_INTEL_IOMMU=y`, `CONFIG_INTEL_IOMMU_DEFAULT_ON=y`,
  `CONFIG_INTEL_IOMMU_SCALABLE_MODE_DEFAULT_ON=y`, and
  `CONFIG_INTEL_IOMMU_SVM=y`.
- `CONFIG_INTEL_TDX_HOST` and `CONFIG_INTEL_TXT` are disabled.

The running system uses the `intel_pstate` frequency driver in `active` mode.

## BOLT

BOLT is not used. The old instructions are preserved in the
[BOLT archive](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/bolt.md).
Returning to BOLT requires a separate experiment with new profiling.

## Related docs

- [Boot and Portage](../../system/boot-and-portage/) — toolchain and the
  separate workstation kernel build workflow.
- [Alder Lake vs x86-64-v3 comparison](../../../../experiments/compiler-optimization/alderlake-vs-x86-64-v3/) — results of the target comparison.
