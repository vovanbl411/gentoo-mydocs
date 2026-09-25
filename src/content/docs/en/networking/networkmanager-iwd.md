---
title: "Network configuration: NetworkManager + iwd"
kind: guide
scope: general
status: current
last_verified: "2026-09-21"
verified_on: [asus-b5402]
---

In this configuration NetworkManager uses `iwd` as the Wi-Fi backend.
NetworkManager remains the top-level connection manager, while `iwd` serves
the wireless part. As a result, Wi-Fi connections are still configured and
controlled through NetworkManager.

The actual ASUS B5402 state is recorded in
[the system section](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).
It is not a mandatory configuration for other systems. A separate MAC
randomization diagnosis lives in
[the troubleshooting document](../../troubleshooting/networkmanager-iwd-mac-randomization/).

## 1. When to apply and what to check in advance

Before setup, check that:

- NetworkManager is built with `iwd` support;
- there is no other Wi-Fi backend or network service in the system that
  would conflict with the chosen stack;
- a temporary Wi-Fi drop when changing or restarting the network service is
  acceptable.

## 2. Example Portage configuration

The following `package.use` is an example configuration, not a universally
required set of USE flags.

File: `/etc/portage/package.use/networkmanager`

```makefile
net-misc/networkmanager -iptables -dhcpcd -wext -modemmanager -ppp -bluetooth concheck tools connection-sharing iwd audit psl
net-vpn/networkmanager-openvpn -gtk
```

## 3. NetworkManager configuration

The file defines three separate configuration parts:

- `wifi.backend=iwd` selects `iwd` as the Wi-Fi backend;
- `wifi.scan-rand-mac-address=yes` enables MAC randomization during
  scanning;
- `wifi.cloned-mac-address=stable` and
  `ethernet.cloned-mac-address=stable` set a stable cloned MAC for
  connections.

File: `/etc/NetworkManager/conf.d/99-wifi-backend.conf`

```ini
[main]
plugins=keyfile

[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
```

## 4. Services

After checking for conflicting network services, enable the chosen stack:

```bash
doas systemctl enable --now iwd
doas systemctl enable --now NetworkManager
```

Starting or restarting these services can temporarily drop the current
Wi-Fi connection.

## 5. Local hardening for iwd

If a local drop-in is created for `iwd.service`, every line in the
`[Service]` section must have the form `Directive=value`. A standalone line
with a capability name such as `CAP_SYS_MODULE` is not a setting: systemd
will ignore it with a `Missing '='` message.

`CapabilityBoundingSet=` sets an upper bound on the process's capabilities
rather than granting them. Do not add `CAP_SYS_MODULE` to the set: iwd does
not load kernel modules, and this capability allows loading and unloading
them.

> ⚠️ **Important nuance**: do not set `ProtectKernelTunables=yes` for
> `iwd.service`. iwd itself manages the network sysctls
> `arp_evict_nocarrier` (IPv4) and `ndisc_evict_nocarrier` (IPv6) — among
> other things for correct Wi-Fi roaming behavior on carrier loss — while
> `ProtectKernelTunables=yes` makes kernel tunables, including `/proc/sys`,
> unwritable for the service. In the journal this shows up as lines like
> `iwd: Unable to write arp_evict_nocarrier to
> /proc/sys/net/ipv4/conf/wlan0/arp_evict_nocarrier`. Hardening must account
> for the service's real runtime requirements: `CapabilityBoundingSet` and
> other compatible restrictions can be kept.

File: `/etc/systemd/system/iwd.service.d/override.conf`

```ini
[Service]
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW CAP_NET_BIND_SERVICE
```

## 6. Applying and verifying

Before replacing an existing line and after the change, inspect the
resulting unit file configuration:

```bash
doas systemctl cat iwd.service
```

Reload the unit files and check the syntax:

```bash
doas systemctl daemon-reload
doas systemd-analyze verify iwd.service
```

The new sandbox settings take effect on the next start of iwd. To avoid
dropping the current Wi-Fi connection, postpone applying them until the next
reboot; `doas systemctl restart iwd` will drop it temporarily.

After applying, check that Wi-Fi works under NetworkManager control and that
the iwd journal has no errors related to the drop-in or to writing
`arp_evict_nocarrier` and `ndisc_evict_nocarrier`. These checks are not
performed merely because the unit file syntax is valid.

## 7. Rollback

If iwd stopped connecting to the network after the restart, restore the
previous contents of the local drop-in or delete the override, then run
`doas systemctl daemon-reload` again. Restart iwd, or leave applying the
change until the next boot if the current connection must not be
interrupted.

## Related docs

- [ASUS B5402 networking](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — the actual state of the reference system.
- [MAC randomization diagnostics](../../troubleshooting/networkmanager-iwd-mac-randomization/)
  — a separate troubleshooting document.

## References

- [iwd — upstream systemd unit file](https://git.kernel.org/pub/scm/network/wireless/iwd.git/tree/src/iwd.service.in)
- [iwd — src/station.c (nocarrier sysctl handling)](https://git.kernel.org/pub/scm/network/wireless/iwd.git/tree/src/station.c)
- [systemd.exec(5) — CapabilityBoundingSet=](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#CapabilityBoundingSet=)
- [systemd.exec(5) — ProtectKernelTunables=](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#ProtectKernelTunables=)
- [Linux kernel documentation — ip-sysctl (`arp_evict_nocarrier`, `ndisc_evict_nocarrier`)](https://docs.kernel.org/networking/ip-sysctl.html)
- [capabilities(7) — CAP_SYS_MODULE](https://man7.org/linux/man-pages/man7/capabilities.7.html)
