---
title: "Docker and Libvirt: diagnosing forwarding with nftables"
kind: troubleshooting
scope: mixed
status: draft
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## 1. Symptom

The virtual machine is reachable from the host but cannot reach external
networks. This alone does not prove that Docker is dropping the traffic: check
routing, kernel forwarding, filtering, and NAT separately.

## 2. When to use this guide

Use these diagnostics when a VM should reach external networks through a host
that runs Docker, Libvirt, and a firewall. First confirm the route and gateway
inside the VM, then inspect the host ruleset. Do not copy a rule from another
firewall without checking interfaces, addresses, and traffic direction.

## 3. Identify the Docker firewall backend

When the daemon is running, `docker info` reports the firewall backend in use.
If the server does not respond, inspect its configuration and startup options:

```bash
doas docker info
doas cat /etc/docker/daemon.json
systemctl show docker.service -p ExecStart -p Environment --no-pager
iptables --version
ip6tables --version
```

Check whether `firewall-backend`, `iptables`, `ip6tables`, `ip-forward`,
`ip-forward-no-drop`, or `bridge-accept-fwmark` is explicitly set. Docker uses
the `iptables` backend by default; its experimental native nftables backend
was introduced in Docker 29 and must be selected explicitly. If
`iptables --version` reports `nf_tables`, that is the iptables frontend over
nftables, not Docker's native backend.

ASUS B5402 has Docker client 29.9.0 installed, but `docker.service` and
`docker.socket` are currently stopped, so `docker info` cannot report an active
backend. `/etc/docker/daemon.json` is absent, the unit does not set any of the
listed options, and `Environment` is empty. Docker is therefore expected to use
its default `iptables` backend the next time it starts, but that does not
confirm a backend currently in use. `iptables` and `ip6tables` are version
1.8.13 with the `legacy` implementation.

## 4. Cause

Separate the stages of the packet path:

- `net.ipv4.ip_forward` and `net.ipv6.conf.all.forwarding` control whether the
  kernel forwards IPv4 and IPv6 traffic. A value of `0` means forwarding is
  disabled; that is not a firewall error.
- `FORWARD` and base chains attached to the `forward` hook filter packets that
  have already been routed. Find the specific chain and rule that returns
  `drop`.
- NAT/masquerade changes the source address for return routing; it does not
  allow a packet that a filter has dropped.
- Libvirt network settings provide the VM interface and route, and NAT rules
  for a NAT network. They do not replace Docker's rules, or vice versa.

The previous version of this document attributed the original symptom to the
forwarding firewall path between Docker and Libvirt rules, but the evidence
currently available does not confirm the specific chain or exact cause of the
drop. On ASUS B5402, both forwarding sysctls are currently `0`, and the
iptables `FORWARD` policy is `ACCEPT` with NetBird rules only; `DOCKER-USER` and
Docker chains are absent. The live nftables ruleset contains the local tables
`ip nat`, `ip gentoo_bridge_libvirt`, and `ip tailscale_nat`, but no Docker
tables or separate Libvirt-generated tables. The `ip nat` table contains
masquerade for VMs. The only base chain on the `forward` hook is
`gentoo_bridge_libvirt/bypass_docker`, with priority `-10` and policy `accept`;
it has no counters. The original symptom therefore cannot currently be
attributed to an active Docker `drop`.

## 5. Fix

First identify the backend and the point where the packet is dropped. Then
choose a solution for that backend.

- With the `iptables` backend, Docker sends packets through `FORWARD`, first
  through `DOCKER-USER`, then through Docker-managed forwarding chains.
  `DOCKER-USER` is the place for a user rule that must run before Docker's
  rules. Choose a rule only after checking the interfaces, addresses, and
  direction of the affected packet. No specific rule is given for ASUS B5402
  because its live Docker path is currently unavailable for verification.
- With the native `nftables` backend, there is no `DOCKER-USER` chain. An
  `accept` in an earlier, separate base chain ends only that chain; a later
  base chain can still drop the packet. Use only a mechanism currently
  documented by Docker for a confirmed native-backend case; do not copy an
  iptables rule here.

The current `/etc/nftables/rules/libvirt_fix.nft` on ASUS B5402 contains
`priority -10 accept`. This does not override a later Docker `drop` and is not a
confirmed fix. The file is included in the local ruleset, but its presence
does not prove that forwarding currently works.

## 6. Verify

On the host, compare the backend, kernel forwarding state, and actual firewall
chains:

```bash
sysctl net.ipv4.ip_forward
sysctl net.ipv6.conf.all.forwarding
doas iptables -S FORWARD
doas iptables -S DOCKER-USER
doas nft list ruleset
```

For nftables, find every base chain on the `forward` hook, its priority and
policy, any `drop` rules, and counters if present. Docker table names can
change between releases, so identify them in the current ruleset rather than
relying on the old name `table ip filter`.

After a confirmed fix, check the VM's route to its gateway, DNS, outbound
TCP/HTTPS, and its expected route. Compare counters before and after the
attempt if the relevant rules count packets. Do not treat a specific HTTP
status from an external site as a success contract.

## 7. Rollback

The diagnostic commands above do not change the system. If you later apply a
confirmed rule, remove only that rule using the same backend and restore only
the source file you changed from its backup.

On ASUS B5402, the active `nftables.service` loads the source ruleset from
`/etc/nftables/rules/main.nft`. This is a machine-specific implementation, not
the general Gentoo service contract. Check the syntax before restoring, then
use the unit described on the [system page](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

## Related material

- [ASUS B5402 networking](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — the local ruleset and actual loading unit.
- [Firewall: nftables](../../networking/nftables-firewall/)
  — a basic example and the Gentoo package units.
- [Docker with iptables](https://docs.docker.com/engine/network/firewall-iptables/)
- [Docker with nftables](https://docs.docker.com/engine/network/firewall-nftables/)
- [Packet filtering and firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
- [Docker Engine 29 release notes](https://docs.docker.com/engine/release-notes/29/)
- [nftables manual](https://netfilter.org/projects/nftables/manpage.html)
