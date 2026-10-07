---
title: "Intel graphics stack on Gentoo: i915, Xe and Mesa"
kind: guide
scope: general
status: draft
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

This guide explains how to distinguish Intel graphics stack build settings
from the GPU's actual state, and how to prepare a verifiable switch from
`i915` to `xe` when it applies to device. A working system does not
require the switch, and it does not guarantee better speed or smoothness.

## 1. What makes up the Intel graphics stack

| Layer | Responsibility |
|-------|----------------|
| Kernel driver | `i915` or `xe`: binding to the GPU, device operation, and display output with display support enabled. |
| Mesa userspace | OpenGL and Vulkan: Iris, ANV, and Zink have different roles. |
| Build/package policy | `VIDEO_CARDS` determines components built by Gentoo packages. |
| Runtime | The driver actually bound to the GPU, a specific application's renderer, and graphics session operation. |

A configured Mesa stack does not prove that the GPU uses `xe`.
Check the kernel driver and userspace separately.

## 2. Kernel driver: i915 and Xe

The choice between `i915` and `xe` depends on the GPU and exact kernel
version. Having the `xe` module does not confirm support for the device or
binding to it. Even if both modules are available or loaded, the actual
driver is determined for the specific PCI device.

In the procedure below, `xe` is built as a module, allowing control over
loading through `modprobe.d` or Dracut. Check display support and additional
features in the configuration of the kernel you use.

## 3. Mesa userspace: Iris, ANV and Zink

- **Iris** — Mesa's OpenGL driver for supported Intel GPUs.
- **ANV** — Mesa's Intel Vulkan driver. Its presence does not determine
  whether the GPU is bound to `i915` or `xe`.
- **Zink** — OpenGL over Vulkan. It can help with debugging or applications
  that need specific extensions implemented in the Vulkan driver; on Intel,
  that driver can be ANV.

An example build policy, not a required setting for every Intel GPU.
File: `/etc/portage/make.conf`

```makefile
VIDEO_CARDS="intel zink"
```

`VIDEO_CARDS="intel zink"` selects driver families but does not replace Mesa's
USE flags: in particular, building ANV also requires `USE=vulkan` to be enabled.

This set includes Intel userspace and Zink, but does not confirm that a
specific application selects Iris or Zink. Distinguish Mesa driver selection
and local overrides from a measured runtime renderer; do not copy an override
from another machine as a required part of switching to Xe.

## 4. How to determine the actual runtime state

Start with the PCI ID and bound kernel driver:

```bash
lspci -nnk
```

Find the GPU and compare the fields: `Kernel driver in use` shows binding,
while `Kernel modules` lists available modules. A list of loaded modules
also does not replace checking the binding.

For Vulkan, if `vulkaninfo` is installed:

```bash
vulkaninfo --summary
```

Check the intended GPU, driver ID, driver name, and Mesa version. Check the
OpenGL renderer separately through application diagnostics or a tool suited
to its graphics backend. Working Vulkan does not confirm the OpenGL renderer,
and `VIDEO_CARDS` is not a runtime verification result.

## 5. When to consider i915 → Xe

Consider switching if the exact kernel version supports your GPU and you have
a reason to test Xe on your graphics stack. Having an Intel GPU alone is not
a reason to change the driver.

Xe gives no universal guarantee of latency, frame presentation, or Wayland
compositor stability. Evaluate the result on your machine, with your normal
applications and displays.

## 6. Preparing the switch

Before changing the driver, check:

- the exact GPU PCI ID and device support in the required kernel sources;
- necessary kernel options and firmware;
- how the GPU driver gets into the initramfs through Dracut;
- which boot artifact needs rebuilding;
- a working `i915` configuration and a fallback accessible from the boot menu.

> **Important**: changing the driver can prevent the graphics session from
> starting. Prepare a working fallback before changing parameters and keep
> it until boot and operation with `xe` have been verified.

Check these options in your kernel version's Kconfig:

- `CONFIG_DRM_XE=m` — the Xe module;
- `CONFIG_DRM_XE_DISPLAY=y` — display output support, required if Xe is to
  drive a display;
- `CONFIG_DRM_XE_DP_TUNNEL=y` — DisplayPort tunneling over Thunderbolt/USB4,
  if that path is used;
- `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT=y` — upstream Kconfig enables
  scheduler timeout limits for applicable users by default.

