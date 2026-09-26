---
title: ELAN 04f3:0c77 experiment history
kind: reference
scope: system
status: historical
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

The ELAN `04f3:0c77` experiment was completed on 2026-09-27. This URL remains
for historical links; this page is no longer an installation guide.

The earlier quirk-based approach did not account for protocol differences in
the `04f3:0c77` firmware. Working support came from a current patchset for
Gentoo's `sys-auth/libfprint`, installed through Portage. The old instructions
using `xerootg/libfprint`, manual driver edits, quirk iteration, `ninja install`,
and a separate udev rule are no longer the current procedure.

- [Current Gentoo guide](../../hardware/elan-fingerprint-04f3-0c77/)
- [ASUS ExpertBook B5402 system state](../../systems/asus-b5402/hardware/fingerprint/)

Historical discussions: [Linux Surface](https://github.com/linux-surface/linux-surface/issues/1380),
[depau/elanpoc](https://github.com/depau/elanpoc/issues/2).
