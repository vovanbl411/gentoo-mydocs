---
title: "Firewall: nftables"
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

nftables is Linux's current packet-filtering framework and replaces the old
iptables rule-management model. This example allows loopback, established and
related connections, ICMPv4/ICMPv6, and all outgoing traffic. It drops other
incoming packets and all forwarded traffic.

## When this example applies

Use it on a simple desktop host where:

- Docker and Libvirt do not use forwarding;
- the host does not route traffic or perform NAT;
- the VPN does not manage its own nftables rules;
- there are no incoming services, except those you explicitly allow before
  applying the ruleset.

If you use Docker, Libvirt, routing, or such a VPN, inspect the full current
ruleset first and do not load this example directly. The ASUS B5402 is a
complex case; this minimal ruleset does not describe its firewall. See the
[system page](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

On Gentoo with systemd, the `net-firewall/nftables` package loads saved rules
from `/var/lib/nftables/rules-save`. This is the saved-state path, not a source
configuration under `/etc`. A system can keep its source ruleset under `/etc`
and load it through a separate mechanism; that is a local design, not the
package integration's standard path.

## Minimal ruleset

Before replacing the file, back it up along with the current runtime ruleset:

```bash
doas cp /var/lib/nftables/rules-save /var/lib/nftables/rules-save.backup
doas nft list ruleset > "$HOME/nftables-ruleset-backup.nft"
```

File: `/var/lib/nftables/rules-save`. After creating the backups, write this
ruleset to that file:

```text
table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;

        iifname "lo" accept
        ct state established,related accept

        meta l4proto icmp accept
        meta l4proto ipv6-icmp accept
    }

    chain forward {
        type filter hook forward priority filter; policy drop;
    }

    chain output {
        type filter hook output priority filter; policy accept;
    }
}
```

`nftables-load.service` clears the current ruleset before loading the file, so
a separate `flush ruleset` is not required for this loading method. Files
created by `nftables-store.service` may contain their own `flush ruleset`.

`meta l4proto ipv6-icmp` matches ICMPv6 behind IPv6 extension headers.
`ip6 nexthdr icmpv6` checks only the immediate Next Header and is not suitable
here.

The `inet` family handles IPv4 and IPv6 in one table.

## Check and load on Gentoo

After writing the rules, check them without applying them:

```bash
doas nft -c -f /var/lib/nftables/rules-save
```

A syntax check does not confirm that the policy fits your network.

`nftables-load.service` is a oneshot unit that loads this file before
`network-pre.target`. Start it after the check succeeds:

> ⚠️ **Important nuance**: Loading the ruleset immediately changes packet
> filtering and can cut off remote access. If you are working remotely,
> prepare a local console or another way to restore access first.

```bash
doas systemctl start nftables-load.service
```

The service runs `flush ruleset` and then loads
`/var/lib/nftables/rules-save`. It replaces the entire current ruleset; it does
not add rules on top. This can remove rules created by Docker, Libvirt, or a
VPN.

`nftables-store.service` separately saves the current runtime ruleset to
`/var/lib/nftables/rules-save` at shutdown. Enable it only if you want this
save-at-shutdown behavior: if you maintain the file by hand, the service can
replace it with the current runtime state.

## Verify

Check the load result and the rules:

```bash
systemctl status nftables-load.service --no-pager
doas nft list ruleset
```

This is a oneshot unit, so do not judge success by `is-active` alone. Check
loopback, normal outgoing connectivity, DNS, IPv4 and IPv6 if used, and any
management access the host needs. Enable loading at boot only after these
checks pass:

```bash
doas systemctl enable nftables-load.service
```

## Rollback

If connectivity breaks after loading, use a local console to restore the
saved file, check it, and load it again:

```bash
doas cp /var/lib/nftables/rules-save.backup /var/lib/nftables/rules-save
doas nft -c -f /var/lib/nftables/rules-save
doas systemctl start nftables-load.service
```

## Related material

- [ASUS B5402 networking](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — the local firewall and network-service configuration.
- [Docker, Libvirt and nftables](../../troubleshooting/docker-libvirt-nftables/)
  — interactions between multiple rulesets.
- [Gentoo net-firewall/nftables source](https://gitweb.gentoo.org/repo/gentoo.git/tree/net-firewall/nftables/)
  — the ebuild, units, and helper.
- [nftables manual](https://netfilter.org/projects/nftables/manpage.html)
  — `meta l4proto`, IPv6 headers, and base-chain policies.