The last option alone does not protect against GPU resets, guarantee overall
stability, or promise a performance gain.

## 7. force_probe and driver selection

The need for `force_probe` depends on the GPU and exact kernel version. Before
switching, check the device's current upstream support state, including
`require_force_probe` in that version's sources. Loading a module alone does
not change these conditions.

If the device requires explicit Xe selection, use a consistent pair of kernel
parameters:

```text
xe.force_probe=<PCI-ID> i915.force_probe=!<PCI-ID>
```

Here, `<PCI-ID>` means the GPU device ID in the format expected by the driver,
not a PCI address. The pair allows Xe to probe and prevents i915 from probing
the specified device. Do not apply it without checking support. Where to
record the parameters depends on your boot workflow; for UKI, see the
[systemd-boot and UKI guide](../../installation/systemd-uki-setup/).

## 8. Dracut/initramfs and the boot artifact

This minimal example contains only GPU drivers. Choose a separate Dracut
configuration file, such as `/etc/dracut.conf.d/20-intel-graphics.conf`:

```bash
#force_drivers+=" xe "
add_drivers+=" i915 "
```

This variant adds `i915` to the initramfs and disables forced Xe loading.
After checking support, you can enable `force_drivers+=" xe "` for early Xe
loading. Do not remove `i915` from the initramfs until a working fallback has
been prepared and verified.

Update the initramfs and rebuild the boot artifact using your Dracut/UKI
workflow. Editing the Dracut configuration does not change an existing
initramfs or UKI. The build procedure is in the
[UKI guide](../../installation/systemd-uki-setup/).
After rebooting, check the actual GPU binding.

## 9. Verification

Repeat the runtime checks from section 4 and test in practice:

- `Kernel driver in use` matches the intended driver;
- Mesa/OpenGL uses the expected driver, and Vulkan works through ANV;
- rendering, latency/interactive behaviour, and frame presentation are acceptable;
- suspend/resume and external displays work;
- the Wayland compositor, such as Niri, starts and runs stably;
- there are no boot or session problems that require a rollback.

Do not consider the switch complete just because the `xe` module is loaded.
Record binding, firmware, userspace, and session test results separately:
success at one layer does not prove success at the others.

## 10. Rollback

If the system does not boot, the session fails to start, or operation fails
testing, use the prepared working fallback. To restore the changed boot
artifact:

1. If kernel parameters were added, remove or undo both:
   `xe.force_probe=<PCI-ID>` and `i915.force_probe=!<PCI-ID>`.
2. Restore the working Dracut configuration with `i915` and remove or
   re-comment forced `xe` loading.
3. Rebuild the corresponding boot artifact.
4. After booting, check `Kernel driver in use: i915`.

Returning `i915` to the initramfs alone is not enough while
`i915.force_probe=!<PCI-ID>` is active.

## 11. Reference-system example

The switch was tested on ASUS B5402: Xe successfully bound to the GPU and the
Niri/Wayland session worked. After runtime acceptance, the production system
returned to `i915`. Parameters, results, and reasons for the decision are in
the [system document](../../systems/asus-b5402/hardware/graphics/).

## 12. References / Related docs

- [Linux kernel: Xe](https://docs.kernel.org/gpu/xe/index.html) — kernel driver.
- [Linux kernel: `Kconfig`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/Kconfig) — display support and DP tunneling.
- [Linux kernel: `Kconfig.profile`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/Kconfig.profile) — `CONFIG_DRM_XE_ENABLE_SCHEDTIMEOUT_LIMIT`.
- [Linux kernel: `xe_pci.c`](https://github.com/torvalds/linux/blob/master/drivers/gpu/drm/xe/xe_pci.c) — GPU support and `require_force_probe`.
- [Linux kernel: Xe merge acceptance plan](https://docs.kernel.org/6.7/gpu/rfc/xe.html) — the consistent `i915.force_probe=!<PCI-ID>` and `xe.force_probe=<PCI-ID>` pair.
- [Mesa: ANV](https://docs.mesa3d.org/drivers/anv.html) — Intel Vulkan driver.
- [Mesa: Zink](https://docs.mesa3d.org/drivers/zink.html) — OpenGL over Vulkan.
- [ASUS B5402 graphics stack](../../systems/asus-b5402/hardware/graphics/) — machine state and experiment results.
- [Kernel and boot: UKI](../../installation/systemd-uki-setup/) — Dracut, boot artifact rebuilding, and fallback.
