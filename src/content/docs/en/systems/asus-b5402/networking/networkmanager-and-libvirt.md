---
title: Networking on ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Current state

- Wi-Fi: NetworkManager + iwd, Intel AX201 adapter — operating normally.
- Firewall: nftables.
- Docker: 29.8.0, storage driver `overlay2` (iptables-nft).
- Libvirt: 12.6.0, started on demand.
- Mesh VPN: NetBird is active, interface `wt0`.
- Tailscale: installed; `tailscaled` is inactive.

## Wi-Fi

NetworkManager uses iwd as its Wi-Fi backend. Wi-Fi is operating normally.

- Intel AX201 adapter; random MAC addresses are enabled while scanning and a
  stable MAC address is used for connections.
- The local `31-mac-addr-change.conf` masks the system file of the same name.
- The local drop-in `iwd.service.d/override.conf` changes
  `ProtectKernelTunables=yes` to `ProtectKernelTunables=no` (the effective
  value was confirmed with `systemctl show iwd -p ProtectKernelTunables`). The
  reason: `yes` prevented iwd from writing the `arp_evict_nocarrier` and
  `ndisc_evict_nocarrier` sysctls (`journalctl -u iwd`: `Unable to write ...`),
  which iwd manages for correct Wi-Fi roaming. The remaining hardening in the
  drop-in is retained (CapabilityBoundingSet, RestrictAddressFamilies,
  ProtectSystem/ProtectHome, and others).
- The primary source is the [NetworkManager + iwd guide](../../../../networking/networkmanager-iwd/).

## Docker and Libvirt

- Docker 29.8.0: storage driver `overlay2`, iptables-nft.
- Libvirt 12.6.0: the libvirtd/virtqemud units are system-wide inactive —
  virtualization starts as needed.
- To work around Docker's `FORWARD policy drop`, a separate
  `ip gentoo_bridge_libvirt` table (priority −10) and NAT masquerading are in
  use: `/etc/nftables/rules/main.nft` includes `libvirt_fix.nft` and
  `tailscale.nft`. The runtime has the `ip nat`, `ip gentoo_bridge_libvirt`,
  and `ip tailscale_nat` tables loaded.

For the Docker/Libvirt nftables conflict and the diagnostic sequence, see
[troubleshooting](../../../../troubleshooting/docker-libvirt-nftables/).

## Mesh VPN

NetBird is the primary mesh VPN. Tailscale is installed but disabled.

- NetBird (`net-vpn/netbird`): interface `wt0` (WireGuard, NM profile `wt0`,
  external); the process starts the template unit `netbird@main.service`
  (active since boot; the unit itself is disabled).
- Tailscale (`net-vpn/tailscale`): `tailscaled` is disabled+inactive; the
  `ip tailscale_nat` table is loaded through an include from
  `/etc/nftables/rules/main.nft`.

## Known observations

### NetworkManager/iwd startup race

It does not affect Wi-Fi operation and needs no fix.

Details: when iwd initializes, it briefly creates the Wi-Fi P2P device
`/net/connman/iwd/0`. At that point NetworkManager logs
`error setting IPv4 forwarding to '0': Resource temporarily unavailable`
and `IWD device named wlan0 is not a Wifi device`, then creates the regular
`wlan0`; iwd connects, DHCP succeeds, and there are no further errors.

## Verification

- Wi-Fi and the iwd drop-in were verified on 2026-09-21 (including the
  effective `ProtectKernelTunables`).
- The startup race was observed on 2026-09-21: `wlan0` was connected,
  `/net/connman/iwd/0` (wifi-p2p) disconnected, and both services active.
- Docker, Libvirt, and the runtime nftables tables (`nft list tables`) were
  verified on 2026-09-22.
- NetBird and Tailscale were verified on 2026-09-22; `netbird@main.service`
  has been active since boot on 2026-09-21.

## Related docs

- [NetworkManager and iwd](../../../../networking/networkmanager-iwd/)
- [MAC randomization](../../../../troubleshooting/networkmanager-iwd-mac-randomization/)
- [Docker, Libvirt, and nftables](../../../../troubleshooting/docker-libvirt-nftables/)
