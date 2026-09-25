---
title: Connecting an Android phone over USB to Gentoo Linux
kind: troubleshooting
scope: general
status: draft
last_verified: null
verified_on: []
---

## What is MTP, and what is it for?

**MTP** (Media Transfer Protocol) is a protocol for transferring media files between devices. Android uses it over USB when the phone is set to “File transfer.”

Unlike a USB flash drive, MTP does not provide direct access to the phone's filesystem. It works through **sessions**: the phone decides which files to expose. This is safer, but less reliable: the session can be reset when the screen locks, the USB mode changes, or authorization fails.

**Why does MTP often “break” on Linux?**

- It requires an unlocked screen and explicit permission to access data.
- Some manufacturers (Vivo, Xiaomi, Oppo, Huawei) use nonstandard MTP implementations, which can cause `NULL device` errors.
- The Linux kernel may block the USB device (`usbguard`, or missing authorization).

---

## Common connection problems

- The phone keeps reconnecting (connected → disconnected → connected).
- `dmesg` reports `Device is not authorized for usage`.
- `simple-mtpfs` reports `LIBMTP PANIC: NULL device!`.
- `mtp-detect` reports `PTP_ERROR_IO: failed to open session`.

### Example kernel log

```bash
[1456.402150] usb 3-1: Product: Android Phone
[1456.402153] usb 3-1: Manufacturer: ManufacturerName
[1456.402156] usb 3-1: SerialNumber: ABC123
[1456.402624] usb 3-1: Device is not authorized for usage
```

---

## Common causes

1. **USB authorization at the kernel level** — the device gets `authorized=0`, so the kernel blocks it.
2. **usbguard blocks the device** — when the mode changes (charging → MTP → ADB), the phone registers again, and usbguard sees a “new” device and blocks it.
3. **The MTP session does not open** if:
   - the screen is locked;
   - “File transfer (MTP)” is not selected;
   - “Allow” was not tapped in the data access prompt.
4. **The `libmtp` library is incompatible with a specific model**, causing a `NULL device` error in `simple-mtpfs`.
5. **`gvfs-mtp` has claimed the device**, preventing manual mounting with `jmtpfs` or `simple-mtpfs`.

---

## Diagnosis

### 1. Follow kernel logs in real time

```bash
dmesg -w
```

Connect the phone. Look for:
- `Device is not authorized for usage`
- `usb X-X: Product:`
- `PTP_ERROR_IO`

### 2. Check USB authorization status

Find the port in `dmesg` (for example, `3-1`), then run:

```bash
cat /sys/bus/usb/devices/3-1/authorized
# 0 – unauthorized, 1 – authorized
```

### 3. Find your phone's VID and PID

```bash
lsusb | grep -i "your phone name"
# Example output: Bus 003 Device 004: ID 2d95:6002 Android Phone
```

Here, `2d95` is the **VID** (Vendor ID), and `6002` is the **PID** (Product ID). Note them down.

### 4. Check MTP detection

```bash
sudo emerge --ask mtp-tools   # install if missing
mtp-detect
```

If `PTP_ERROR_IO: failed to open session` appears, the session could not be opened (the screen may be locked or permission may be missing).

---

## Step-by-step fix

### Stage 1: Authorize the USB device (kernel)

**Temporary fix (until reboot):**

```bash
# Replace 3-1 with your port from dmesg
echo 1 | sudo tee /sys/bus/usb/devices/3-1/authorized
```

**Persistent fix (using udev):**

```bash
sudo nano /etc/udev/rules.d/99-android-usb.rules
```

Add a line (replace `2d95` with your VID):

```bash
# Authorize all devices with this VID
SUBSYSTEM=="usb", ATTR{idVendor}=="2d95", ATTR{authorized}="1"

# Or match a specific VID+PID:
# SUBSYSTEM=="usb", ATTR{idVendor}=="2d95", ATTR{idProduct}=="6002", ATTR{authorized}="1"
```

Apply the rules:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Disconnect and reconnect the phone.

---

### Stage 2: Configure usbguard (if used)

If `usbguard` is active, it may block the phone when its mode changes. Add an allowance for the VID:

```bash
sudo systemctl stop usbguard
echo "allow with-vid 2d95" | sudo tee -a /etc/usbguard/rules.conf
sudo systemctl start usbguard
```

Or generate a policy without hashes:

```bash
sudo usbguard generate-policy --no-hashes --no-ports-sn > /etc/usbguard/rules.conf
sudo systemctl restart usbguard
```

---

### Stage 3: Prepare the phone (required)

Before mounting MTP, do the following on the phone:

1. **Unlock the screen** (PIN, password, or pattern).
2. Connect the USB cable.
3. Tap the “Charging this device via USB” notification.
4. Select **“File transfer (MTP)”** (it may be called “MTP” or “Data transfer”).
5. If the “Allow access to data?” dialog appears, tap **“Allow.”**
6. Keep the screen unlocked while mounting.

---

### Stage 4: Mount MTP on Gentoo

> **Author's note:** According to the official Gentoo Wiki documentation, the preferred tool for mounting MTP devices is `sys-fs/mtpfs` (MTPfs). This FUSE filesystem provides access to MTP devices.

#### Method 1: `mtpfs` (recommended; based on the official documentation)

