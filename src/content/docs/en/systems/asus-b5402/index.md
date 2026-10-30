---
title: ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

This is the primary Gentoo workstation. This section records its documented
state and decisions; reusable guides are in the site's topic sections.

## Current state

- Gentoo hardened/systemd without multilib; userspace builds use Clang/LLD,
  with global `-O2` and ThinLTO.
- `sys-kernel/gentoo-kernel` is built as a GPKG on `gentoo-builder-01` and
  delivered to the workstation through a private binrepo. Boot flow:
  systemd-boot → a Dracut-generated UKI → LUKS2/TPM2 → Btrfs.
- Desktop: Umbriel + Noctalia; Niri remains a fallback session. Login uses
  greetd/tuigreet.
- Intel Iris Xe; the current kernel driver is `i915`. The graphics stack
  includes Mesa and Vulkan.
- Btrfs + Snapper; build directories and caches are kept outside root
  snapshots. Second NVMe: **PLAN — NOT APPLIED**.
- Networking: NetworkManager + iwd, nftables, and NetBird as the primary mesh
  VPN.
- Security: Secure Boot, TPM2/LUKS2 integration, AppArmor, and doas.
- Native applications are installed through Portage, including from local
  overlays; selected programs use Flatpak or AppImage. The working KeePassXC
  database is stored locally; Android sync and backups are handled separately.

## Desktop

- [Noctalia](desktop/noctalia/) — desktop shell and notifications.
- [Umbriel, Niri, portals, and GTK](desktop/environment/) — compositor, login,
  portals, and the Niri fallback session.

## Hardware

- [ASUS NumberPad](hardware/numberpad/) — configuring the touchpad number pad.
- [ASUS ExpertBook B5402CBA](hardware/asus-expertbook/) — TLP, battery, and
  ASUS WMI integration.
- [Headset microphone](hardware/headset-microphone/) — ALC294 and a local
  quirk; input topology is confirmed, but recording with a compatible CTIA
  headset is not yet confirmed.
- [User-status indicator](hardware/user-status-indicator/) — kernel and
  userspace integration, `auto`/`busy`/`off` modes, and Fn+1.
- [Intel Alder Lake CPU optimization](hardware/cpu-optimization/) — local
  userspace optimization policy, power management, and scheduler details.
- [Graphics stack](hardware/graphics/) — current `i915` driver, Mesa, and
  Vulkan; the Xe experiment is documented on this page.
- [Second NVMe](hardware/second-disk/) — **PLAN — NOT APPLIED**.
- [ELAN fingerprint reader](hardware/fingerprint/) — fprintd/libfprint
  integration and authentication.

## Boot and Portage

- [Boot and Portage](system/boot-and-portage/) — toolchain and package policy,
  kernel GPKG builds on the builder, private binrepo delivery, and the
  UKI/Secure Boot flow.
- [BIOS/UEFI update](system/bios-update/) — the verified procedure, including
  Secure Boot and TPM2 considerations.

## Storage

- [Btrfs and Snapper](filesystem/layout-and-snapshots/) — Btrfs layout, build
  and cache storage, and snapshot policy.

## Networking

- [NetworkManager and Libvirt](networking/networkmanager-and-libvirt/) — Wi-Fi
  with NetworkManager/iwd, nftables, virtual machine networking, and mesh VPN.

## Security

- [doas policy](security/doas/) — the current privilege escalation policy.

## Applications

- [Applications](applications/) — Portage applications, including local
  overlays, selected Flatpak/AppImage integrations, and KeePassXC sync and
  backups.

## General guides

- [Installing Umbriel](../../desktop/umbriel/)
- [Noctalia](../../desktop/noctalia-shell/)
- [Niri](../../desktop/niri/)

## Using this section

`systems/asus-b5402/` records the state and decisions for this workstation.
Reusable procedures are in the general guides. Plans are marked separately
from applied settings; recheck the system before destructive actions.
