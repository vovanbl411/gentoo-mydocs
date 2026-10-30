---
title: ASUS ExpertBook B5402CBA User-status indicator
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

The external User-status indicator on the lid is available through the binary
kernel LED ABI `/sys/class/leds/:status` (`0` is off, `1` is on). ASUS WMI
device ID `0x00040019` is supported by a local, version-specific patch at
`/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.13/10-asus-wmi-user-status-led.patch`.
The laptop kernel is built as a GPKG on `gentoo-builder-01` and installed from
the binrepo; see the [boot and Portage guide](../../system/boot-and-portage/) for
the update workflow.

The userspace controller
[`asus-user-status-led`](https://github.com/vovanbl411/asus-user-status-led)
provides `auto`, `busy`, and `off` modes. The `user-status-led.service` unit
runs `~/.local/bin/user-status-led`. `auto` turns the LED on when an active
PipeWire link connects an `Audio/Source` to a running `Stream/Input/Audio`;
`busy` keeps it on, and `off` keeps it off.

In Umbriel, the `XF86Display` binding runs
`~/.local/bin/user-status-led cycle`; Fn+1 cycles through the modes using this
binding.

## Local kernel patch

The patch adds ASUS WMI device ID `0x00040019` as a binary LED device with
`max_brightness = 1`. It reads and writes the state through ASUS WMI and only
registers the device after a successful state read. This exposes the
`/sys/class/leds/:status` ABI.

The patch is tied to a `sys-kernel/gentoo-kernel` version. When updating the
kernel, move it to the new version-specific directory only after checking that
it applies to the new sources and whether upstream support has appeared. The
research history and upstream submission are in the
[User-status indicator research](../../../../experiments/asus-user-status-indicator/).

## Checking the current state

```bash
uname -r
ls -l /sys/class/leds/:status
cat /sys/class/leds/:status/max_brightness
cat /sys/class/leds/:status/brightness
systemctl --user status user-status-led.service --no-pager
```

The current kernel should expose the `:status` LED ABI with
`max_brightness` set to `1`; the user service runs
`~/.local/bin/user-status-led daemon`.

## Related docs

- [ASUS ExpertBook B5402CBA specifics](./asus-expertbook/)
- [Boot and Portage](../../system/boot-and-portage/) — building the
  version-specific kernel GPKG on the builder and installing it on the laptop
  from the binrepo.
- [ASUS User-status indicator research](../../../../experiments/asus-user-status-indicator/)
