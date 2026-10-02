---
title: ASUS ExpertBook B5402CBA User-status indicator
kind: system
scope: system
status: current
last_verified: "2026-10-03"
verified_on: [asus-b5402]
---

## Current state

The external orange User-status indicator on the ASUS ExpertBook B5402CBA
lid can be switched on and off manually from Linux. Physical verification
on 2026-10-03 confirmed the mapping `ASUS WMI DEVID 0x00040019 ↔ CFLD`.
Hardware/firmware identification and manual control are **CLOSED / PASS**.

The current interface is the temporary LED class interface `asus::cfld-test`,
added by a diagnostic local kernel patch. It is a validation mechanism;
the final name and full support have not been decided yet.

## Hardware and firmware path

```text
ASUS ExpertBook B5402CBA User-status indicator
        ↕
ASUS WMI DEVID 0x00040019
        ↕
firmware field CFLD
        ↕
asus-wmi DEVS / DSTS
```

The `CFLD` field is in an EC/platform-backed area of the DSDT next to `KBLS`
and `MICS`. DSTS reads the state; DEVS writes it when the EC is available.
The exact expansion of the name `CFLD` has not been found.

## Why stock Linux did not expose the indicator

In Linux stable 7.2.8, `include/linux/platform_data/x86/asus-wmi.h`
contains these known DEVIDs:

| Define | DEVID |
|--------|-------|
| `ASUS_WMI_DEVID_MICMUTE_LED` | `0x00040017` |
| `ASUS_WMI_DEVID_LIGHTBAR` | `0x00050025` |
| `ASUS_WMI_DEVID_CAMERA_LED` | `0x00060079` |

The upstream driver does not know `0x00040019` and does not create an LED
class device for it. Before the experiment, `/sys/class/leds/` contained
`platform::micmute` and `asus::kbd_backlight`, but no separate User-status LED.

## Firmware evidence

The DSDT in BIOS `B5402CBA.314` implements DSTS reads for `0x00040019`:

```text
If ((IIA0 == 0x00040019))
{
    Local0 = 0x00010000
    If (^^PC00.LPCB.EC0.CFLD)
    {
        Local0 |= One
    }

    Return (Local0)
}
```

`0x00010000` is `ASUS_WMI_DSTS_PRESENCE_BIT`; the low status bit reports
the current state. DEVS writes:

```text
If ((IIA0 == 0x00040019))
{
    If (^^PC00.LPCB.ECOK ())
    {
        If ((IIA1 == One))
        {
            ^^PC00.LPCB.EC0.CFLD = One
        }
        Else
        {
            ^^PC00.LPCB.EC0.CFLD = Zero
        }

        Return (One)
    }
}
```

This is a separate read/write contract: the adjacent `MICS` field is used
by the known `ASUS_WMI_DEVID_MICMUTE_LED = 0x00040017`.

Two publicly saved DSDTs for `ASUS EXPERTBOOK B5402CBA_B5402CBA` also contain
the `0x00040019 ↔ CFLD` mechanism. The capability is not limited to the
single verified BIOS 314 DSDT; physical control was confirmed on the system
listed in Verification.

