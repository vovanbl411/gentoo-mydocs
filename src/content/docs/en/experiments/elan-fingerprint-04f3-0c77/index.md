---
title: "Configuring the Elan 04f3:0c77 fingerprint reader on Gentoo (and other distributions)"
kind: reference
scope: system
status: draft
last_verified: null
verified_on: [asus-b5402]
---

> **Experiment status**: This is an unfinished experiment for ELAN
> `04f3:0c77`. A working combination of quirks has not been confirmed, so this
> document cannot be treated as a ready installation guide. Technical
> revalidation will be a separate stage.

## **1. Introduction**
This guide describes how to enable support for the Elan Microelectronics Corp.
fingerprint reader with USB ID `04f3:0c77` (ELAN:ARM-M4) in Linux. The main
difficulty is that the device is not supported by the standard `libfprint`
driver. It uses a modified driver from the
[xerootg/libfprint](https://github.com/xerootg/libfprint) repository, which
already supports several Elan devices. For `04f3:0c77`, its ID had to be added
and the correct `quirk` selected (a flag that controls protocol-specific
behavior).

## **2. Prerequisites**
Make sure the required packages are installed:

- `git` – to clone the repository
- `meson`, `ninja` – build system
- `gcc` (or another C compiler)
- `pkgconfig`
- libraries: `libusb`, `glib`, `nss`, `libgusb`, `libudev` (they are usually
  already installed, but check)
- `fprintd` – daemon for system integration
- `systemd` or `OpenRC` (to manage services)

On Gentoo, installation may look like this:

```bash
sudo emerge -av dev-vcs/git dev-util/meson dev-util/ninja sys-devel/gcc dev-util/pkgconfig virtual/libusb dev-libs/glib dev-libs/nss sys-auth/fprintd
```

## **3. Obtaining the modified driver source**
Clone the xerootg fork:

```bash
git clone https://github.com/xerootg/libfprint.git
cd libfprint
```

## **4. Modifying the driver**
### **4.1. Adding the device ID**
Open `drivers/elanmoc2.c` and locate the `elanmoc2_id_table` array. Add an
entry for your device (PID `0x0c77`):

```c
static const FpIdEntry elanmoc2_id_table[] = {
    // ... other entries
    {.vid = ELANMOC2_VEND_ID, .pid = 0x0c77, .driver_data = ELANMOC2_QUIRK_USE_EP83_FOR_MOC},
    {.vid = 0, .pid = 0, .driver_data = 0}
};
```

The `driver_data` value (quirk) must be selected experimentally. Start with
`ELANMOC2_QUIRK_USE_EP83_FOR_MOC`.

### **4.2. Fixing the interface number**
The device has only one interface (number 0), but the driver also tried to
claim interface 1. In `elanmoc2_open`, remove or comment out the block that
tries to claim interface 1, or retain only the claim for interface 0. The
function should ultimately look approximately like this:

```c
static void
elanmoc2_open (FpDevice *device)
{
  g_autoptr(GError) error = NULL;
  FpiDeviceElanMoC2 *self;

  if (!g_usb_device_reset (fpi_device_get_usb_device (device), &error))
    return fpi_device_open_complete (device, g_steal_pointer (&error));

  if (!g_usb_device_claim_interface (
        fpi_device_get_usb_device (FP_DEVICE (device)), 0, 0, &error))
    return fpi_device_open_complete (device, g_steal_pointer (&error));

  fp_dbg ("Interface 0 claimed successfully, skipping interface 1 (not present on this model)");

  self = FPI_DEVICE_ELANMOC2 (device);
  self->quirks = fpi_device_get_driver_data (FP_DEVICE (device));
  fpi_device_open_complete (device, NULL);
}
```

## **5. Building and installing**
### **5.1. Configuring the build with the /usr prefix**
To install the library into the system `/usr/lib64` directory rather than
`/usr/local`, run:

```bash
meson setup build --prefix=/usr
```

If you have already configured the build, use `--reconfigure`.

### **5.2. Compiling and installing**

```bash
ninja -C build
sudo ninja -C build install
sudo ldconfig
```

## **6. Configuring access rights (udev)**
Create a rule to allow regular users to access the device:

```bash
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="04f3", ATTRS{idProduct}=="0c77", MODE="0660", GROUP="plugdev"' | sudo tee /etc/udev/rules.d/99-fingerprint.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Add your user to the `plugdev` group if this has not already been done:

```bash
sudo usermod -aG plugdev $USER
```

Then **log out and back in** (or restart the session) for the changes to take
effect.

## **7. Verifying the driver with source examples**
Go to the build directory and run the test utilities (as root to ensure
access):

```bash
cd build/examples
sudo ./verify
```

If the device is detected, select a finger and check its response. If it works,
try enrollment:

```bash
sudo ./enroll
```

On successful enrollment, you will see a completion message.

## **8. Integrating with the system `fprintd`**
### **8.1. Checking the library in use**
Make sure that the `fprintd` service loads your version of the library:

```bash
sudo systemctl restart fprintd
sudo lsof -p $(pidof fprintd) | grep libfprint
```

The path must point to `/usr/lib64/libfprint-2.so.2`. If it does not, check the
installation and repeat step 5.

### **8.2. Checking device detection**

```bash
fprintd-list $USER
```

It should display a message about the device and the absence of enrolled
fingers.

## **9. Selecting the correct quirk**
If enrollment or verification through `fprintd` does not work (size errors,
`verify-no-match`, and so on), select the `driver_data` value (quirk). The
driver defines the following flags (they can be combined with `|`):

- `ELANMOC2_QUIRK_NONE` (0) – no special behavior
- `ELANMOC2_QUIRK_USE_EP83_FOR_MOC` (1 << 0) – use endpoint 0x83 for data transfer
- `ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3` (1 << 1) – offset in the finger-information structure
- `ELANMOC2_QUIRK_NO_DELETE_BY_ID` (1 << 2) – do not use deletion by ID

### **9.1. Iteration procedure**
For every value in the list below:

1. Edit `drivers/elanmoc2.c`, setting `driver_data` for `0x0c77` to the
   appropriate value.
2. Rebuild and install the driver:
   ```bash
   ninja -C build && sudo ninja -C build install && sudo ldconfig && sudo systemctl restart fprintd
   ```
3. Delete previous fingerprints (if any) with `fprintd-delete $USER`.
4. Try to enroll a finger: `fprintd-enroll`. Closely watch the output and the
   `journalctl -u fprintd -f` logs.
5. If enrollment succeeds, verify it: `fprintd-verify`.
6. If the error repeats, proceed to the next value.

### **9.2. Recommended sequence of combinations**
1. `ELANMOC2_QUIRK_NONE`
2. `ELANMOC2_QUIRK_USE_EP83_FOR_MOC` (already used)
3. `ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3`
4. `ELANMOC2_QUIRK_NO_DELETE_BY_ID`
5. `ELANMOC2_QUIRK_USE_EP83_FOR_MOC | ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3`
6. `ELANMOC2_QUIRK_USE_EP83_FOR_MOC | ELANMOC2_QUIRK_NO_DELETE_BY_ID`
7. `ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3 | ELANMOC2_QUIRK_NO_DELETE_BY_ID`
8. All three together.

### **9.3. Additional tips**
- During testing, watch the `journalctl -u fprintd -f` logs. They often
  contain key error messages, for example,
  `Unexpected short error of 2 size (expected 64)`.
- If fingerprint deletion produces the same error, the problem is in operations
  involving the device's internal memory.
- After successful enrollment, the fingerprint file should appear in
  `/var/lib/fprint/$USER/`. Its size may vary (usually 64 bytes or more).
- If no combination produces a result, the expected response size in the code
  may need to be changed (but this is a more complicated path).

## **10. Configuring PAM to use the fingerprint**
Once `fprintd-verify` starts working successfully, fingerprint authentication
can be added for sudo, login, and so on.

For example, edit `/etc/pam.d/sudo` for `sudo` and add the following at the
top:

```
auth sufficient pam_fprintd.so
```

For login (GDM, SDDM), edit the corresponding file in `/etc/pam.d/` (usually
`system-local-login` or `gdm-password`). **Be careful** – always keep a
terminal with root access open in case of an error.

## **11. Conclusion**
You have completed the difficult work of adapting a driver for an unsupported
reader. The main stages are:

- Modifying the source (adding the PID, fixing the interface)
- Building and installing into the system directory
- Configuring udev permissions
- Integrating with fprintd
- Selecting quirks

All that remains is to find the correct flag combination. With methodical
iteration and log analysis, this is achievable.

**Useful links:**

- [Original linux-surface GitHub issue](https://github.com/linux-surface/linux-surface/issues/1380)
- [xerootg repository with the modified driver](https://github.com/xerootg/libfprint)
- [Discussion for 04f3:0c77 (depau/elanpoc#2)](https://github.com/depau/elanpoc/issues/2)
