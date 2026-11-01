---
title: Gentoo Linux Documentation
kind: reference
scope: repository
status: current
last_verified: "2026-11-01"
verified_on: []
---

Practical Gentoo Linux documentation with reusable guides, the documented
state of the ASUS ExpertBook B5402 reference workstation, troubleshooting for
specific problems, and experiment results. Main topics include hardened/systemd
Gentoo, compiler toolchains, a Wayland desktop, systemd-boot and UKI, Btrfs and
Snapper, Secure Boot, and TPM 2.0.

## What you'll find

- **General guides** — reusable instructions; configuration examples may need
  adapting to different hardware and workloads.
- **ASUS B5402 state** — configuration and decisions for one specific
  workstation, documented in the [system section](./systems/asus-b5402/).
- **Troubleshooting** — diagnosis and recovery for specific problems.
- **Experiments** — measurements and test results behind selected decisions.
  These records may describe past states and may not match the current system
  configuration.

## Where to start

- [Manual Gentoo amd64 installation](./installation/gentoo-installation/) —
  the verified path here is BIOS + GPT + GRUB; the UEFI path is not verified
  in this guide.
- [Base system configuration](./installation/base-system/) — a Portage and
  toolchain example to adapt to your system.
- [Umbriel and Noctalia](./desktop/umbriel/) — the current Wayland desktop;
  [Niri](./desktop/niri/) remains the fallback session.
- [ASUS ExpertBook B5402](./systems/asus-b5402/) — the documented current state
  of the reference workstation.

The policy, contributing guide, and archive are in the
[GitHub repository](https://github.com/vovanbl411/gentoo-mydocs), not on the
documentation site.
