---
title: ASUS NumberPad — numeric keypad on the touchpad
kind: guide
scope: system
status: current
last_verified: null
verified_on: []
---

The ASUS NumberPad driver turns the touchpad into a numeric keypad. On ASUS
B5402, device `ASUE1410:01 04F3:3230` uses the `b7402` layout. The layout name
belongs to the driver; do not choose it solely from the laptop model.

## Installation

The driver and its dependency `dev-python/python-periphery` are in
[asus-numberpad-overlay](https://github.com/vovanbl411/asus-numberpad-overlay).
Register your overlay checkout with Portage using its README, allow the
testing keywords requested by Portage and install the package:

```bash
emerge -pv sys-apps/asus-numberpad-driver
doas emerge --ask sys-apps/asus-numberpad-driver
```

Both Python packages must support the selected interpreter version.
The service runs as the regular user; installing the package does not
start it automatically.

## Layout and settings directory

Available layouts are in `/usr/share/asus-numberpad-driver/layouts`.
The user service reads variables from
`~/.config/asus-numberpad-driver/service.conf`.

If `service.conf` already exists, keep a backup and edit the required
values by hand. The following block creates a new file:

```bash
mkdir -p "$HOME/.config/asus-numberpad-driver"
cat > "$HOME/.config/asus-numberpad-driver/service.conf" <<EOF
NUMBERPAD_LAYOUT=b7402
NUMBERPAD_CONFIG_DIR=$HOME/.config/asus-numberpad-driver/
EOF
```

`NUMBERPAD_LAYOUT` selects the layout. The second parameter needs an absolute
path without spaces and with a trailing slash. The command inserts your home
directory; the service does not expand `~` as a shell would. The driver creates
the `numberpad_dev` file in this directory.

## Device access

The driver reads keyboard and touchpad events through `/dev/input/event*`,
creates a virtual keyboard through `/dev/uinput` and controls the touchpad
through hidraw. If hidraw is unavailable, the driver can use the I²C bus;
working hidraw avoids granting access to the entire bus.

The `event*` and `hidraw*` numbers can change. Find the devices first:

```bash
cat /proc/bus/input/devices
```

In the desired device's block, the `Handlers` field names its `event*` node.
Inspect persistent attributes for the selected node:

```bash
udevadm info --attribute-walk --name=/dev/input/eventN
udevadm info --attribute-walk --name=/dev/hidrawN
```

Replace `eventN` and `hidrawN` here and below with the names you found.
Match hidraw to the touchpad using its parent HID device, not the node number.

Local rules go in `/etc/udev/rules.d/99-asus-numberpad-local.rules`.
The following is a template: replace `<user>`, device names and the HID
identifier with values from your system. For input, use `ATTRS{name}`;
for hidraw, use the parent HID device's `KERNELS` value from `udevadm` output.

```udev
SUBSYSTEM=="input", KERNEL=="event*", ATTRS{name}=="<touchpad name>", OWNER="<user>", MODE="0600"
SUBSYSTEM=="input", KERNEL=="event*", ATTRS{name}=="<keyboard name>", OWNER="<user>", MODE="0600"
SUBSYSTEM=="hidraw", KERNELS=="<parent HID identifier>", OWNER="<user>", MODE="0600"
SUBSYSTEM=="misc", KERNEL=="uinput", OWNER="<user>", MODE="0600"
```

Do not copy the template with unreplaced values. For input, add only the
devices the driver needs; do not expose every `event*`, hidraw or I²C device
to arbitrary users. Reading input reveals keystrokes, and writing to uinput
allows injecting them as the user.

If `/dev/uinput` is missing, load the module:

```bash
doas modprobe uinput
```

To load it after reboot, add the line `uinput` to
`/etc/modules-load.d/uinput.conf`.

After editing the rules, reload them:

```bash
doas udevadm control --reload-rules
```

New permissions apply when devices are created. For a built-in touchpad,
rebooting is a simple way to apply them. Check as the regular user:

```bash
ls -l /dev/input/eventN /dev/hidrawN /dev/uinput
```

The service user must have read and write access to the required nodes.
To undo the change, remove only the added local rule lines and reload the rules;
previous permissions return when the devices are next created.

## Starting in a Wayland session

The service needs the current desktop's environment variables. Run these
commands in a terminal inside Umbriel, not over SSH or from a separate text
console:

```bash
: "${WAYLAND_DISPLAY:?}" "${XDG_RUNTIME_DIR:?}" "${DBUS_SESSION_BUS_ADDRESS:?}" &&
test "${XDG_SESSION_TYPE:-}" = wayland &&
  systemctl --user import-environment WAYLAND_DISPLAY XDG_RUNTIME_DIR XDG_SESSION_TYPE DBUS_SESSION_BUS_ADDRESS &&
  systemctl --user start asus-numberpad-driver.service
```

The first lines check for the Wayland environment and pass it to the systemd
user manager. The driver starts only after that.

Check the status and try enabling NumberPad on the touchpad:

```bash
systemctl --user status asus-numberpad-driver.service
journalctl --user -b -u asus-numberpad-driver.service
```

The service should run without permission errors; presses in the numeric
area should enter the corresponding digits. On `Permission denied`, check
the device node named in the log and that node's permissions.

To stop it, run separately:

```bash
systemctl --user stop asus-numberpad-driver.service
```

The service has no installation section for `systemctl enable`. If you
configure compositor autostart, run the environment-import and startup
sequence after Wayland is ready, and stop the service when leaving the session.
Starting it over SSH does not replace startup inside the graphical session.

## Related material

- [Laptop desktop environment](../../desktop/environment/)
- [Overlay README](https://github.com/vovanbl411/asus-numberpad-overlay)
