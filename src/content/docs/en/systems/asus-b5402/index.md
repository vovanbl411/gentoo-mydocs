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

- Gentoo hardened/systemd (no-multilib); builds use
  Clang/LLD, globally `-O2` + ThinLTO.
- Intel Core i7-1260P (Alder Lake, hybrid P/E cores).
- Intel Iris Xe graphics — the i915 kernel driver, Mesa iris, Vulkan
  ANV.
- Desktop — Umbriel + Noctalia; Niri remains a fallback; login via
  greetd/tuigreet.
- Kernel — `sys-kernel/gentoo-kernel` with a custom configuration; boot chain: systemd-boot
  → UKI (Dracut) → LUKS2/TPM2 → Btrfs.
- Storage — Btrfs + Snapper; second NVMe: state verified, the
  backup/data plan not applied (the old Arch/LUKS layout is still
  there).
- Power — TLP, battery charge limited to 80%.
- Network — NetworkManager + iwd (Intel AX201), nftables, NetBird
  mesh-VPN.
- Security — Secure Boot, TPM 2.0, AppArmor, doas.

## Desktop

- [Noctalia](desktop/noctalia/) — shell and notification settings.
- [Umbriel, Niri, portals and GTK](desktop/environment/) — the recorded state of
  the desktop environment and the polkit agent.

## Hardware

- [ASUS NumberPad](hardware/numberpad/) — configuring the touchpad numeric keypad.
- [ASUS ExpertBook B5402CBA](hardware/asus-expertbook/) — kernel
  drivers, TLP and the battery.
- [Headset microphone](hardware/headset-microphone/) — ALC294: a local quirk
  enables the microphone input. Testing needs a compatible CTIA TRRS headset
  or adapter.
- [User-status indicator](hardware/user-status-indicator/) — controlling the external LED,
  `auto/busy/off` modes and Fn+1 switching. Firmware behavior and the choice
  of Linux interface are explained in the
  [research page](../../experiments/asus-user-status-indicator/).
- [Intel Alder Lake i7-1260P](hardware/cpu-optimization/) — compilation
  flags, the scheduler, hardware security.
- [Intel Graphics](hardware/graphics/) — i915/xe, Mesa, Vulkan.
- [Second NVMe and backups](hardware/second-disk/) — a plan for using the disk;
  inspect its contents before applying any partitioning.
- [ELAN fingerprint reader](hardware/fingerprint/) — configuring login
  and authorization prompts.

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

- [Installing Umbriel](../../desktop/umbriel/)
- [Noctalia](../../desktop/noctalia-shell/)
- [Niri](../../desktop/niri/)

## Using this section

General guides explain installation and setup; this section keeps the chosen
settings for the laptop. Plans such as the second NVMe layout are marked
separately from applied settings. Before working on disks, check device names
and contents on your own machine.
