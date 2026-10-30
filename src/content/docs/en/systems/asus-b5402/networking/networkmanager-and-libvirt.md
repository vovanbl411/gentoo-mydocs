---
title: Networking on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- **Wi-Fi:** NetworkManager uses iwd with the Intel AX201 (`wlan0`).
- **Firewall:** nftables is active.
- **Docker and Libvirt:** installed and used as needed.
- **Mesh VPN:** NetBird is the primary mesh VPN.

## Wi-Fi

NetworkManager uses iwd, and the Intel AX201 (`wlan0`) is connected through
NetworkManager. The effective configuration enables MAC randomization while
scanning and sets the cloned MAC to `stable` for Wi-Fi and Ethernet
connections. The effective iwd setting is `ProtectKernelTunables=no`. See the
[NetworkManager and iwd guide](../../../../networking/networkmanager-iwd/).

## Docker, Libvirt, and nftables

The main nftables file is `/etc/nftables/rules/main.nft`; it includes
`libvirt_fix.nft` and `tailscale.nft`. `libvirt_fix.nft` contains
system-specific forwarding/NAT rules for virtual machine networks.
`tailscale.nft` is also part of the current nftables configuration. See the
[Docker and Libvirt guide](../../../../troubleshooting/docker-libvirt-nftables/)
for diagnostics.

## Mesh VPN

NetBird uses the `wt0` interface. Tailscale is installed but is not used as an
active mesh VPN.

## Observation

The current and previous boot logs contain transient NetworkManager/iwd
warnings while a Wi-Fi P2P device is created. After startup, the Wi-Fi
`wlan0` interface is connected through NetworkManager.

## Related docs

- [NetworkManager and iwd MAC randomization](../../../../troubleshooting/networkmanager-iwd-mac-randomization/)
