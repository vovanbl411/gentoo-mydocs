---
title: ASUS ExpertBook B5402CBA specifics
kind: system
scope: system
status: draft
last_verified: "2026-09-14"
verified_on: [asus-b5402]
---

## Current state

- Power is managed by TLP; `tlp-pd` provides power profiles for Noctalia.
- Battery charge is limited to 80%; the battery is identified as `BAT1`.
- `CONFIG_ASUS_WMI=m` and `CONFIG_ASUS_NB_WMI=m` are enabled in the kernel;
  `CONFIG_ASUS_ARMOURY` is disabled.
- Fn keys and backlight work through asus-nb-wmi; key handling is configured
  through binds in Niri.

## Power management and battery (TLP)

Power is managed by `sys-power/tlp-1.10.1` with `ppd` and `rdw` enabled.
`tlp-pd` provides Noctalia with the standard interface for switching profiles,
while `sys-power/upower` reports battery state to the shell. A separate
`sys-power/power-profiles-daemon` is not used.

By default, TLP selects `performance` on AC power and `balanced` on battery.
For extended battery operation, the `power-saver` profile is available
manually.

To extend battery lifetime while working on AC power, charging is limited to
80%.

The battery is identified in the system as `BAT1`.

File: `/etc/tlp.d/99-custom.conf`

```conf
# Charging limit for ASUS
STOP_CHARGE_THRESH_BAT1=80
```

Do not set this threshold separately through UPower or directly through sysfs.

## ASUS support in the kernel (Kconfig)

The saved Gentoo configuration
(`/etc/portage/savedconfig/sys-kernel/gentoo-kernel`) enables:

- `CONFIG_ASUS_NB_WMI=m`: the main driver for ASUS laptops (hotkeys,
  Bluetooth, Wi-Fi).
- `CONFIG_ASUS_WMI=m`: the basic ASUS WMI driver; TLP also uses it for the
  battery charge threshold.
- `CONFIG_ASUS_WMI_DEPRECATED_ATTRS=y`: required for compatibility with some
  older management utilities.

Historical nuance: `CONFIG_ASUS_ARMOURY` is disabled. On this model the driver
did not provide useful power-management attributes and printed
`No matching power limits found for this system`. The change takes effect
after the next rebuild and boot of a new kernel; `CONFIG_ASUS_WMI` remains
enabled.

## Function keys and indicators

Fn keys and system indicators work through the asus-nb-wmi module.

- **Keyboard backlight**: adjusted through
  `/sys/class/leds/asus::kbd_backlight`.
- **Multimedia keys**: in the tiling compositor (Niri), key handling is
  configured through binds that invoke:
  - `light` — to control display brightness.
  - `wpctl` — to control PipeWire audio streams.

## Battery state

Readings on 2026-09-14:

- **Design Capacity**: 5260 mAh
- **Full Charge Capacity**: 4301 mAh
- **Health (Capacity)**: 81.8%
- **Cycle Count**: 137

## Verification

```bash
doas tlp-stat -s
tlpctl list
doas tlp-stat -b
```

On 2026-09-14, `tlp-stat -b` confirmed the active `natacpi (asus_wmi)` plugin,
the value `charge_control_end_threshold = 80`, and the `Not charging` state at
80.3% charge.

## Related docs

- [Niri](../../../../desktop/niri/) — multimedia-key handling.
- [CPU optimization: Intel Alder Lake](../cpu-optimization/)
