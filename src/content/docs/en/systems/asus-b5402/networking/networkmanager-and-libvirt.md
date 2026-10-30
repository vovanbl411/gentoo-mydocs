---
title: Networking on ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- **Wi-Fi:** NetworkManager + iwd, Intel AX201 (`wlan0`); NetworkManager
  manages the connection.
- **Firewall:** nftables is active; its rules include NAT/forwarding for
  virtual machine networks and static NAT for Tailscale.
- **Docker and Libvirt:** both packages are installed. `docker.service`, the
  `libvirtd`/`virtqemud` services, and their sockets are disabled and inactive.
- **Mesh VPN:** NetBird is active on `wt0`. Tailscale is installed;
  `tailscaled` is disabled and inactive.

## Wi-Fi

NetworkManager uses iwd as its Wi-Fi backend. The Intel AX201 (`wlan0`) is
connected through NetworkManager. The effective configuration enables MAC
randomization while scanning and sets the cloned MAC to `stable` for Wi-Fi and
Ethernet connections.

A local `iwd.service` override sets `ProtectKernelTunables=no`. See the
[NetworkManager + iwd guide](../../../../networking/networkmanager-iwd/) for
the reason for this setting and compatible systemd restrictions for iwd.

## Docker, Libvirt, and nftables

`docker.service` is disabled and inactive. Libvirt is installed, but
`libvirtd.service`, `virtqemud.service`, `libvirtd.socket`, and
`virtqemud.socket` are disabled and inactive.
A symlink in `/etc/systemd/system/multi-user.target.wants/` points to the
missing `libvirt-docker-forward-fix.service`; systemd reports
`LoadState=not-found`.

The main nftables file is `/etc/nftables/rules/main.nft`; it includes
`libvirt_fix.nft` and `tailscale.nft`. The currently loaded tables are
`ip nat`, `ip gentoo_bridge_libvirt`, and `ip tailscale_nat`.

`libvirt_fix.nft` defines masquerading for the `192.168.122.0/24` and
`10.0.0.0/24` networks, along with the `bypass_docker` chain in the
`ip gentoo_bridge_libvirt` table on the `forward` hook at priority
`filter - 10`. The chain accepts traffic whose source or destination address
belongs to either network.

`tailscale.nft` defines masquerading for `100.64.0.0/10` traffic leaving via
`eno2`. The `ip tailscale_nat` table is loaded even though the `tailscaled`
service is inactive.

See the [separate guide](../../../../troubleshooting/docker-libvirt-nftables/)
for Docker and Libvirt routing diagnostics.

## Mesh VPN

NetBird is currently active: `netbird@main.service` is running and the `wt0`
interface is up. NetworkManager shows `wt0` as an external WireGuard
connection. The Tailscale service is inactive and disabled; its static
nftables rules are listed above.

## Known observation

The logs from the current and previous boots show NetworkManager reporting
`error setting IPv4 forwarding to '0': Resource temporarily unavailable` and
`IWD device named wlan0 is not a Wifi device` when the `/net/connman/iwd/0`
Wi-Fi P2P device appears. Wi-Fi is currently connected through NetworkManager.

## Related docs

- [NetworkManager and iwd](../../../../networking/networkmanager-iwd/)
- [MAC randomization](../../../../troubleshooting/networkmanager-iwd-mac-randomization/)
- [Docker, Libvirt, and nftables](../../../../troubleshooting/docker-libvirt-nftables/)
