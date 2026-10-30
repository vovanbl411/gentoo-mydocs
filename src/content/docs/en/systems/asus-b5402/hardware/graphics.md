---
title: Graphics stack on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

The integrated GPU is Intel Alder Lake-P GT2 (Iris Xe Graphics, PCI
`8086:46a6`). The production driver is `i915`, and the GPU is bound to it.
Mesa uses the `iris` OpenGL override, while Portage builds graphics packages
with `VIDEO_CARDS="intel zink"`. No separate Vulkan override variables are
configured.

## Kernel driver

File: `/etc/dracut.conf.d/10-drivers.conf`

```bash
#force_drivers+=" xe "
add_drivers+=" i915 "
add_drivers+=" nvme "
```

The `xe` module can be loaded at the same time as `i915`; that does not mean
the GPU is using `xe`. The device is currently bound to `i915`, and Dracut is
not configured to load `xe` early.

## Mesa

File: `/etc/env.d/99mesa`

```bash
MESA_LOADER_DRIVER_OVERRIDE="iris"
```

This variable selects the Mesa OpenGL driver. For package builds, Portage uses
`VIDEO_CARDS="intel zink"` from `/etc/portage/make.conf`. The document does
not pin a current runtime Mesa version or Vulkan renderer; these depend on the
installed graphics stack and available runtime device.

## Xe experiment — 2026-09-27

On kernel `7.2.8-bdsm`, the GPU was switched to Xe with the parameters
`xe.force_probe=46a6 i915.force_probe=!46a6`; the Niri/Wayland session
started. During normal use, the display felt less smooth than with `i915`. An
additional test with `xe.enable_psr2_sel_fetch=0` did not fix this; normal
smoothness returned after switching back to `i915`. Firmware loaded, so GPU
binding and missing firmware were not the reason for the rollback. Xe is not
used as the production driver for now.

The general setup procedure is in the
[Intel graphics stack on Gentoo guide](../../../../hardware/intel-graphics/).

## Related docs

- [Intel graphics stack on Gentoo: i915, Xe, and Mesa](../../../../hardware/intel-graphics/)
