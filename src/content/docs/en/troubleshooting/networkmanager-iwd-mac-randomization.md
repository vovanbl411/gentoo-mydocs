---
title: Configuring MAC randomization and iwd in NetworkManager on Gentoo
kind: troubleshooting
scope: general
status: current
last_verified: "2026-03-03"
verified_on: [asus-b5402]
---

## 1. Symptom / goal

This document covers the case where NetworkManager uses `iwd` for Wi-Fi,
MAC randomization is expected, but the effective configuration does not produce
the expected result or is overridden by another config.

This is troubleshooting for the original incident and a set of configuration
options, not a universally recommended setup for every Wi-Fi device.

## 2. When to apply and what to check

Before making changes, check:

- which Wi-Fi driver is in use;
- the effective NetworkManager configuration;
- existing files in `/etc/NetworkManager/conf.d/` and system config dirs;
- whether a temporary Wi-Fi disconnection during a NetworkManager restart is
  acceptable.

The actual current ASUS B5402 state is recorded in
[the system document](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
and is not duplicated here.

## 3. Cause: observations from the original incident

### Configuration conflict

In the original incident, the system file
`/usr/lib/NetworkManager/conf.d/31-mac-addr-change.conf` overrode user
settings:

```ini
# System config (protects problematic drivers)
wifi.scan-rand-mac-address=no
wifi.cloned-mac-address=preserve
```

The parameters applied to all devices, although they were intended only for
the `eagle_sdio` and `wl` (Broadcom) drivers. This is an observation from the
original incident, not a universal fact about all current NetworkManager
versions.

### Historical / legacy configuration

The original configuration also contained an old parameter:

```ini
# DO NOT USE — obsolete syntax
[connection]
wifi.mac-address-randomization=2
```

## 4. Fix / configuration

### 1. Identify the Wi-Fi driver

```bash
lspci -k | grep -A3 "Network controller"
```

Example from the original incident on ASUS B5402 with Intel AX201:

```text
00:14.3 Network controller: Intel Corporation Alder Lake-P PCH CNVi WiFi (rev 01)
    DeviceName: Onboard - Ethernet
    Subsystem: Intel Corporation Dual Band Wi-Fi 6(802.11ax) AX201 160MHz 2x2 [Harrison Peak]
    Kernel driver in use: iwlwifi
```

The original document grouped the drivers as follows:

**Supported drivers** — disabling `31-mac-addr-change.conf` was suggested for
these:

- `iwlwifi` (Intel) — ✅ recommended
- `mt76` (MediaTek) — ✅
- `ath10k`, `ath9k`, `ath11k` (Atheros/Qualcomm) — ✅
- `rtl8xxxu`, `rtw88`, `rtw89` (Realtek) — ✅

**Problematic drivers** — `31-mac-addr-change.conf` was kept for these:

- `wl` (proprietary Broadcom) — ❌ does not support changing the MAC
- `eagle_sdio` — ❌ rare, built-in

### 2. Check and disable the conflicting config

```bash
# Create an empty stub file (mask the system file)
doas touch /etc/NetworkManager/conf.d/31-mac-addr-change.conf

# Or add a comment:
echo "# Disabled: iwlwifi supports MAC randomization" | doas tee /etc/NetworkManager/conf.d/31-mac-addr-change.conf
```

The original fix did not use a symlink to `/dev/null`: NetworkManager checks
`stat()` and refuses to read non-regular files.

### 3. Set iwd as the backend

```bash
doas nano /etc/NetworkManager/conf.d/wifi-backend.conf
```

Contents:

```ini
[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
```

### 4. Choose a MAC policy

```bash
doas nano /etc/NetworkManager/conf.d/99-mac-privacy.conf
```

**Option A: stable**

```ini
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
connection.stable-id=${CONNECTION}/${BOOT}
```

**Option B: random**

```ini
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=random
ethernet.cloned-mac-address=random
```

**Option C: stable-ssid**

```ini
[connection]
wifi.cloned-mac-address=stable-ssid
```

### 5. Apply the configuration

> ⚠️ **Important nuance**: restarting NetworkManager may temporarily
> disconnect the current Wi-Fi connection.

```bash
doas systemctl restart NetworkManager
```

## 5. Verification

### Effective NetworkManager config

```bash
NetworkManager --print-config | grep -E "wifi\."
```

Example of expected lines for the `stable` option:

```text
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
```

### Permanent and current MAC

```bash
# Hardware (permanent) MAC
ethtool -P wlan0

# Current MAC (may be randomized)
ip link show wlan0
```

Example from the original document, not required exact output:

```text
$ ethtool -P wlan0
Permanent address: 8c:c6:81:xx:xx:xx  # Intel OUI

$ ip link show wlan0
link/ether 92:4a:xx:xx:xx:xx  # Different MAC → randomization is working!
```

### Active backend

```bash
# Should show iwd
NetworkManager --print-config | grep backend

# Or use nmcli
nmcli -f GENERAL.DEVICE,GENERAL.TYPE,GENERAL.DRIVER device show wlan0
```

### iwd status

```bash
systemctl status iwd

# iwd should be active (running)
# NetworkManager starts it automatically through D-Bus
```

## 6. Rollback / recovery

If Wi-Fi stops working after the change, restore the previous configs. Remove
the masking file or restore its previous contents, restore the previous
backend and MAC policy files, then reapply the NetworkManager configuration:

```bash
doas systemctl restart NetworkManager
```

After rollback, check that Wi-Fi has recovered and inspect the effective
NetworkManager config.

## 7. Background / reference

### Why the original fix chose iwd

- Faster reconnection to known networks (~1 sec vs ~5-10 sec with
  wpa_supplicant)
- Better handling of Enterprise networks (WPA2-Enterprise, 802.1X)
- Lower memory use
- A modern codebase (written in C, uses the kernel API directly)

### MAC randomization levels

| Level | Parameter | When it changes | Behavior |
|---------|----------|---------------|-----------|
| Scanning | `wifi.scan-rand-mac-address` | Every scan | Prevents tracking while searching for networks |
| Connection (stable) | `wifi.cloned-mac-address=stable` | At each boot for that network | Stable address for the connection |
| Connection (random) | `wifi.cloned-mac-address=random` | Each connection | New MAC on every connection |
| Connection (stable-ssid) | `wifi.cloned-mac-address=stable-ssid` | Depends on SSID | Separate value for each SSID |
| Connection (preserve) | `wifi.cloned-mac-address=preserve` | Never | Preserves a manually assigned MAC |

### NetworkManager config load order

1. `/etc/NetworkManager/NetworkManager.conf`
2. `/usr/lib/NetworkManager/conf.d/*.conf`
3. `/etc/NetworkManager/conf.d/*.conf` (last wins within the group)
4. `/run/NetworkManager/conf.d/*.conf` (temporary, highest priority)

The original explanation says that `/usr/lib/NetworkManager/conf.d/` is scanned
**after** `/etc/NetworkManager/conf.d/`, so `31-*` overrides `99-*`. The
proposed fix is to create a file with the same name under `/etc/` to replace
the system file.

### Obsolete parameters

| Obsolete | Current | Note |
|------------|-------------|------------|
| `wifi.mac-address-randomization=0\|1\|2` | `wifi.cloned-mac-address` | 0=default, 1=never, 2=always |
| `wifi.mac-address-randomization` in `[device]` | `wifi.scan-rand-mac-address` | Separates scanning from connecting |

## 8. Additional troubleshooting

### `Failed to read configuration: Not a regular file`

**Cause:** A symlink to `/dev/null` was used.

**Fix:**

```bash
doas rm /etc/NetworkManager/conf.d/31-mac-addr-change.conf
doas touch /etc/NetworkManager/conf.d/31-mac-addr-change.conf
```

### Wi-Fi does not connect after changing the MAC

**Cause:** A captive portal or MAC filtering on the router.

**Fix:** Use `stable` instead of `random`:

```ini
wifi.cloned-mac-address=stable
```

### iwd does not start

**Check:**

```bash
# It should be installed
emerge -qv net-wireless/iwd

# It should not be enabled as a service (NM manages it)
doas systemctl disable iwd  # if it was enabled
```

### Conflict with systemd-networkd

**Symptom:** Connections appear in `/run/NetworkManager/system-connections/`.

**Fix:** Disable systemd-networkd for Wi-Fi:

```bash
doas systemctl disable systemd-networkd
# or
doas systemctl mask systemd-networkd-wait-online.service
```

## 9. Example configuration from the original incident

This block shows the historical configuration used in the original incident.
It is not the current source of truth for ASUS B5402.

### Files

```text
/etc/NetworkManager/
├── NetworkManager.conf          # [main] plugins=keyfile
├── conf.d/
│   ├── 31-mac-addr-change.conf  # EMPTY (masks the system file)
│   ├── wifi-backend.conf        # iwd + scan rand MAC
│   └── 99-mac-privacy.conf      # stable MAC for connections
```

### File contents

File: `/etc/NetworkManager/NetworkManager.conf`

```ini
[main]
plugins=keyfile
```

File: `/etc/NetworkManager/conf.d/wifi-backend.conf`

```ini
[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
```

File: `/etc/NetworkManager/conf.d/99-mac-privacy.conf`

```ini
[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
connection.stable-id=${CONNECTION}/${BOOT}
```

File: `/etc/NetworkManager/conf.d/31-mac-addr-change.conf`

```ini
# Masked: iwlwifi driver supports MAC randomization
# Original file: /usr/lib/NetworkManager/conf.d/31-mac-addr-change.conf
```

## 10. Useful commands

```bash
# Monitor MAC changes
watch -n 1 ip link show wlan0

# View NM logs
journalctl -u NetworkManager -f

# View iwd logs
journalctl -u iwd -f

# List all configs and their priorities
NetworkManager --print-config

# Show the current connection
nmcli connection show --active

# Change the MAC manually (testing)
doas ip link set wlan0 down
doas ip link set wlan0 address 92:4a:00:00:00:01
doas ip link set wlan0 up
```

## 11. Historical incident context

- **Date:** 2026-03-03
- **Environment:** Gentoo Linux
- **NetworkManager:** 1.4x+
- **iwd:** 2.x

This is the historical environment of the original incident. The confirmed
current ASUS B5402 state is recorded in
[the system document](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

## Related docs

- [NetworkManager + iwd](../../networking/networkmanager-iwd/) — general
  NetworkManager configuration with the iwd backend.
- [ASUS B5402 networking](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — the confirmed current state of the reference system.
