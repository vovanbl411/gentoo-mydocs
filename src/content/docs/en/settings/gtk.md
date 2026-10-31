---
title: "Noctalia palette in GTK4: setup and troubleshooting"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

If a GTK4 application does not receive the expected Noctalia palette or shows
an incorrect background, enable both built-in Noctalia v5+ templates: GTK 3
and GTK 4. In the current implementation, Noctalia renders only enabled
templates, and both GTK templates use a shared apply hook that checks both
generated `noctalia.css` files. Manual CSS rules are only for a confirmed
issue in a specific application or widget.

## Noctalia's built-in GTK templates

In Noctalia, open **Settings → Templates** and enable both built-in templates:
**GTK 3** and **GTK 4**. Enabling only GTK 4 can make the shared apply hook fail
because the disabled GTK 3 template is not rendered automatically.

Noctalia generates a separate `noctalia.css` in each GTK configuration
directory, and the shared hook adds an import to both `gtk.css` files. When
the palette or theme mode changes, Noctalia updates the templates. After both
files pass the check, the hook selects `adw-gtk3` for light mode or
`adw-gtk3-dark` for dark mode. GTK4 reads the user file
`$XDG_CONFIG_HOME/gtk-4.0/gtk.css` if it exists; when `XDG_CONFIG_HOME` is
unset, the default is `~/.config`.

```text
Noctalia palette
→ built-in GTK 3 and GTK 4 templates
→ separate noctalia.css files in gtk-3.0/ and gtk-4.0/
→ matching imports in both gtk.css files
→ GTK applications
```

Make sure the `adw-gtk3` theme is installed. Do not edit the generated
`noctalia.css` by hand; Noctalia replaces its contents when it regenerates the
file.

## Color scheme and `settings.ini`

`theme.sync_color_scheme` controls the system preference for dark or light
appearance. GTK applications in a Wayland session receive desktop-wide
settings through the settings portal. The GTK template serves a different
purpose: it passes palette colors through CSS. Color-scheme synchronization
does not create the palette, and the template does not replace the system
dark/light preference.

`settings.ini` is not required to pass the Noctalia palette. GTK uses the
platform API for desktop settings and reads values from `settings.ini` as
defaults when that mechanism is unavailable. Do not add
`gtk-application-prefer-dark-theme=1` as a required part of the integration:
this GTK4 property has been deprecated since GTK 4.20. Check an existing
`settings.ini` only when a specific GTK preference does not behave as expected.

## If the palette is not applied

First close the GTK4 application completely and reopen it. Then inspect the
user files:

```bash
config_home="${XDG_CONFIG_HOME:-$HOME/.config}"

for gtk_version in gtk-3.0 gtk-4.0; do
  gtk_dir="$config_home/$gtk_version"
  printf '\n%s\n' "$gtk_dir"
  ls -la "$gtk_dir"
  sed -n '1,40p' "$gtk_dir/gtk.css"
  head -20 "$gtk_dir/noctalia.css"
  readlink "$gtk_dir/gtk.css" || true
  readlink -f "$gtk_dir/gtk.css" || true
done
```

Check that both `noctalia.css` files exist and each `gtk.css` imports the file
from its own directory. If either `gtk.css` is a symlink to an old theme or
contains unrelated imports, first record its current target and contents and
compare them with the output from Noctalia's built-in templates. Do not replace
the file or add an import to `/usr/share/themes/...` without checking first.

Repair a system theme only after checking file ownership and package integrity.
If the check confirms damaged package-managed CSS, restore the package through
the normal package-manager workflow. Do not remove theme files by hand without
a confirmed reason and exact path.

If you use `nwg-look`, check whether it is forcing a separate GTK4 theme: that
choice can prevent the Noctalia palette from applying. For Flatpak apps, check
whether the GTK theme and files are available inside the sandbox; `ldd` on a
host application does not apply there.

## GTK4 and libadwaita

GTK loads the user `gtk.css` stylesheet at
`GTK_STYLE_PROVIDER_PRIORITY_USER`, above application CSS. That priority does
not guarantee the same result in every application. libadwaita manages light
and dark appearance separately and provides CSS variables; applications can
also use their own CSS classes and styles. A selector may therefore work in a
regular GTK4 application but have a different effect in an application built
with libadwaita. Check selectors in the specific application and do not expect
universal visual consistency.

If a particular GTK4 widget still does not use the expected color after
inspection, add a narrow local rule to the user
`$XDG_CONFIG_HOME/gtk-4.0/gtk.css` after the Noctalia import and check it in
that application. Such selectors are optional local customization, not part
of the required template configuration. Do not add them to the generated
`noctalia.css`.

## Diagnostics

```bash
# GTK4 version
pkg-config --modversion gtk4

# Libraries used by a native, dynamically linked application
ldd /path/to/native-application | grep -E 'libgtk-4|libadwaita'

# GTK Inspector and GTK messages
GTK_DEBUG=interactive application-name

# Launch from a terminal to see CSS parsing warnings
application-name

# Temporarily check theme resolution for one launch
GTK_THEME=adw-gtk3-dark application-name
```

`ldd` is not suitable for Flatpak, statically linked applications, or some
wrapper commands. Use `GTK_DEBUG` and `GTK_THEME` only to diagnose a single
launch, not as persistent configuration.

## Verify the result

- **GTK 3** and **GTK 4** are enabled in Noctalia's **Settings → Templates**.
- `noctalia.css` exists in `$XDG_CONFIG_HOME/gtk-3.0/` and
  `$XDG_CONFIG_HOME/gtk-4.0/`; if `XDG_CONFIG_HOME` is unset, use
  `~/.config/gtk-3.0/` and `~/.config/gtk-4.0/`.
- Both `gtk.css` files import the `noctalia.css` from their own directory.
- After restarting, the GTK4 application reports no CSS parsing errors.
- After changing the palette in Noctalia, the application shows the updated color.
- If local selectors were added, they affect only the intended widgets.

For visual acceptance, check the target application after restarting it;
inspecting files alone does not confirm the appearance.

## Related material

- [ASUS B5402 environment](../../systems/asus-b5402/desktop/environment/) — local
  reference-system state.
- [Noctalia](../../desktop/noctalia-shell/) — shell installation and configuration.
- [Wayland portals](../../desktop/wayland-portals/) — desktop-wide settings and portals.
- [Noctalia GTK and Qt templates](https://docs.noctalia.dev/noctalia/templates/official/gtk-qt/)
- [Noctalia themes and palettes](https://docs.noctalia.dev/noctalia/theming/)
- Noctalia source: [GTK template definitions](https://github.com/noctalia-dev/noctalia/blob/main/assets/templates/builtin.toml), [TemplateApplyService](https://github.com/noctalia-dev/noctalia/blob/main/src/theme/template_apply_service.cpp), and [shared apply hook](https://github.com/noctalia-dev/noctalia/blob/main/assets/templates/gtk/apply.sh)
- GTK [`GtkCssProvider`](https://docs.gtk.org/gtk4/class.CssProvider.html) and
  [user CSS priority](https://docs.gtk.org/gtk4/const.STYLE_PROVIDER_PRIORITY_USER.html)
- GTK [`GtkSettings`](https://docs.gtk.org/gtk4/class.Settings.html) and
  [application debugging](https://docs.gtk.org/gtk4/running.html)
- [libadwaita Styles & Appearance](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/styles-and-appearance.html)
