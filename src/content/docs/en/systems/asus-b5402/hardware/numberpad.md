---
title: ASUS NumberPad — numeric keypad on the touchpad
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Current state

On the ASUS B5402, `sys-apps/asus-numberpad-driver` from
[asus-numberpad-overlay](https://github.com/vovanbl411/asus-numberpad-overlay)
uses NumberPad on the `ASUE1410:01 04F3:3230` touchpad with the `b7402` layout.
The driver runs as a systemd user service and connects to the Umbriel Wayland
session. The service is started manually; Umbriel does not start it
automatically.

At startup, the driver detects the built-in keyboard, touchpad and its hidraw
device. It uses hidraw to communicate with the touchpad; the current setup does
not use the I²C fallback. `eventN` and `hidrawN` numbers can change.

## Configuration

File: `~/.config/asus-numberpad-driver/service.conf`

The user unit reads the layout and configuration-directory variables from this
file:

```ini
NUMBERPAD_LAYOUT=b7402
NUMBERPAD_CONFIG_DIR=<absolute-home>/.config/asus-numberpad-driver/
```

Set `NUMBERPAD_CONFIG_DIR` to the absolute path under the home directory.
Replace `<absolute-home>` with the actual path; the service does not expand
`~` or `$HOME` in this value. The path ends with `/`.

## Device access

The local rule assigns ownership only for the touchpad's hidraw device and
`/dev/uinput`. Replace `<user>` with the account that runs the service.

File: `/etc/udev/rules.d/99-asus-numberpad-local.rules`

```text
SUBSYSTEM=="hidraw", KERNELS=="0018:04F3:3230.*", OWNER="<user>", MODE="0600"
SUBSYSTEM=="misc", KERNEL=="uinput", OWNER="<user>", MODE="0600"
```

Access to keyboard and touchpad events is provided through the `input` group.
Membership also grants access to other input devices, so their events can be
read too.

> ⚠️ **Important**: `input` membership grants broader access to input-device
> events than NumberPad alone requires.

## Starting in Umbriel

Start the service manually from a terminal in the active Umbriel session:

```bash
systemctl --user start asus-numberpad-driver.service
```

The unit is static because it has no `[Install]` section, so it is not enabled
with `systemctl enable`. When started, the service detects the Wayland session
through the systemd user manager's environment. To stop it manually:

```bash
systemctl --user stop asus-numberpad-driver.service
```

## Verification

Check the service and its journal:

```bash
systemctl --user status asus-numberpad-driver.service
journalctl --user -b -u asus-numberpad-driver.service --no-pager
```

The journal should have no permission or configuration errors. After starting
the service, test NumberPad on the touchpad: presses in the numeric area should
enter the corresponding digits. Service status alone does not confirm physical
input.

## Troubleshooting

- **`Permission denied`** — check the permissions of the specific node named
  in the journal and its udev rule. Do not grant access to every input or
  hidraw device.
- **The service cannot see Wayland** — check the systemd user manager's
  environment. From Umbriel, import the current session variables and restart
  the service:

  ```bash
  systemctl --user import-environment WAYLAND_DISPLAY XDG_RUNTIME_DIR XDG_SESSION_TYPE DBUS_SESSION_BUS_ADDRESS
  systemctl --user restart asus-numberpad-driver.service
  ```

- **Wrong layout** — check `NUMBERPAD_LAYOUT` in `service.conf`; this touchpad
  uses `b7402`.
- **hidraw is unavailable** — check that the udev rule matches the touchpad's
  parent HID device. Do not add I²C access before finding the cause.

## Related material

- [ASUS B5402 desktop environment](../../desktop/environment/)
- [asus-numberpad-overlay](https://github.com/vovanbl411/asus-numberpad-overlay) —
  package installation, supported Python versions and build information.
