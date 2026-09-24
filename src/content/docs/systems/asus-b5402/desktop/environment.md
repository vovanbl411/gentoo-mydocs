---
title: Рабочее окружение ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

## Current state

- Desktop: Niri, native Wayland-сессия.
- `XDG_SESSION_TYPE=wayland`.
- `XDG_CURRENT_DESKTOP=niri`.
- Niri version: `niri 26.04 (8ed0da4)`.
- Session: greetd + tuigreet.
- Shell: Noctalia.
- Portals: GTK → FileChooser/AppChooser/Settings; GNOME → ScreenCast/Screenshot.
- WLR portal: не установлен.
- GTK theme: палитра Noctalia в `~/.config/gtk-4.0/`.
- Polkit agent: ровно один процесс
  `polkit-gnome-authentication-agent-1`; конфликт дублирующихся агентов
  устранён.

Сессия, systemd user targets, portals и polkit-агент сверены с живой системой
2026-09-23. GTK theme в этом аудите заново не проверялась.

Активные user units:

- `niri.service`;
- `graphical-session.target`;
- `xdg-desktop-autostart.target`.

## Portals

Для порталов выбраны GTK и GNOME (проверено 2026-09-23):

- GTK обслуживает FileChooser, AppChooser и Settings.
- GNOME (`sys-apps/xdg-desktop-portal-gnome`, поверх реализованного в Niri
  mutter ScreenCast D-Bus API) — ScreenCast и Screenshot.
- WLR-портал не установлен.

Установлены и запущены:

- `xdg-desktop-portal-1.20.4-r1`;
- `xdg-desktop-portal-gnome-49.0`;
- `xdg-desktop-portal-gtk-1.15.3`.

Файл: `~/.config/xdg-desktop-portal/niri-portals.conf`

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

На ASUS B5402 `gnome-keyring` выбран как Secret portal backend. Это
осознанный local override для Niri. Наличие backend и запись в конфигурации
подтверждены, но runtime-вызов Secret portal отдельно не проверялся.

## GTK

- `~/.config/gtk-4.0/noctalia.css` — палитра Noctalia; импортируется в
  пользовательскую GTK4-конфигурацию.
- `~/.config/gtk-4.0/settings.ini` — предпочтение тёмной темы.

Содержимое этих файлов в audit 2026-09-23 не перепроверялось.

## Polkit authentication agent

В текущей сессии работает ровно один процесс
`/usr/libexec/polkit-gnome-authentication-agent-1` (проверено 2026-09-23);
конфликт дублирующихся агентов устранён. Цель — ровно один agent на
пользовательскую сессию.

Точный источник запуска работающего процесса по имеющимся данным не установлен.
Ожидаемый проектный путь — системный XDG autostart
(`/etc/xdg/autostart/polkit-gnome-authentication-agent-1.desktop`), который
Niri как systemd session поднимает через `xdg-desktop-autostart.target`, но это
не доказывает источник текущего процесса.

- Ручной spawn из конфигурации Niri убран: строка
  `spawn-sh-at-startup "/usr/libexec/polkit-gnome-authentication-agent-1 &"`
  закомментирована в `~/.config/niri/autostart.kdl`.
- Юнит `app-polkit-gnome-authentication-agent-1@autostart.service` в текущей
  user manager-сессии не существует (`systemctl --user status` — «could not be
  found»), поэтому прежний критерий проверки «юнит становится active» больше
  не используется и каноническим не является.
- Сообщения polkitd (`sys-auth/polkit-126-r3`) об отсутствии
  `/run/polkit-1/rules.d` и `/usr/local/share/polkit-1/rules.d` — benign
  startup-сообщения при полностью рабочем polkit; создавать пустые каталоги
  ради чистого журнала не нужно.

### Investigation notes (2026-09-21/22/23)

- 2026-09-21: дублирующий ручной запуск закомментирован. Причина: upstream
  polkit допускает только один authentication agent на subject, второй
  экземпляр завершался ошибкой регистрации (`An authentication agent already
  exists for the given subject`).
- 2026-09-22: расследование сессии от 2026-09-21 22:48 показало, что рабочий
  агент порождал не ручной spawn, а цепочка из niri: агент жил в cgroup
  `niri.service` с её `INVOCATION_ID`, после чего autostart-юнит падал с той
  же ошибкой регистрации. Этот spawn в конфиге niri закомментирован владельцем
  2026-09-22.
- Runtime-проверка 2026-09-23 закрыта в части «ровно один агент» (см. выше);
  статус XDG-generated-юнита и источник запуска работающего процесса по
  имеющимся данным не устанавливаются.

Источники: [polkit — polkitbackendinteractiveauthority.c](https://gitlab.freedesktop.org/polkit/polkit/-/blob/master/src/polkitbackend/polkitbackendinteractiveauthority.c),
[Niri wiki — Integrating niri](https://github.com/YaLTeR/niri/wiki/Integrating-niri).

## Общие руководства

- [Niri](../../../../desktop/niri/)
- [XDG Desktop Portals](../../../../desktop/wayland-portals/)
- [GTK4 и палитра Noctalia](../../../../settings/gtk/)
