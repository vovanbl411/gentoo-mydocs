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
lid can be switched on and off manually from Linux. Hardware/firmware
identification `ASUS WMI DEVID 0x00040019 ↔ CFLD` and manual binary control
are **CLOSED / PASS** (2026-10-03).

**Gate 3D — Windows reference implementation: CLOSED / PASS**.
Static analysis of the official ASUS Business Utility confirmed
`0x00040019` as binary physical LED control. The three-mode Auto/Busy/Off
policy is stored and applied in Windows userspace.

**Gate 4B — production-style local Linux implementation + live acceptance:
CLOSED / PASS** (2026-10-03). On the reference system, the diagnostic
`asus::cfld-test` was replaced with a production-style local patch. After
the rebuild, the new `asus-wmi` interface `/sys/class/leds/orange:status`
passed live acceptance: state read and physical ON/OFF via brightness
`0/1` work.

The separate next stage, **Gate 4C**, is the upstream-quality review
(submission readiness). The patch is not yet declared upstream-ready.

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

## Linux kernel implementation

File: `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.8/10-asus-wmi-user-status-led.patch`

The production-style local Gentoo user patch adds:

- `ASUS_WMI_DEVID_USER_STATUS_LED = 0x00040019`;
- `struct led_classdev user_status_led`;
- reads through the existing `asus_wmi_get_devstate_simple()` and writes
  through `asus_wmi_set_devstate()`;
- registration only when `asus_wmi_dev_is_present()` confirms the capability;
- the LED ABI `"orange:" LED_FUNCTION_STATUS`;
- `max_brightness = 1`, `brightness_set_blocking`;
- no trigger and no DMI quirk.

Patch architecture:

```text
ASUS WMI DEVID 0x00040019
        ↓
DSTS PRESENCE_BIT / STATUS_BIT
        ↓
asus-wmi
        ↓
orange:status
        ↓
brightness 0/1
```

After rebuilding `sys-kernel/gentoo-kernel-7.2.8`, the interface was
registered as `/sys/class/leds/orange:status`; see Verification for the
detailed checks. The patch is not declared upstream-ready and has not been
submitted upstream — submission readiness is the subject of Gate 4C.

### Why `orange:status`

The Linux LED class uses the standard `color:function` semantics, the
physical indicator color is confirmed as orange, and `LED_FUNCTION_STATUS`
already exists — a vendor-specific name like `asus::cfld-test` is not
needed for the new ABI. `CFLD` is a firmware field with an unknown
expansion and must not become a Linux ABI. `orange:status` is an accepted
local/upstream-oriented design decision, not a decision confirmed by the
upstream maintainers.

### Capability discovery and DMI

`asus_wmi_dev_is_present(... ASUS_WMI_DEVID_USER_STATUS_LED)` is used as
firmware capability discovery. No DMI whitelist is required in the current
implementation: the firmware itself reports `ASUS_WMI_DSTS_PRESENCE_BIT`.
This is not a universal claim about other models — a quirk may still be
needed on other hardware.

### History: diagnostic patch

The initial diagnostic patch `10-asus-wmi-cfld-test.patch` registered the
`asus::cfld-test` LED (reads through `asus_wmi_get_devstate()`, a
deliberately temporary name) and served as the identification/physical
validation stage. After Gates 4A/4B it was removed and replaced with the
production-style patch; the `asus::cfld-test` interface is absent from the
current kernel.

The writable ASUS debugfs interface was unavailable because of kernel
lockdown `integrity`. Secure Boot and lockdown remained enabled throughout
the investigation.

## Windows reference implementation

Gate 3D was completed on 2026-10-03: official Windows packages for B5402CBA
were examined through static analysis. The main component is ASUS Business
Utility `3.5.35.0`, containing `cceventapp.exe` and `confled.dll`.
The FileDescription of `confled.dll` is `Conference LED support package`.
This is the component name, not a proven expansion of the firmware field `CFLD`.

```text
ASUS Business Utility
  ↓
confled.dll (Conference LED support package)
  ↓
mode 0/1/2 in HKCU
  ├─ Auto → audio-session-derived state
  ├─ Busy → LED ON
  └─ Off  → LED OFF
  ↓
DEVS(0x00040019, 0|1)
  ↓
CFLD
  ↓
physical LED
```

### Binary LED control — PROVEN

`confled.dll` directly uses `DSTS(0x00040019)` for presence/status checks
and `DEVS(0x00040019, 0|1)` to switch the LED on/off.
Two transport paths are proven:

| Transport | Call |
|-----------|------|
| ATKACPI | `DeviceIoControl` for `\\.\ATKACPI`, IOCTL `0x22240C`, payload `{'DEVS', 8, 0x00040019, status}` |
| WMI | `ExecMethod` through `AsusAtkWmi_WMNB`, instance `ACPI\PNP0C14\ATK_0`, `Device_ID = 0x00040019`, `Control_status = 0\|1` |

This independently confirms that the identified Linux firmware path matches
the User-status / Conference LED control method implemented in official ASUS software.

### Mode policy in userspace — PROVEN

The state is stored as `REG_DWORD mode` under
`HKCU\Software\ASUS\ASUSBusinessUtility`. At startup, the value is read
and constrained to `0..2`; the default is `0`. Mode changes are written
back to the registry.

