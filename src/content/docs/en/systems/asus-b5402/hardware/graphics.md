---
title: Graphics stack on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

## Current state

The GPU currently runs through `i915`. The transition to Xe has not been made
yet.

- GPU: Intel Alder Lake-P GT2 (Iris Xe Graphics), PCI `8086:46a6`
- Kernel driver: `i915`
- OpenGL policy / override: `MESA_LOADER_DRIVER_OVERRIDE="iris"`
- VIDEO_CARDS (build policy): `intel zink`
- Vulkan driver ID: `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`
- Vulkan driver: Intel open-source Mesa driver, Mesa `26.2.2`
- Kernel modules: `i915` and `xe` are loaded; `xe` has usage `0` and does not
  own the GPU

## Kernel driver

- The GPU is actually bound to `i915` — `Kernel driver in use: i915`.
- Both modules — `i915` and `xe` — are loaded at runtime. Loading `xe` alone
  does not mean the GPU has transitioned to Xe: the driver in use remains
  `i915`.

File: `/etc/dracut.conf.d/10-drivers.conf`

```conf
#force_drivers+=" xe "
add_drivers+=" i915 "
add_drivers+=" nvme "
```

## Userspace graphics

- The `MESA_LOADER_DRIVER_OVERRIDE="iris"` policy is set for OpenGL. The
  actual runtime renderer was not checked directly on 2026-09-23: `glxinfo` is
  absent from the system.
- Mesa build policy: `VIDEO_CARDS="intel zink"`.
- Vulkan reports `DRIVER_ID_INTEL_OPEN_SOURCE_MESA`, the name
  `Intel open-source Mesa driver`, and Mesa version `26.2.2`.

## Xe transition

The GPU transition from `i915` to Xe has not been performed. The target
configuration and procedure are in the
[Intel Graphics guide](../../../../hardware/intel-graphics/).

## Verification

- PCI ID, kernel driver, loaded modules, Dracut, graphics policy, and Vulkan
  were checked against the system on 2026-09-23.
- The runtime OpenGL renderer was not checked again: `glxinfo` is absent.

## Related docs

- [Intel Graphics: Xe driver and Vulkan](../../../../hardware/intel-graphics/)
