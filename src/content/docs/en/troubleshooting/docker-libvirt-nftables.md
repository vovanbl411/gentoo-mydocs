---
title: "Resolving Docker + Libvirt routing conflicts on Gentoo (nftables)"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## 1. Symptom

The virtual machine is reachable from the host but does not get the expected
external access. Docker, Libvirt, and nftables are all in use on the host, and
the problem appears while forwarded traffic from the VM subnet is handled.

## 2. When to apply

- The `10.0.0.0/24` subnet below is an example. Adapt the rules for any other
  network.
- Do not copy the rules into another production firewall without a backup, a
  dry run, and an available rollback method.
- Before changing anything, check the backend, Docker version, and current
  nftables ruleset.
- Confirm that the observed symptom matches the description above.

> **Note for Docker 29:** the native nftables backend is still enabled only
> explicitly. If `docker.service` fails after an update with `iptables not
> found`, see the [separate procedure](../docker-29-iptables-missing/).

## 3. Cause

In the described case, packets reach the host network stack, but `ip_forward`
does not take effect — the VMs remain on their subnet.

In nftables, multiple tables can subscribe to the same hook. Docker and
Libvirt both attach to `forward` with priority `filter` (0):

- **Docker** creates `table ip filter` → `chain FORWARD` with
  `priority 0; policy drop;`;
- **Libvirt** creates `table ip libvirt_network` → `chain forward` with
  `priority 0; policy accept;`.

The **DROP** verdict is terminal. Even if Libvirt accepts the packet, Docker's
`policy drop` in a table processed at the same hook point discards it.

## 4. Fix

The fix uses an independent nftables table with a negative priority instead of
changing `DOCKER-USER`, whose chains Docker recreates on restart.

In this example, a lower priority number means earlier processing:
`priority -10` runs before Docker (`priority 0`) and accepts VM traffic before
Docker can block it.

| Table | Priority | Policy | Result |
|---------|----------|--------|-----------|
| `gentoo_bridge_libvirt` | **-10** | `accept` | Packet accepted **before** Docker |
| `ip filter` (Docker) | 0 | `drop` | Packet is not seen — already handled |

> **Important:** In nftables, `accept` in one chain does not stop processing
> completely — the packet still passes through other chains on the same hook.
> But because our `accept` runs earlier (priority -10), Docker (priority 0)
> can no longer drop it — the packet has been marked as accepted.

### Generic example

The full procedure below creates a generic layout example in
`/etc/nftables/rules/main.nft`. Check the subnets and compatibility with the
rest of the ruleset before applying it.

### Reference system: ASUS B5402

The fix was checked on ASUS B5402. Its actual structure, current versions, and
confirmed state are recorded in
[the system document](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).
The current reference-system state is not duplicated here.

## 5. Verification

Before the fix, the expected symptom is that the VM is reachable from the host,
but checking an external connection from the VM fails or packets are lost.

After the fix, check:

- that table `ip gentoo_bridge_libvirt` and chain `bypass_docker` exist;
- hook priority order relative to Docker;
- external access from the VM;
- DNS and HTTP;
- that nftables counters increase for traffic from the required subnet.

Commands and expected output examples appear below, in a safe application
order. They do not mean the checks have already been performed in another
environment.

## 6. Rollback / recovery

If the rules disrupt network access, restore the `main.nft` backup created
before the change. Substitute the actual backup file date for `YYYYMMDD`:

```bash
$ doas cp /etc/nftables/rules/main.nft.backup.YYYYMMDD /etc/nftables/rules/main.nft
$ doas /usr/sbin/nft -c -f /etc/nftables/rules/main.nft
$ doas /usr/sbin/nft -f /etc/nftables/rules/main.nft
# Alternative for loading through the service
$ doas systemctl restart nftables
```

After restoring the previous ruleset, check that the expected network access
has returned.

## 7. Install nftables if the package is missing

```bash
# Check the profile
$ eselect profile show | grep systemd
# Must contain: default/linux/amd64/23.0/systemd (or newer)

# Install
$ doas emerge -av net-firewall/nftables
```

## 8. Safe application flow

This document uses the following path for Gentoo with systemd:

```text
/etc/nftables/rules/main.nft
```

The procedure assumes this file is loaded by `nftables.service` at system
startup. Verify this with
`ConditionPathExists=/etc/nftables/rules/main.nft`. This procedure does not
cover alternative layouts.

### 1. Backup

