---
title: "Firewall: nftables"
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

This document shows a minimal stateful firewall on nftables. The example
allows all outgoing traffic, incoming established/related packets, loopback
and ICMP. All other incoming traffic is blocked, and the `forward` chain is
closed with a `drop` policy.

This is a simple desktop example, not a universal policy for a host with
Docker, Libvirt, VPN, routing or server services. For such an environment
the ruleset has to be adapted separately.

nftables replaces the old iptables stack, offering simpler rule logic and
less CPU overhead.

## 1. Before applying

Before changing the firewall:

- save the existing working configuration and check which rules are already
  loaded;
- keep in mind that `flush ruleset` deletes all loaded nftables rules;
- prepare a way to restore access: a mistake in the rules can cut a remote
  machine off the network;
- check whether Docker, Libvirt, VPN or other services add their own tables
  and chains.

Do not apply this minimal example on top of a complex working ruleset
without adaptation and an available rollback.

## 2. Configuration

File: `/etc/nftables.conf`

```nftables
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Allow loopback (localhost)
        iif "lo" accept

        # Allow established connections
        ct state established,related accept

        # Allow ICMP (ping)
        ip protocol icmp accept
        ip6 nexthdr icmpv6 accept

        # Optional: allow SSH (if needed)
        # tcp dport 22 accept
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
```

## 3. Checking before applying

First check the syntax without loading the ruleset:

```bash
doas /usr/sbin/nft -c -f /etc/nftables.conf
```

A successful syntax check does not confirm that the policy fits the current
network environment.

## 4. Applying

> ⚠️ **Important nuance**: applying a firewall can immediately change the
> current network availability, including remote access to the machine.

After checking the configuration, enable the service:

```bash
doas systemctl enable --now nftables
```

## 5. Checking after applying

Check the service status and the actually loaded ruleset:

```bash
doas systemctl status nftables
doas nft list ruleset
```

Then check the expected network availability: outgoing connections,
loopback, ICMP and the management access the host needs. Do not consider
the configuration working just because the service started successfully.

## 6. Rollback

Save the previous working configuration before the change. If the new
ruleset broke availability, restore the old file, check its syntax again and
reload the working ruleset through `nftables.service`.

## Related docs

- [Docker, Libvirt and nftables](../../troubleshooting/docker-libvirt-nftables/)
  — a separate analysis of the complex interaction between forwarded traffic
  and multiple tables/chains.
