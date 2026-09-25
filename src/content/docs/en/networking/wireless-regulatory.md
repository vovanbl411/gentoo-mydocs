---
title: Wireless regulatory domains
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

The regulatory domain defines the allowed Wi-Fi frequencies and transmit
power according to the region. It uses a two-letter ISO 3166-1 alpha-2
country code. The value must match the user's actual regulatory domain.

The `net-wireless/wireless-regdb` package provides the regulatory database
to the kernel; `crda` is obsolete. The kernel loads `regulatory.db` from
`wireless-regdb` automatically.

## 1. Before the change

Do not copy someone else's country code without checking: substitute your
own `<CC>`, where `<CC>` is the ISO 3166-1 alpha-2 code for the actual
region.

Before the change, check the current regulatory domain:

```bash
iw reg get
```

The same command is used to verify the result. For example, for Belarus the
code is `BY`; this is only a syntax example, not a universally recommended
value. The current region of the ASUS B5402 is not determined here.

## 2. Temporary setting

Set the regulatory domain until the next reboot or reconfiguration:

```bash
doas iw reg set <CC>
iw reg get
```

## 3. Permanent setting

### Via iwd

File: `/etc/iwd/main.conf`

```ini
[General]
Country=<CC>
```

The `Country` parameter in iwd is only a request to the kernel. The final
decision is made by the kernel and the regdb, and for a `self-managed
wiphy` the userspace setting is ignored altogether.

### Via the cfg80211 module parameter

File: `/etc/modprobe.d/cfg80211.conf`

```conf
options cfg80211 ieee80211_regdom=<CC>
```

The setting applies when the module is loaded. It can be applied via
`modprobe -r cfg80211 && modprobe cfg80211` or after a reboot.

> ⚠️ **Important nuance**: unloading `cfg80211` touches the running Wi-Fi
> stack and can drop the current wireless connection. If it must not be
> interrupted, apply the setting at the next reboot.

## 4. Verification

After applying, check the regulatory domain again with the same command as
before the change:

```bash
iw reg get
```

## 5. What not to do

- `iwdctl set-domain <CC>` — no such utility exists. iwd is managed through
  the interactive client `iwctl` and its configuration file, not through a
  separate domain-setting command.
- `echo "<CC>" > /sys/devices/virtual/net/wlan0/phy80211/country_code` —
  this sysfs attribute is read-only, writes are ignored.

## Related docs

- [NetworkManager + iwd](../networkmanager-iwd/) — choosing `iwd` as the
  Wi-Fi backend for NetworkManager.

## References

- [iwd.config(5) — the `[General]` section's `Country` setting](https://manpages.ubuntu.com/manpages/noble/man5/iwd.config.5.html)
- [kernel.org: Regulatory](https://wireless.wiki.kernel.org/en/developers/regulatory)
