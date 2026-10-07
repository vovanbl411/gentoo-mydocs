---
title: Graphics stack on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

## Current state

The production kernel driver is `i915`. Xe was tested and rejected for the
current stack: the Niri/Wayland desktop consistently felt less smooth with Xe.
There is no active Xe migration. Retest after a substantial change to the
kernel, Xe display stack, or firmware.

- GPU: Intel Alder Lake-P GT2 (Iris Xe Graphics), PCI `8086:46a6`
- Production kernel driver: `i915`
- OpenGL policy / override: `MESA_LOADER_DRIVER_OVERRIDE="iris"`
- VIDEO_CARDS (build policy): `intel zink`
- Vulkan driver ID: `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`
- Vulkan driver: Intel open-source Mesa driver, Mesa `26.2.2`

This is the recorded state, not a new live graphics verification. The OpenGL
override is policy; the runtime OpenGL renderer was not directly re-checked
at the time. Verification below lists the dates and scope of the checks.

## Kernel driver

- The GPU is actually bound to `i915` — `Kernel driver in use: i915`.
- Loading `xe` alone does not mean the GPU is bound to it.

File: `/etc/dracut.conf.d/10-drivers.conf`

```bash
#force_drivers+=" xe "
add_drivers+=" i915 "
add_drivers+=" nvme "
```

## Userspace graphics

The Iris choice is pinned in `/etc/env.d/99mesa`:

```bash
MESA_LOADER_DRIVER_OVERRIDE="iris"
```

- The `MESA_LOADER_DRIVER_OVERRIDE="iris"` policy is set for OpenGL. The
  actual runtime renderer was not checked directly on 2026-09-23: `glxinfo` is
  absent from the system.
- Mesa build policy: `VIDEO_CARDS="intel zink"`.
- Vulkan reports `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`, the name
  `Intel open-source Mesa driver`, and Mesa version `26.2.2`.

## Xe experiment — 2026-09-27

Before the test, the GPU was bound to `i915`; both modules were available:
`Kernel modules: i915, xe`.

On `7.2.8-bdsm`, GPU `8086:46a6` was switched to Xe with
`xe.force_probe=46a6 i915.force_probe=!46a6` and early loading of `xe` through
Dracut (`force_drivers+=" xe "`). The recorded upstream Linux 7.2.8 source
check noted that the Alder Lake-P descriptor `adl_p_desc` contains
`.require_force_probe = true`. This observation applies to the version used
in the experiment, not to every future kernel.

The check showed `Kernel driver in use: xe`; Xe initialized and the
Niri/Wayland session worked. DMC `i915/adlp_dmc.bin` 2.20, GuC
`i915/adlp_guc_70.bin` 70.49.4, and HuC `i915/tgl_huc.bin` 7.9.3 loaded
from `sys-kernel/linux-firmware-20260916`.
The firmware check passed. GPU binding and firmware were not the reason for
the rollback.

During normal use, the display consistently felt less smooth than with
`i915`. A separate test with `xe.enable_psr2_sel_fetch=0` brought no noticeable
improvement. Normal smoothness returned after the rollback to `i915`.
The result: basic Xe operation is confirmed, but the smoothness test failed;
`i915` remains the production driver. The `xe.enable_psr2_sel_fetch=0`
parameter was not kept. Another Xe test makes sense after a substantial
change to the kernel, Xe display stack, or firmware.

The general migration procedure is in the
[Intel graphics stack on Gentoo guide](../../../../hardware/intel-graphics/).

## Verification

- PCI ID, kernel driver, loaded modules, Dracut, graphics policy, and Vulkan
  were checked against the system on 2026-09-23.
- Xe binding, firmware loading, the Niri/Wayland session, smoothness testing,
  and the return to `i915` were confirmed on 2026-09-27 with `7.2.8-bdsm`.
- The runtime OpenGL renderer was not checked again: `glxinfo` is absent.

## Related docs

- [Intel graphics stack on Gentoo: i915, Xe and Mesa](../../../../hardware/intel-graphics/)
