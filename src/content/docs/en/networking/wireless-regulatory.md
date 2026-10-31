---
title: Wireless regulatory domain
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

A regulatory domain defines Wi-Fi rules, including allowed frequencies,
channel widths, transmit power, and other restrictions. The country code is a
two-letter ISO 3166-1 alpha-2 code. Use `<CC>` for the code of the place where
the device is actually used.

`net-wireless/wireless-regdb` provides `regulatory.db`; the kernel requests this
database through the firmware API. A separate CRDA component is not needed for
an ordinary modern setup. A country code in a request does not guarantee that
all corresponding rules will apply to every device: the result also depends on
the database, driver, and firmware.

## Check the current state

```bash
iw reg get
```

The output may contain a `global` block for the central domain and separate
`phy#N` blocks for device (wiphy) state. The listed rules show the kernel's
current state, but they do not by themselves confirm that the country code is
legally correct for where the device is used. To query a particular device,
use this command if the installed `iw` supports it:

```bash
iw phy <phy-name> reg get
```

If a PHY is marked `self-managed`, its driver or firmware controls its
regulatory state. A userspace request may not change that device's rules, even
if the global domain changes.

## Send a country request

For a one-time request to the kernel, use the code for the actual region:

```bash
doas iw reg set <CC>
```

The command sends the country code to the kernel as a regulatory
request/hint; it does not set unconditional hardware limits. After the
request, check the global domain and PHY state with the commands above.

## Set the country through iwd

File: `/etc/iwd/main.conf`

```ini
[General]
Country=<CC>
```

`Country=` also sends a request. For an ordinary wiphy, this is a regulatory
hint; userspace cannot directly set the regulatory domain's country for a
`self-managed wiphy`. If NetworkManager uses iwd as its Wi-Fi backend,
`Country=` remains an iwd setting in `main.conf`, while NetworkManager
continues to manage connections. See [NetworkManager + iwd](../networkmanager-iwd/).

## Alternative: the cfg80211 parameter

Use this option when the country hint should be set as `cfg80211` loads. For
day-to-day configuration, `Country=` in iwd is usually sufficient.

Check the configuration of the running kernel:

```bash
zgrep '^CONFIG_CFG80211=' /proc/config.gz 2>/dev/null || \
  grep '^CONFIG_CFG80211=' "/boot/config-$(uname -r)" 2>/dev/null
```

If `CONFIG_CFG80211=m`, pass the parameter through `modprobe`.

File: `/etc/modprobe.d/cfg80211.conf`

```conf
options cfg80211 ieee80211_regdom=<CC>
```

If `CONFIG_CFG80211=y`, the module configuration in `/etc/modprobe.d` does not
apply. Pass the parameter for built-in code on the kernel command line:

```text
cfg80211.ieee80211_regdom=<CC>
```

The parameter takes effect when the module or kernel loads. Do not unload
`cfg80211` on a running Wi-Fi system: this affects the entire wireless stack.
Check the result after a planned reboot.

## Verify the result

After a change, check both the global and device-specific state:

```bash
iw reg get
iw phy <phy-name> reg get
iw phy <phy-name> info
```

Check more than the country code: compare the regulatory rules, including
frequency ranges, channel width, power, and flags. `iw phy <phy-name> info`
shows the device's channels and their restrictions. A matching country code
does not guarantee that every channel is available on a particular adapter.
These commands only read the current state.

## References

- [Linux kernel: wireless regulatory](https://docs.kernel.org/networking/regulatory.html)
- [Linux Wireless: iw documentation](https://wireless.docs.kernel.org/en/latest/en/users/documentation/iw.html)
- [iwd: upstream iwd.config](https://kernel.googlesource.com/pub/scm/network/wireless/iwd/+/refs/heads/master/src/iwd.config.rst)
- [Linux kernel: net/wireless/reg.c](https://github.com/torvalds/linux/blob/master/net/wireless/reg.c)
- [Linux kernel: kernel command-line parameters](https://docs.kernel.org/admin-guide/kernel-parameters.html)
