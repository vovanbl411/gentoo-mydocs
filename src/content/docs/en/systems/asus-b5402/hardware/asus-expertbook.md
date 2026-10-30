---
title: ASUS ExpertBook B5402CBA specifics
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- TLP manages power. `tlp-pd` provides the power profile interface for
  Noctalia; both services are running.
- The `BAT1` charge threshold is set to 80% in
  `/etc/tlp.d/99-custom.conf`.
- The running kernel enables `CONFIG_ASUS_WMI=m`,
  `CONFIG_ASUS_NB_WMI=m`, and `CONFIG_ASUS_WMI_DEPRECATED_ATTRS=y`.
- Umbriel is the production desktop. Its configuration handles brightness
  keys with `brightnessctl`, audio keys with `wpctl`, and uses `XF86Display`
  to cycle the User-status indicator mode.
- The kernel User-status LED ABI, userspace modes, and limitations are
  documented on the [dedicated page](../user-status-indicator/).

## Power and battery

TLP manages power profiles and the charge threshold. `tlp-pd` provides Noctalia
with a power profile interface; the shell gets battery state through
`sys-power/upower`. A separate `sys-power/power-profiles-daemon` is not used.

`/etc/tlp.d/99-custom.conf` enables Intel HWP dynamic boost on AC and in the
normal battery profile. It is disabled for the `power-saver` profile. The
charge threshold limits `BAT1` to 80%.

File: `/etc/tlp.d/99-custom.conf`

```conf
STOP_CHARGE_THRESH_BAT1=80
CPU_HWP_DYN_BOOST_ON_AC=1
CPU_HWP_DYN_BOOST_ON_BAT=1
CPU_HWP_DYN_BOOST_ON_SAV=0
```

Do not set this threshold separately through UPower or directly through sysfs.

## ASUS kernel support

The running kernel enables:

- `CONFIG_ASUS_WMI=m` — the base ASUS WMI driver, also used by TLP for the
  charge threshold.
- `CONFIG_ASUS_NB_WMI=m` — the ASUS laptop driver, including hotkeys and
  system indicators.
- `CONFIG_ASUS_WMI_DEPRECATED_ATTRS=y` — compatibility attributes for older
  management utilities.

`CONFIG_ASUS_ARMOURY` is not used because it does not provide useful
power-management attributes on this model.

## Keys and indicators

Umbriel handles multimedia/Fn keys in `~/.config/umbriel/keybinds.toml`:

- `XF86MonBrightnessUp` and `XF86MonBrightnessDown` change brightness through
  `brightnessctl --class=backlight`.
- Volume and mute keys call `wpctl`; playback controls use `playerctl`.
- `XF86Display` runs `~/.local/bin/user-status-led cycle`; Fn+1 cycles the
  indicator modes through this binding.
- The keyboard backlight is available at
  `/sys/class/leds/asus::kbd_backlight`.

Umbriel is the [production desktop](../desktop/environment/); installation
and configuration are covered in the [Umbriel guide](../../../../desktop/umbriel/).

## Checking the current state

```bash
doas tlp-stat -s
doas tlp-stat -c
doas tlp-stat -b
cat /sys/devices/system/cpu/intel_pstate/hwp_dynamic_boost
```

Check that TLP and `tlp-pd` are running, `BAT1` uses an 80% threshold, and
`hwp_dynamic_boost` matches the active power profile.

## Related docs

- [User-status indicator](../user-status-indicator/)
- [Boot and Portage](../../system/boot-and-portage/) — building the
  version-specific kernel GPKG on the builder and installing it on the laptop
  from the binrepo.
- [CPU optimization: Intel Alder Lake](../cpu-optimization/)