`ConfLedService::onEvent` cycles through `0 → 1 → 2 → 0`.
The behavior of `ApplyMode` is proven; mode names are inferred from
official ASUS documentation and static behavior (**STRONG**).
These are reader-facing labels, not C enum constants found in the binary.

| mode | `ApplyMode` behavior — PROVEN | Name — STRONG |
|------|------------------------------|---------------|
| `0` | `SetStatus(session state)` | Auto |
| `1` | `SetStatus(true)` | Solid Orange / Busy / In a meeting |
| `2` | `SetStatus(false)` | Light off |

### Auto: proven mechanism and evidence boundary

**PROVEN:** Auto policy is implemented in the Windows userspace component
`confled.dll`. It uses `AudioSessionMonitor`,
`MeetingAudioSessionNotification`, `MeetingAudioSessionEvents`, and
`IAudioSessionManager2`; a separate monitoring thread waits approximately
`3000 ms`. Only Auto mode sends session-derived state to the LED.

**STRONG:** the automatic state is determined by Windows Core Audio /
capture-session activity. The full capture-session predicate was not
completely disassembled, so this is not a fully proven universal rule.
No process allowlist for Teams/Zoom/Discord/Meet was found; camera/WebRTC
alone are not proven criteria in this path.

In the inspected Windows control path, the physical LED is controlled as
a binary capability through `DSTS/DEVS(0x00040019)`, while userspace applies
the Auto/Busy/Off policy. No separate firmware mode interface was found in
this path. This does not rule out other unknown mode-related capabilities
or firmware control registers.

### Fn+1 and event routing

Previously confirmed on Linux: Fn+1 emits ASUS WMI event `0x61`, which
stock `asus-nb-wmi` maps to `KEY_SWITCHVIDEOMODE`.
On Windows, `ConfLedService::onEvent(0x61)` handles the event and changes
mode; it also handles `0x62–0x64` and part of `0x10–0x1b`.

`confled.dll` is a proven handler of `0x61` for the Conference LED path
when the event is routed to `ConfLedService`. The full routing
`cceventapp.exe → FunctionCommandList / ExpertWidget assignments → plugin`
has not been fully reconstructed. Direct handling of every Fn+1 by this
component therefore cannot be treated as proven.

ExpertWidget provides UI/resources and function assignments for Fn+1…Fn+4;
`ConfLedService` is among the available commands. It is a configuration
surface, not a proven physical LED control implementation. No code usage
of `0x00040019` was found in the inspected ASUS System Control Interface v3.

### Package and reproducibility

Source: the [official ASUS B5402CBA support/download page](https://www.asus.com/supportonly/b5402cba/helpdesk_download/).
The examined package is ASUS Business Utility `3.5.35.0`, published on `2025-01-16`.
Package SHA-256:

```text
2d64897952378f2ed90a9a9c3b14c8e6295c46e52e1af7d1d84193b008974a9b
```

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

After rebuilding the package with the production-style patch and booting
`7.2.8-bdsm`, `/sys/class/leds/orange:status` was registered; the previous
diagnostic interface `asus::cfld-test` is absent from `/sys/class/leds/`.
Check its presence and read its values:

```bash
ls -l /sys/class/leds/orange:status
cat /sys/class/leds/orange:status/max_brightness
cat /sys/class/leds/orange:status/brightness
```

Confirmed symlink target:

```text
../../devices/platform/asus-nb-wmi/leds/orange:status
```

Live values: `max_brightness = 1`, `brightness = 0`. The commands below
change the physical indicator state; writing `0` switches it off.

Switch on:

```bash
printf '1\n' | doas tee /sys/class/leds/orange:status/brightness
```

Switch off:

```bash
printf '0\n' | doas tee /sys/class/leds/orange:status/brightness
```

Physical verification on 2026-10-03: `1` lit the external orange User-status
indicator on the lid; `0` switched the same indicator off.

| Gate 4B check | Result |
|---------------|--------|
| `orange:status` registration | PASS |
| `max_brightness = 1` | PASS |
| DSTS state read | PASS |
| DEVS write `0/1` | PASS |
| Physical ON/OFF | PASS |
| Diagnostic ABI `asus::cfld-test` absent | PASS |

## Limitations and next step

Hardware/firmware identification, manual binary control, Gate 3D, and
Gate 4B (production-style local Linux implementation + live acceptance)
are closed. ASUS Windows Auto policy has been examined statically within
the evidence boundaries above; Linux Auto implementation is absent.

The separate next stage, **Gate 4C — upstream-quality review**, covers
patch style, a repeated naming/API review with upstream-maintainer eyes,
checkpatch and patch formatting, the commit message, submission readiness,
and whether additional evidence/comments are needed for upstream.

Fn+1 remapping and Linux userspace Auto (conference policy, a daemon,
integration with PipeWire/camera/microphone/conferencing applications)
remain separate future questions after kernel support and are not
implemented. The expansion of `CFLD` remains unknown.

## Related docs

- [ASUS ExpertBook B5402CBA specifics](../asus-expertbook/)
- [ASUS ExpertBook B5402](../../)
