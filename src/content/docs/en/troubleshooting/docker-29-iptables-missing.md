---
title: "Docker 29 fails to start: iptables not found"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-09"
verified_on: [asus-b5402]
---

## 1. Symptom

After Go was updated and Docker rebuilt, the system service exited with a
`start-limit-hit` error:

```text
docker.service: Start request repeated too quickly.
docker.service: Failed with result 'start-limit-hit'.
```

This systemd message reflects several failed start attempts, but does not
identify the original cause. Look earlier in the journal:

```bash
journalctl -b -u docker.service --no-pager
```

```text
failed to find iptables: exec: "iptables": executable file not found in $PATH
failed to start daemon: Error initializing network controller:
failed to create NAT chain DOCKER: iptables not found
```

The key error for this document is `iptables not found`; `start-limit-hit` is
a secondary systemd symptom.

## 2. When to apply

This procedure applies when:

- Docker actually exits with `iptables not found`;
- the backend in use requires the `iptables` command;
- a check confirms that `iptables` is missing.

This is not a universal cause of `docker.service` failures.

## 3. Cause

At the time of diagnosis, Docker `29.8.0` and
`net-firewall/nftables-1.1.6` were installed, but the
`net-firewall/iptables` package and `iptables` command were absent:

```bash
command -v iptables
qlist -Iv net-firewall/iptables net-firewall/nftables
```

Docker's `28.4.0` ebuild had a direct dependency on
`net-firewall/iptables`. The Docker `29.8.0` ebuild depends on
`net-firewall/nftables`, but Docker still uses the iptables backend by default.
The `net-firewall/nftables` package provides `nft` and `libnftables`, but not
the `iptables` command.

The Go update triggered a Docker rebuild, but was not itself the cause of the
error. The exact time when `net-firewall/iptables` was removed has not been
confirmed; it may have become an unnecessary dependency after the Docker
update and then been removed by `emerge --depclean`.

## 4. Fix

First, inspect the installation plan:

```bash
emerge -pv net-firewall/iptables
```

The current configuration requires the `nftables` USE flag. In this mode,
Docker calls `iptables`/`ip6tables`, which use the kernel's nftables backend:

```bash
doas emerge -av net-firewall/iptables
doas eselect iptables set xtables-nft-multi
iptables --version
```

> **Important:** The `nftables` USE flag adds an nft-compatible implementation,
> but does not guarantee that it is selected as active. After a new
> installation, the ebuild may select `xtables-legacy-multi`, so the choice is
> set explicitly with `eselect`.

Expected result:

```text
iptables v1.8.x (nf_tables)
```

After installation, clear the systemd failure limit and start the services:

```bash
doas systemctl reset-failed docker.service docker.socket
doas systemctl restart docker.socket
doas systemctl start docker.service
```

## 5. Verification

```bash
systemctl status docker.service --no-pager
docker info
docker ps
```

The service should be `active (running)`, and `docker info` should complete
without a daemon connection error.

## 6. Rollback / recovery

If the backend selected with `eselect` is unsuitable, restore the previous
selection and check Docker startup again. You do not need to remove packages
or roll Docker back for this step.

## 7. Alternative: native nftables backend

Docker 29 supports a native nftables backend, but it is enabled only explicitly
through `"firewall-backend": "nftables"` in `/etc/docker/daemon.json`. This
mode is still considered experimental. Switching requires IP forwarding to be
enabled and all user-defined rules to be checked. At the time of the incident,
IPv4 and IPv6 forwarding were disabled, and the active Docker + Libvirt
configuration was designed for `iptables-nft`.

Therefore, installing `net-firewall/iptables` with the `nftables` USE flag is
the smallest change that preserves the current network setup. The active
implementation should be `xtables-nft-multi`.

## 8. Related messages

The `not restoring image ... layer does not exist` entries appear before the
fatal error, but do not stop startup at this stage. After Docker is restored,
check the list of images and containers separately. Do not delete
`/var/lib/docker` to fix the `iptables not found` error.

## 9. Historical / incident environment

This is the environment from the original incident, not the current state of
ASUS B5402:

- **Diagnosis date:** 2026-09-09
- **Docker:** 29.8.0
- **containerd:** 2.3.4
- **runc:** 1.4.3
- **Go:** 1.27.1
- **Firewall:** nftables 1.1.6
- **Init:** systemd

The confirmed current state of the reference system is in
[the system document](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

## Related docs

- [Docker + Libvirt and nftables](../docker-libvirt-nftables/) — interaction
  between forwarded Docker, Libvirt, and nftables traffic.
- [ASUS B5402 networking](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — the confirmed current state of the reference system.

## References

- [Docker: Firewall with nftables](https://docs.docker.com/engine/network/firewall-nftables/)
