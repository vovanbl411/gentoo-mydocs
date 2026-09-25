---
title: ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

The primary Gentoo system and the reference for this repository's
guides. This section records the machine's actual state separately from
the general instructions.

## Current state

- Gentoo hardened/systemd (no-multilib); the main toolchain is
  Clang/LLD 22, globally `-O2` + ThinLTO.
- Intel Core i7-1260P (Alder Lake, hybrid P/E cores).
- Intel Iris Xe graphics — the i915 kernel driver, Mesa iris, Vulkan
  ANV.
- Desktop — Niri (pure Wayland) + Noctalia v5; login via
  greetd/tuigreet.
- Kernel `7.2.7-bdsm` — built with LLVM 23.1.1; boot chain: systemd-boot
  → UKI (Dracut) → LUKS2/TPM2 → Btrfs.
- Storage — Btrfs + Snapper; second NVMe: state verified, the
  backup/data plan not applied (the old Arch/LUKS layout is still
  there).
- Power — TLP, battery charge limited to 80%.
- Network — NetworkManager + iwd (Intel AX201), nftables, NetBird
  mesh-VPN.
- Security — Secure Boot, TPM 2.0, AppArmor, doas.

## Desktop

- [Noctalia v5](desktop/noctalia/) — the installed version, the package
  source and the local keyword policy.
- [Niri, portals and GTK](desktop/environment/) — the recorded state of
  the desktop environment and the polkit agent.

## Hardware

- [ASUS ExpertBook B5402CBA](hardware/asus-expertbook/) — kernel
  drivers, TLP and the battery.
- [Intel Alder Lake i7-1260P](hardware/cpu-optimization/) — compilation
  flags, the scheduler, hardware security.
- [Intel Graphics](hardware/graphics/) — i915/xe, Mesa, Vulkan.
- [Second NVMe and backups](hardware/second-disk/) — the disk state was
  verified on 2026-09-22; the plan has not been applied.

## Boot and Portage

- [Boot and Portage](system/boot-and-portage/) — the toolchain,
  optimization, package.env, kernel and UKI.
- [BIOS/UEFI updates](system/bios-update/) — a verified procedure for
  Secure Boot, `sbctl`, LUKS2 and TPM2.

## Storage

- [Btrfs and Snapper](filesystem/layout-and-snapshots/) — subvolumes,
  mount options, snapshot limits.

## Networking

- [NetworkManager, Docker and Libvirt](networking/networkmanager-and-libvirt/)
  — Wi-Fi, nftables, mesh-VPN.

## Security

- [doas policy](security/doas/)

## Applications

- [Applications](applications/) — Firefox, Flatpak, OBS, AppImage.

## General guides

- [Noctalia v5 for Niri](../../desktop/noctalia-shell/)
- [Niri](../../desktop/niri/)

## On completeness of the records

This section is filled in step by step: a missing entry does not mean
the component is not installed or configured. A partial cross-check
against the system was done on 2026-09-22; exact dates live in the
`last_verified` field of the individual documents. Fill in
`last_verified` only after a new actual verification.
