---
title: XDG Desktop Portals
kind: guide
scope: general
status: current
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

Порталы — прослойка между приложениями и рабочим столом: захват экрана,
скриншоты, выбор файлов, уведомления, настройки внешнего вида. Главный вопрос
здесь: какие portal-бэкенды нужны Niri и кто за что отвечает.

```text
xdg-desktop-portal       = frontend, с ним работают приложения
xdg-desktop-portal-gtk   = common/fallback desktop portals
xdg-desktop-portal-gnome = Niri screencast path; может обслуживать screenshot
oo7-portal или gnome-keyring = Secret portal, если он нужен приложениям
```

Выбранная на эталонной системе ASUS B5402 связка записана в
[системном разделе](../../systems/asus-b5402/desktop/environment/).

## Required components

- `sys-apps/xdg-desktop-portal` — frontend: D-Bus-сервис, с которым работают
  приложения; по конфигурации выбирает бэкенды.
- `sys-apps/xdg-desktop-portal-gtk` — common/fallback portal backend.
- `sys-apps/xdg-desktop-portal-gnome` — backend для screencasting: Niri
  реализует mutter ScreenCast D-Bus API, и этот путь обслуживает
  GNOME-бэкенд.
- `oo7-portal` или `gnome-keyring` — Secret portal для приложений, которым он
  нужен.

`gui-libs/xdg-desktop-portal-wlr` для Niri не нужен: это бэкенд для
композиторов на wlr-протоколах (wlr-screencopy), а Niri использует
mutter-совместимый путь через GNOME-бэкенд.

## Upstream Niri baseline

Кто какой интерфейс обслуживает, задаётся в `portals.conf`. Niri поставляет
свой baseline `niri-portals.conf`:

```ini
[preferred]
default=gnome;gtk;
org.freedesktop.impl.portal.Access=gtk;
org.freedesktop.impl.portal.Notification=gtk;
org.freedesktop.impl.portal.Secret=oo7-portal;gnome-keyring;
```

Отдельные строки важны: Notification и Secret — самостоятельные portal
interfaces, а `Settings` отвечает за desktop/UI settings, например цветовую
схему. `Settings` не маршрутизирует звук и не является Notification portal.

Если используется upstream baseline с `xdg-desktop-portal-gnome`, для file
chooser может понадобиться Nautilus. Если не хочется зависеть от GNOME/Nautilus
file chooser, можно явно направить FileChooser в GTK-бэкенд.

## Local overrides

Локальная конфигурация может быть проще upstream baseline, если установленный
набор backend'ов и нужные приложения это покрывают. Имя файла выбирается по
`XDG_CURRENT_DESKTOP`: для Niri это `niri`, поэтому пользовательский файл
обычно называется `~/.config/xdg-desktop-portal/niri-portals.conf`.

На ASUS B5402 допустим и сейчас используется такой override:

```ini
[preferred]
default=gtk
org.freedesktop.impl.portal.Screenshot=gnome
org.freedesktop.impl.portal.ScreenCast=gnome
org.freedesktop.impl.portal.FileChooser=gtk
org.freedesktop.impl.portal.AppChooser=gtk
org.freedesktop.impl.portal.Settings=gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

- `default=gtk` — запасной вариант для интерфейсов, не перечисленных выше.
- `ScreenCast`/`Screenshot` идут через GNOME-бэкенд.
- `Settings` — портал настроек рабочего стола (тёмная тема, цветовая схема
  и т.п.), который приложения читают; он не является маршрутизатором звука
  или уведомлений.
- `FileChooser=gtk` особенно уместен, если пользователь не хочет зависеть от
  GNOME/Nautilus file chooser.
- На ASUS B5402 уже используется `gnome-keyring` как Secret portal backend.
  `oo7-portal` — современная альтернатива; одновременно мигрировать эту машину
  на него в рамках текущего audit не требуется.
- Notifications обслуживаются отдельным interface
  `org.freedesktop.impl.portal.Notification`.

## Session integration

При запуске через [`niri-session`](../niri/) вручную ничего делать не нужно:
session environment (`WAYLAND_DISPLAY`, `XDG_CURRENT_DESKTOP` и остальные)
уже импортирован в systemd user manager и D-Bus activation environment, и
порталы, запущенные systemd/D-Bus, видят сессию.

Ручной `dbus-update-activation-environment` — не часть нормального пути
запуска через `niri-session`; он нужен только при нестандартном способе
запуска (см. Troubleshooting).

## Verification

Проверки read-only, сервисы перезапускать не нужно.

```bash
# Сессия представилась как niri — по этому имени выбран niri-portals.conf
echo "$XDG_CURRENT_DESKTOP"

# Frontend и бэкенды запущены как user-сервисы
systemctl --user status xdg-desktop-portal.service \
                      xdg-desktop-portal-gtk.service \
                      xdg-desktop-portal-gnome.service
```

Практическая проверка screencast: открыть выбор источника захвата в браузере
или OBS — в списке должны быть отдельные окна Niri.

## Troubleshooting

- Порталы не видят сессию (пустой список экранов, порталы падают) при
  нестандартном запуске Niri без `niri-session` (например, голый `niri` из
  tty): импортируйте окружение вручную и перезапустите frontend:

  ```bash
  dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
  systemctl --user restart xdg-desktop-portal.service
  ```

- Изменённый `niri-portals.conf` применяется после перезапуска порталов или
  перелогина.

## Related docs

- [Niri](../niri/) — запуск сессии.
- [Рабочее окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/)
  — фактическое состояние.

## References

- [Niri: `resources/niri-portals.conf`](https://github.com/niri-wm/niri/blob/main/resources/niri-portals.conf) —
  upstream routing baseline.
- [Niri: Important Software](https://github.com/niri-wm/niri/blob/main/docs/wiki/Important-Software.md) —
  нужные portal backends и примечание про `FileChooser=gtk`.
- [XDG Desktop Portal: `portals.conf`](https://flatpak.github.io/xdg-desktop-portal/docs/portals.conf.html) —
  выбор backend для отдельных portal interfaces.
