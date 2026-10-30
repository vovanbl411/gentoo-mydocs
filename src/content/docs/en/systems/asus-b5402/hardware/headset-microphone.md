---
title: ASUS ExpertBook B5402CBA headset microphone
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

The ASUS ExpertBook B5402CBA uses a Realtek ALC294 codec with subsystem ID
`1043:1b2f`. The local version-specific patch
`20-asus-b5402-headset-mic.patch` is applied for the current version of
`sys-kernel/gentoo-kernel` and assigns the existing quirk
`ALC2XX_FIXUP_HEADSET_MIC`. No persistent `hda_model` override is used. The
codec dump shows pin `0x19` with `IN VREF_80` and headset mic topology. ALSA
shows the `Headset Mic Jack`, `Capture`, and `Headset Mic Boost` controls, while
PipeWire shows the `Stereo Microphone` source. This confirms the topology, but
functional capture with a compatible CTIA TRRS headset has not been confirmed.

## Current configuration

ALC294 uses the standard `snd_hda_codec_alc269` driver with
`CONFIG_SND_HDA_CODEC_ALC269=m`. The local quirk is selected automatically by
SSID `1043:1b2f`; the production command line does not include the
`snd_sof_intel_hda_generic.hda_model` parameter. This quirk does not require
`HWDEP`, `RECONFIG`, or `PATCH_LOADER`.

## Local patch

File: `/etc/portage/patches/sys-kernel/gentoo-kernel-<version>/20-asus-b5402-headset-mic.patch`

`<version>` must match the selected version of `sys-kernel/gentoo-kernel`. The
[Boot and Portage section](../../system/boot-and-portage/) describes building
the GPKG on the builder and installing the kernel.

The patch adds this entry to the quirk table in
`sound/hda/codecs/realtek/alc269.c`:

```c
SND_PCI_QUIRK(0x1043, 0x1b2f,
              "ASUS ExpertBook B5402CBA",
              ALC2XX_FIXUP_HEADSET_MIC),
```

The entry matches the laptop's subsystem ID to an existing Realtek fixup. It
does not add a custom codec configuration algorithm. The patch is tied to the
kernel ebuild version.

## Why the quirk is needed

The quirk was selected after diagnostics:

- The firmware init config for pin `0x19` (`0x411111f0`, N/A) did not create a
  working headset mic topology.
- Enabling the dedicated ALC294 driver alone was not enough.
- The diagnostic `hda_model=headset-mode` override did not add a microphone
  input.
- `hda_model=alc2xx-fixup-headset-mic` added the headset mic to the topology.

The production configuration therefore applies the same existing fixup
automatically by SSID, without a persistent diagnostic override.

## Upstream example

Linux uses the `ALC2XX_FIXUP_HEADSET_MIC` quirk for the ASUS Vivobook S14
S5406SA, which has an ALC294 codec and a similar issue:
[commit f2d08f3651fb12634347fef2c41687a807a7dcba](https://github.com/torvalds/linux/commit/f2d08f3651fb12634347fef2c41687a807a7dcba).
This is a precedent for choosing the fixup on another device; it does not
confirm upstream support for the B5402. Upstream inclusion of the B5402 is not
confirmed here, so the local configuration continues to use a version-specific
patch.

## What remains unconfirmed

The presence of the topology and the `Stereo Microphone` source does not show
that the combo jack receives a signal from an external microphone. Functional
capture with a known-compatible CTIA TRRS headset or adapter has not yet been
tested. A previous attempt with an available device produced no signal, but
that device's compatibility with the combo jack was not confirmed; the result
therefore does not show that the quirk is faulty.

## Checking the current state

The commands below only read system state. First identify the ALSA card number
in `/proc/asound/cards`.

```bash
uname -r
cat /proc/cmdline
cat /sys/module/snd_sof_intel_hda_generic/parameters/hda_model
cat /proc/asound/cards

for f in /proc/asound/card*/codec#*; do
    [ -r "$f" ] || continue
    echo "== $f =="
    grep -n -A14 -B2 'Node 0x19' "$f" || true
done

amixer -c <card-number> scontrols
amixer -c <card-number> contents | rg -n 'Headset Mic|Mic Jack|Capture|Boost'
wpctl status
```

In the codec dump, check for `Codec: Realtek ALC294`,
`Subsystem Id: 0x10431b2f`, pin `0x19`, and its `Pin-ctls` value. Look for
`Stereo Microphone` in `wpctl status`. A value of `(null)` for `hda_model`
means that no override is set.

## Future external microphone test

Run this test with a known-compatible CTIA TRRS headset or adapter. Check jack
detection and the `Headset Mic Jack` state in ALSA. Then find the source ID for
`Stereo Microphone` in `wpctl status` and record a few words:

```bash
pw-record --target <source-id> /tmp/headset-mic-test.wav
# Say a few words, then stop recording with Ctrl+C.
pw-play /tmp/headset-mic-test.wav
```

Success means the recording contains audio from the headset's external
microphone.

## Rollback

To revert the quirk, remove `20-asus-b5402-headset-mic.patch` from the
version-specific patch directory in use, then rebuild the workstation kernel
using the [accepted GPKG procedure](../../system/boot-and-portage/). If a
regression occurs, boot the previous working kernel. Keep
`CONFIG_SND_HDA_CODEC_ALC269=m` enabled.
