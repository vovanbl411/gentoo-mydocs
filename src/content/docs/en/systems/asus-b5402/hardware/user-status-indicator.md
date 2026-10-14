---
title: ASUS ExpertBook B5402CBA User-status indicator
kind: system
scope: system
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

## Current state

As recorded on 2026-10-07, the external orange lid indicator works through
`/sys/class/leds/:status` on `7.2.9-bdsm`. Physical ON/OFF passed acceptance
on 2026-10-04. The local Gentoo patch matches submitted upstream v1 by design:
successful state-read registration, no DMI whitelist or trigger.

### Local kernel patch

File: `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.9/10-asus-wmi-user-status-led.patch`

The patch adds `ASUS_WMI_DEVID_USER_STATUS_LED = 0x00040019` and a binary
LED class device with `max_brightness = 1`, `brightness_set_blocking`, reads
through `asus_wmi_get_devstate_simple()` and writes through
`asus_wmi_set_devstate()`. Registration requires
`asus_wmi_get_devstate_simple(...) >= 0`. The ABI is `":" LED_FUNCTION_STATUS`.

### Upstream status

v1 is submitted / awaiting review; acceptance or merge is not confirmed.
The [submission and validation](../../../../experiments/asus-user-status-indicator/#upstream-v1)
are recorded in the research page. A v2 will be prepared only for specific
review feedback or a newly found issue.

## Gentoo userspace integration

The kernel exposes binary LED control (`0/1`); the `auto`, `busy`, and `off`
modes are implemented separately in userspace. This system runs
[`asus-user-status-led`](https://github.com/vovanbl411/asus-user-status-led):
`busy` forces the LED on, `off` forces it off, and `auto` follows an active
consumer of a real PipeWire `Audio/Source`. Detailed implementation,
architecture, and installation live in that separate project; this page
documents the hardware/kernel path and its integration on Gentoo.

Functional live acceptance passed on the ASUS ExpertBook B5402CBA: manual
`busy`/`off`; AUTO idle; controlled `pw-record` capture with ON → OFF; no false
positive from Noctalia Spectrum; a real Vesktop call turns the LED on, keeps it
on when the application is muted, and turns it off after leaving the call;
Fn+1 mode cycling; and the AUTO CPU feedback-loop fix. Fn+1 follows firmware
event `0x61` → `KEY_SWITCHVIDEOMODE` → `XF86Display` → Niri → `user-status-led`;
one physical press produces one mode transition. The service remains active,
and returning to `auto` during an active call immediately re-evaluates
PipeWire. The CPU-loop fix is live-verified: idle AUTO uses one long-lived
`pw-dump --monitor`, does not continuously spawn plain `pw-dump`, and has low
CPU usage.

Two checks remain open: visual judgment of restart-flicker and the reboot/login
lifecycle. After login, confirm the persisted mode, user-service startup, udev
permissions, normal AUTO startup, no CPU-loop regression, and Fn+1 operation.

## Verification

Verified on the live system on 2026-10-04:

| Parameter | Value |
|-----------|-------|
| Model | ASUS ExpertBook B5402CBA |
| BIOS | `B5402CBA.314` |
| Kernel | `7.2.9-bdsm` |
| Package | `sys-kernel/gentoo-kernel-7.2.9` |
| Registration | `asus_wmi_get_devstate_simple(...) >= 0` |

After booting `7.2.9-bdsm`, `/sys/class/leds/:status` is registered;
`orange:status` is absent. Presence and state reads:

```bash
uname -r
ls -l /sys/class/leds/:status
cat /sys/class/leds/:status/max_brightness
cat /sys/class/leds/:status/brightness
```

Confirmed symlink target:

```text
../../devices/platform/asus-nb-wmi/leds/:status
```

Live values: `max_brightness = 1`, `brightness = 0`. The commands below
change the physical indicator state; writing `0` switches it off.

Switch on:

```bash
printf '1\n' | doas tee /sys/class/leds/:status/brightness
```

Switch off:

```bash
printf '0\n' | doas tee /sys/class/leds/:status/brightness
```

Physical verification on 2026-10-04: `1` lit the external orange User-status
indicator on the lid; `0` switched the same indicator off.

| Live acceptance 2026-10-04 | Result |
|----------------------------|--------|
| `7.2.9-bdsm` boot | PASS |
| Registration `:status` | PASS |
| `orange:status` absent | PASS |
| `max_brightness = 1` | PASS |
| DSTS state read | PASS |
| DEVS write `1` → physical LED ON | PASS |
| DEVS write `0` → physical LED OFF | PASS |

## Related docs

- [ASUS ExpertBook B5402CBA specifics](../asus-expertbook/)
- [ASUS ExpertBook B5402](../../)
- [Firmware identification, Windows reference, ABI rationale and historical diagnostics](../../../../experiments/asus-user-status-indicator/)