```bash
$ doas mkdir -p /etc/nftables/rules
$ doas cp /etc/nftables/rules/main.nft /etc/nftables/rules/main.nft.backup.$(date +%Y%m%d) 2>/dev/null || true
$ doas nft list ruleset > ~/nftables-ruleset-backup.txt
```

### 2. Configuration

This block creates a generic example. It does not describe the actual
system-specific filename on ASUS B5402.

```bash
# Create the directory if it does not exist
$ doas mkdir -p /etc/nftables/rules

# Write the config
$ doas tee /etc/nftables/rules/main.nft << 'EOF'
#!/usr/sbin/nft -f

flush ruleset

table ip gentoo_bridge_libvirt {
    chain bypass_docker {
        type filter hook forward priority -10; policy accept;
        ip saddr 10.0.0.0/24 accept
        ip daddr 10.0.0.0/24 accept
        ip saddr 192.168.122.0/24 accept
        ip daddr 192.168.122.0/24 accept
    }
}
EOF

# Set file permissions
$ doas chmod 644 /etc/nftables/rules/main.nft
```

### 3. Syntax / dry-run check

The syntax check does not load the ruleset:

```bash
$ doas /usr/sbin/nft -c -f /etc/nftables/rules/main.nft
```

### 4. Pre-fix verification / baseline

Check the expected source of the block before applying the fix:

```bash
# Before the fix, Docker blocks all forwarded traffic
$ doas nft list ruleset | grep -A 5 "chain FORWARD"
# table ip filter {
#   chain FORWARD {
#     type filter hook forward priority filter; policy drop;
#     ...
#   }
# }
```

Expected symptom before the fix:

```bash
# From the host — the VM responds to ping
$ ping 10.0.0.80  # OK

# From the VM — external access fails
$ ssh vladimir@10.0.0.80
$ ping -c 3 1.1.1.1
# ping: connect: Network is unreachable
# or 100% packet loss
```

### 5. Apply

> ⚠️ **Important nuance**: `flush ruleset` removes the rules already loaded,
> and loading the new file may immediately change network access.

```bash
# Apply the rules
$ doas /usr/sbin/nft -f /etc/nftables/rules/main.nft

# Alternative — through systemd
$ doas systemctl restart nftables
```

### 6. Post-fix verification

After applying the fix, check that the table and chain exist:

```bash
$ doas nft list table ip gentoo_bridge_libvirt
# Should show:
# table ip gentoo_bridge_libvirt {
#   chain bypass_docker {
#     type filter hook forward priority filter - 10; policy accept;
#     ip saddr 10.0.0.0/24 accept
#     ip daddr 10.0.0.0/24 accept
#   }
# }
```

`nft` displays `priority -10` as `priority filter - 10`. In the existing
explanation, `filter` is the base priority (0), and `- 10` means “minus 10
from the base.”

Check the hook processing order:

```bash
$ doas nft list ruleset | grep "hook forward"
# Should be:
# type filter hook forward priority filter - 10; policy accept;  ← our fix
# type filter hook forward priority filter; policy drop;         ← Docker
```

Then check connectivity from the VM, DNS, HTTP, and counters:

```bash
# From the VM
$ ping -c 3 1.1.1.1        # OK
$ curl -I https://docker.io # HTTP/2 401 (this is normal; it means it is reachable)
$ dig +short gentoo.org     # Returns an IP

# Check nftables counters
$ doas nft list chain ip gentoo_bridge_libvirt bypass_docker -a
# counter packets 1234 bytes 567890 ip saddr 10.0.0.0/24 accept # ← counter increases
```

### 7. Enable persistence

After checking the result, make sure the unit can see the file and enable
loading at startup:

```bash
# Check that the unit can see the file
$ doas systemctl status nftables
# Should show: ConditionPathExists=/etc/nftables/rules/main.nft met

# Enable at startup
$ doas systemctl enable --now nftables
```

## 9. Extensions

### Add networks

If new subnets are added, such as for k8s, extend the generic example:

```nft
table ip gentoo_bridge_libvirt {
    chain bypass_docker {
        type filter hook forward priority -10; policy accept;

        # Existing networks
        ip saddr 10.0.0.0/24 accept
        ip daddr 10.0.0.0/24 accept
        ip saddr 192.168.122.0/24 accept
        ip daddr 192.168.122.0/24 accept

        # New network for k8s
        ip saddr 10.244.0.0/16 accept
        ip daddr 10.244.0.0/16 accept
    }
}
```

After changing it:

```bash
$ doas /usr/sbin/nft -f /etc/nftables/rules/main.nft
$ doas systemctl restart nftables
```

