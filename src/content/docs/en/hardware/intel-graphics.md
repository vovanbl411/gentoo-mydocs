---
title: "Intel graphics stack: migrating from i915 to Xe"
kind: guide
scope: general
status: draft
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

## Goal and current state

This document describes the preparation for moving an Intel GPU from the
current `i915` kernel driver to the target `xe`. The presence of the `xe`
module or a configured Mesa stack does not confirm that the GPU is bound to
`xe`: the actually bound kernel driver must be checked separately.

On the ASUS B5402 the migration has not been performed yet. The current
state of this machine is recorded in
[the system section](../../systems/asus-b5402/hardware/graphics/); its values
are not a universal configuration for every Intel GPU.

> **Important**: do not apply the migration automatically just because the
> GPU is made by Intel. First check the specific device, its `xe` support
> and a working rollback path.

## When to apply and what to check in advance

Before changing the driver, check:

- the exact PCI ID of the GPU;
- support for this device by the `xe` driver in the kernel version you use;
- the required kernel options;
- how the GPU driver gets into the initramfs through Dracut;
- a working `i915` configuration you can return to;
- which boot artifact will have to be rebuilt after the Dracut change.

This check defines whether the migration applies. The mere presence of an
Intel GPU, `VIDEO_CARDS="intel zink"` or the `xe` module does not confirm it.

## Target kernel driver: Xe

In the target variant `xe` is built as a module. This allows controlling its
loading through `modprobe.d` or Dracut.

The document lists the following kernel options:

- `CONFIG_DRM_XE=m` — the main module is enabled;
- `CONFIG_DRM_XE_DISPLAY=y` — display output support, required for a laptop;
- `CONFIG_DRM_XE_DP_TUNNEL=y` — DisplayPort tunneling over Thunderbolt/USB4,
  important for the ASUS ExpertBook;
- `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT=y` — the upstream Kconfig enables
  a limit on scheduler timeout values for applicable users by default.

This option by itself is not protection against GPU resets, does not
guarantee overall stability and does not promise a performance gain.

Wayland session smoothness and Niri behavior after such a change must be
tested in practice. This section describes the migration procedure, not the
current ASUS B5402 state.

## Switching and a Dracut example

The existing example shows an intermediate state before the switch: `i915`
is added to the initramfs, and forced `xe` loading is disabled.

File: `/etc/dracut.conf.d/10-drivers.conf`

```bash
# Xe driver for 12th-generation Intel graphics (disabled until the switch)
#force_drivers+=" xe "

add_drivers+=" i915 "

add_drivers+=" nvme "
```

Forced loading of `xe` alone is not enough: a loaded module may not own the
GPU. Perform the migration in this order:

1. Identify the device's PCI ID.
2. Check device support in the sources of the exact kernel version the
   system will boot.
3. Check whether this Xe version requires an explicit `force_probe` for the
   device.
4. If it does, set a consistent pair of kernel parameters:
   `xe.force_probe=<PCI-ID>` and `i915.force_probe=!<PCI-ID>`.
5. Update Dracut/initramfs and rebuild the boot artifact according to your
   Dracut/UKI workflow.
6. Keep a working `i915` fallback.
7. After the reboot, check `Kernel driver in use`.

For the ASUS B5402 PCI ID `46a6`, the pair would look like
`xe.force_probe=46a6 i915.force_probe=!46a6`. Current upstream Linux marks
Alder Lake-P as requiring a force probe for Xe, but the sources of the
specific local kernel `7.2.7-bdsm` were not checked in this audit. So first
confirm the requirement in this version instead of adding the parameters
automatically.

After this check, `force_drivers+=" xe "` can be enabled for early Xe
loading. Do not remove `i915` from the initramfs until a working fallback
has been prepared and verified.

## Mesa, OpenGL and Vulkan

Mesa/OpenGL/Vulkan are a separate part of the graphics stack. Their settings
should not be mixed with the kernel driver choice during the `i915` → `xe`
migration.

The example build policy in `make.conf` specifies the following set:

```makefile
VIDEO_CARDS="intel zink"
```

It enables two approaches to OpenGL rendering:

- **Iris** — the primary OpenGL driver in the given example;
- **Zink** — an alternative that translates OpenGL calls to Vulkan. It is
  useful for debugging or for applications that need specific extensions
  implemented in the ANV Vulkan driver;
- **ANV** — the Intel Vulkan driver in the Mesa userspace. Its presence does
  not determine which kernel driver the GPU is bound to: `i915` or `xe` must
  be checked separately.

On the ASUS B5402 the Iris choice is additionally pinned in
`/etc/env.d/99mesa`:

```bash
MESA_LOADER_DRIVER_OVERRIDE="iris"
```

See the system document for the confirmed policy and the separately measured
runtime state of the ASUS B5402.

## Niri and Wayland

Migrating to `xe` gives no universal guarantee of latency, frame
presentation or Niri stability. After the switch, test rendering, latency
and interactive behavior, frame presentation, suspend/resume, external
displays and Niri session stability in practice.

## Verification after the switch

After booting, check:

- which kernel driver is actually bound to the GPU;
- whether Mesa/OpenGL works with the expected driver;
- whether Vulkan works through ANV;
- whether rendering, latency/interactive behavior and frame presentation are
  correct;
- whether suspend/resume and external displays work;
- whether the Niri Wayland compositor starts and runs stably;
- whether there are boot or graphics session problems that require a
  rollback.

Do not consider the migration complete just because the `xe` module is
loaded.

## Rollback

If after the switch the system does not boot or the graphical session fails
to start:

1. If kernel parameters were added, remove or undo both:
   `xe.force_probe=<PCI-ID>` and `i915.force_probe=!<PCI-ID>`.
2. Restore the working Dracut configuration with `i915` and remove or
   re-comment the forced `xe` loading.
3. Rebuild the corresponding boot artifact.
4. After booting, check `Kernel driver in use: i915`.

Returning `i915` to the initramfs alone is not enough while the
`i915.force_probe=!<PCI-ID>` parameter is active.

The Dracut/initramfs and UKI build procedure is described in
[the systemd-boot and UKI guide](../../installation/systemd-uki-setup/).
A working fallback must be kept until boot and graphics session operation
with `xe` have been verified.

## References

- [Linux kernel: `Kconfig.profile`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/Kconfig.profile) —
  `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT`.
- [Linux kernel: `xe_pci.c`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/xe_pci.c) —
  `adl_p_desc` and `require_force_probe`.
- [Linux kernel: Xe merge acceptance plan](https://docs.kernel.org/6.7/gpu/rfc/xe.html) —
  the consistent `i915.force_probe=!<PCI-ID>` and
  `xe.force_probe=<PCI-ID>` pair for the migration.
- [Mesa: ANV](https://docs.mesa3d.org/drivers/anv.html) — the Intel
  userspace Vulkan driver.

## Related docs

- [ASUS B5402 graphics stack](../../systems/asus-b5402/hardware/graphics/) — the current confirmed state of the machine.
- [Kernel and boot: UKI](../../installation/systemd-uki-setup/) — Dracut, rebuilding the boot artifact and fallbacks.