```bash
sudo emerge --ask sys-fs/mtpfs
mkdir -p ~/phone
mtpfs ~/phone
ls ~/phone
fusermount -u ~/phone   # unmount
```

**Important:** Be patient; the first mount can take several minutes.

#### Method 2: `gvfs` with MTP support (for GNOME/KDE/Xfce file managers)

This method does not require mounting manually from a terminal and integrates with file managers in popular desktop environments.

```bash
# Enable the "mtp" USE flag for the gvfs package
echo "gnome-base/gvfs mtp" >> /etc/portage/package.use/gvfs
sudo emerge --ask gnome-base/gvfs
```

Then restart the desktop session. Connect the phone in MTP mode; it should appear automatically in the file manager's sidebar (Nautilus, Dolphin, Thunar, and others).

#### Method 3: `simple-mtpfs` (alternative; may not work with some models)

```bash
sudo emerge --ask sys-fs/simple-mtpfs
mkdir -p ~/phone
simple-mtpfs --device 1 --mount ~/phone
```

If you get `LIBMTP PANIC: NULL device`, try another method.

#### Method 4: `jmtpfs` (alternative if the others do not work)

```bash
sudo emerge --ask jmtpfs
mkdir -p ~/phone
jmtpfs ~/phone
ls ~/phone
fusermount -u ~/phone
```

#### Method 5: `adbfs` via ADB (most reliable; does not require MTP)

Enable **USB debugging** on the phone (in Developer options). Then:

```bash
# Install android-tools, which provides ADB and fastboot
sudo emerge --ask dev-util/android-tools
adb devices   # allow access on the phone
mkdir -p ~/phone
adbfs ~/phone
ls ~/phone
fusermount -u ~/phone
```

This method avoids MTP problems.

---

## Quick-fix checklist (substitute your VID and port)

```bash
# 1. Authorize USB (port from dmesg)
echo 1 | sudo tee /sys/bus/usb/devices/3-1/authorized

# 2. Persistent udev rule
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="2d95", ATTR{authorized}="1"' | sudo tee /etc/udev/rules.d/99-android-usb.rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# 3. usbguard: allow the VID
sudo systemctl stop usbguard
echo "allow with-vid 2d95" | sudo tee -a /etc/usbguard/rules.conf
sudo systemctl start usbguard

# 4. Prepare the phone (unlock it, select MTP, allow access)

# 5. Install mtpfs and mount
sudo emerge --ask sys-fs/mtpfs
mkdir -p ~/phone
mtpfs ~/phone
ls ~/phone
```

---

## Additional tips

### If the phone keeps reconnecting

- Try another USB cable (it must support data).
- Connect directly to a USB 2.0 port (without a hub).
- If the laptop is on battery, connect it to AC power (insufficient current may be the cause).
- Watch `dmesg -w` for `error -71` or `device not accepting address`.

### ADB permissions (`android-tools`)

To use ADB as a regular user, add yourself to the `plugdev` group:

```bash
sudo gpasswd -a <USER_NAME> plugdev
```

Log out and back in for the change to take effect.

---

## FAQ

**Question:** Where do I find my phone's VID/PID?<br>
**Answer:** Run `lsusb` without arguments and find the line for your phone. The VID is the first number after `ID`; the PID is the second. For example, `ID 18d1:4ee1` → VID=18d1, PID=4ee1.

**Question:** Which package provides ADB on Gentoo?<br>
**Answer:** **`dev-util/android-tools`**. It is the package officially supported on Gentoo and includes ADB and fastboot.

**Question:** Why does `simple-mtpfs` report `NULL device`?<br>
**Answer:** The `libmtp` library could not initialize an MTP session. This often happens with Vivo, Xiaomi, and Oppo phones. Use `mtpfs` or `adbfs`.

**Question:** Do I need to disable usbguard?<br>
**Answer:** No. Add a rule such as `allow with-vid <your ID>` instead.

**Question:** Can I mount MTP with the screen locked?<br>
**Answer:** No. The session will not open. The screen must be unlocked for the initial mount.

**Question:** Which method is most reliable?<br>
**Answer:** `adbfs` via ADB. It does not depend on MTP and usually works if USB debugging is enabled.

---

## Gentoo Wiki documentation

- [MTPfs](https://wiki.gentoo.org/wiki/MTPfs) — a FUSE filesystem for accessing MTP devices.<br>
  *(Used as the primary mounting tool in this guide.)*
- [GVfs](https://wiki.gentoo.org/wiki/GVfs) — a virtual filesystem that integrates MTP with file managers.<br>
  *(Recommended for desktop environments.)*
- [Android Debug Bridge (ADB)](https://wiki.gentoo.org/wiki/Android/adb) — the official Gentoo page about ADB.<br>
  *(Covers the `dev-util/android-tools` package, udev setup, and permissions.)*

---

**Problems:**
- `Device is not authorized for usage` → reconnect loop
- `LIBMTP PANIC: NULL device` → `simple-mtpfs` does not work
- `PTP_ERROR_IO: failed to open session` → screen is locked or permission is missing

**Solutions:**
1. Authorize via `/sys/bus/usb/devices/*/authorized` and a udev rule.
2. Add `allow with-id` to usbguard.
3. Use `mtpfs` (officially recommended) or `adbfs` (most reliable) instead of `simple-mtpfs`.
4. Unlock the screen, select MTP mode, and approve data access.