### Split complex configurations across files

The following is a generic layout example. `libvirt.nft` is not the actual
system-specific filename on the reference system.

```text
/etc/nftables/
└── rules/
    ├── main.nft          # Entry point
    ├── base.nft          # Base rules
    └── libvirt.nft       # Libvirt fix
```

File: `/etc/nftables/rules/main.nft`

```nft
#!/usr/sbin/nft -f

flush ruleset

include "/etc/nftables/rules/base.nft"
include "/etc/nftables/rules/libvirt.nft"
```

## 10. Alternatives

This procedure does not use the following options:

| Method | Why it is not used |
|--------|--------------------|
| `iptables -I DOCKER-USER -i virbr+ -j ACCEPT` | Docker recreates chains on restart, so the rule is lost. Also, Docker's native nftables backend (29.0+) has no `DOCKER-USER` chain. |
| `docker daemon --iptables=false` | Breaks port mapping for all containers. |
| `echo 1 > /proc/sys/net/ipv4/ip_forward` | Forwarding is already enabled; it is not the problem. |

## 11. Historical context

The following describes the environment from the previous check and is not the
current state of ASUS B5402:

- **OS:** Gentoo Linux, profile `default/linux/amd64/23.0/systemd`;
- **Kernel:** 6.x (Alder Lake, Clang/LLVM + ThinLTO);
- **Init:** systemd;
- **Firewall:** nftables 1.1.x (`net-firewall/nftables`);
- **Docker:** 29.8.0 (`iptables-nft` backend);
- **Libvirt:** 10.x (QEMU/KVM, default NAT network);
- **Privilege escalation:** doas.

See [the system document](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
for the confirmed current state of the reference system.

## 12. Additional troubleshooting

### Rules did not load after restart

```bash
# Check that the file exists
$ ls -la /etc/nftables/rules/main.nft

# Check the unit status
$ doas systemctl status nftables
# If it says: ConditionPathExists=/etc/nftables/rules/main.nft was not met
# → The file is missing or the path is wrong

# Check syntax
$ doas /usr/sbin/nft -c -f /etc/nftables/rules/main.nft
```

### Rules loaded, but traffic is still blocked

```bash
# Check that the table is actually attached
$ doas nft list ruleset | grep -B2 -A5 "priority filter - 10"
# Should show: type filter hook forward priority filter - 10

# If priority is 0, the config has a typo

# Check that Docker does not run first
$ doas nft list ruleset | grep "hook forward"
# gentoo_bridge_libvirt: priority filter - 10
# filter (Docker): priority filter
```

### Conflict with firewalld

The following commands stop, disable, and remove `firewalld`. Use them only if
nftables without firewalld is the chosen setup and a rollback is ready:

```bash
$ doas systemctl stop firewalld
$ doas systemctl disable firewalld
$ doas emerge -C firewalld
```

### Docker does not start after the changes

If the journal contains `failed to create NAT chain DOCKER: iptables not
found`, the problem is not the `nftables.service` startup order. Use the
[Docker 29 procedure](../docker-29-iptables-missing/).

```bash
# Check that nftables loaded before Docker
$ doas journalctl -u docker.service -b | grep -i nftables

# If Docker started first, add a dependency
$ doas mkdir -p /etc/systemd/system/docker.service.d/
$ doas tee /etc/systemd/system/docker.service.d/nftables-dependency.conf << 'EOF'
[Unit]
After=nftables.service
Wants=nftables.service
EOF
$ doas systemctl daemon-reload
$ doas systemctl restart docker
```

## Related docs

- [ASUS B5402 networking](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — confirmed current state and system-specific layout.
- [Docker 29: `iptables not found`](../docker-29-iptables-missing/) — a
  separate Docker startup symptom.
- [Minimal nftables firewall](../../networking/nftables-firewall/) — a simple
  desktop example without Docker and Libvirt integration.

## References

- [Gentoo Wiki: Nftables](https://wiki.gentoo.org/wiki/Nftables)
- [Gentoo News: nftables systemd service change](https://wwwtest.gentoo.org/support/news-items/2025-05-24-nftables-service.html)
- [Docker: Firewall with nftables](https://docs.docker.com/engine/network/firewall-nftables/)
- [ServerFault: Understanding nftables jumping](https://serverfault.com/questions/1126278/understanding-how-does-jumping-work-in-nftables)
- [dzx.fr: Nftables, Docker, and a default drop policy](https://dzx.fr/blog/nftables-docker-drop-policy/)