Sources in [asus-linux-drivers/asus-dsdt-tables](https://github.com/asus-linux-drivers/asus-dsdt-tables), with links pinned to a commit:

- [ASUS_EXPERTBOOK_B5402CBA_B5402CBA_14717d7a8234.dsl](https://github.com/asus-linux-drivers/asus-dsdt-tables/blob/b1058fccee0d43f373e3b06c03ca5dac9fab7418/data/ASUS_EXPERTBOOK_B5402CBA_B5402CBA_14717d7a8234.dsl)
- [ASUS_EXPERTBOOK_B5402CBA_B5402CBA_1a4ea24a479d.dsl](https://github.com/asus-linux-drivers/asus-dsdt-tables/blob/b1058fccee0d43f373e3b06c03ca5dac9fab7418/data/ASUS_EXPERTBOOK_B5402CBA_B5402CBA_1a4ea24a479d.dsl)

Other candidates checked:

- `ASUS_WMI_DEVID_LIGHTBAR = 0x00050025` and
  `ASUS_WMI_DEVID_CAMERA_LED = 0x00060079` have no explicit DSTS/DEVS branches
  in the inspected `WMNB` and were not exposed by stock `asus-wmi` on this
  system; they were not confirmed as the User-status indicator mechanism.
  `WMNB` has a generic fallback through `WCHK → W15H`, so the absence of
  an explicit branch alone does not prove the absence of firmware support.
- The firmware rejects `0x00060078` with `0xFFFFFFFE`.
- `0x00050027` and `0x00060074` have explicit branches returning `Zero`;
  usable control semantics for the User-status indicator have not been established.
  The meaning of `Return (Zero)` depends on the WMI method/context being called.
- `LBLV` / `LBLS` are only declared and unused;
  `WLED` / `BLED` are stubs returning `Zero`.

## Diagnostic kernel patch

File: `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.8/10-asus-wmi-cfld-test.patch`

The minimal Gentoo user patch adds:

- a temporary define for DEVID `0x00040019`;
- `struct led_classdev cfld_led`;
- reads through `asus_wmi_get_devstate()` and writes through
  `asus_wmi_set_devstate()`;
- registration only when `asus_wmi_dev_is_present()` confirms the capability;
- the diagnostic name `asus::cfld-test`.

The name is deliberately temporary to avoid assigning semantics before a
separate decision. The patch was used for validation and is not considered
ready for upstream.

The writable ASUS debugfs interface was unavailable because of kernel
lockdown `integrity`. Secure Boot and lockdown remained enabled throughout
the investigation.

## Verification

Verified on the live system on 2026-10-03:

| Parameter | Value |
|-----------|-------|
| Model | ASUS ExpertBook B5402CBA |
| BIOS | `B5402CBA.314` |
| Kernel | `7.2.8-bdsm` |
| Package | `sys-kernel/gentoo-kernel-7.2.8` |
| ASUS WMI | `CONFIG_ASUS_WMI=m`, `CONFIG_ASUS_NB_WMI=m` |
| Secure Boot | enabled |
| Kernel lockdown | `integrity` |

After rebuilding the package with the diagnostic patch and booting
`7.2.8-bdsm`, `/sys/class/leds/asus::cfld-test` was registered.
Check its presence and read its values:

```bash
ls -l /sys/class/leds/asus::cfld-test
cat /sys/class/leds/asus::cfld-test/max_brightness
cat /sys/class/leds/asus::cfld-test/brightness
```

Confirmed symlink target:

```text
../../devices/platform/asus-nb-wmi/leds/asus::cfld-test
```

The observed values were `max_brightness = 1` and `brightness = 0`.
The commands below apply to the system with this patch and the registered
LED. They change the physical indicator state; writing `0` switches it off.

Switch on:

```bash
printf '1\n' | doas tee /sys/class/leds/asus::cfld-test/brightness
```

Switch off:

```bash
printf '0\n' | doas tee /sys/class/leds/asus::cfld-test/brightness
```

Physical verification on 2026-10-03: `1` lit the external orange User-status
indicator on the lid; `0` switched the same indicator off. **ON/OFF — PASS**.

## Limitations and next step

Hardware/firmware identification and manual control are closed.
The final LED name and the decision on upstream support remain a separate
next stage. The diagnostic patch is not an upstream-ready interface.

Automatic integration with PipeWire, camera, microphone, or conferencing
applications has not been implemented. The behavior of `auto` mode has
not been investigated or implemented. The expansion of `CFLD` remains unknown.

## Related docs

- [ASUS ExpertBook B5402CBA specifics](../asus-expertbook/)
- [ASUS ExpertBook B5402](../../)
