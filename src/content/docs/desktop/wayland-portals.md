---
title: XDG Desktop Portals
kind: guide
scope: general
status: current
last_verified: "2026-09-23"
verified_on: [asus-b5402]
---

Порталы дают приложениям доступ к возможностям рабочего стола: выбору
файлов, демонстрации экрана, скриншотам и настройкам внешнего вида.
Приложение обращается к `xdg-desktop-portal`, а тот передаёт запрос
подходящему обработчику — backend. Backend выбирается для каждого интерфейса.

Для Umbriel и Niri нужны разные backend захвата экрана. Выбери раздел
своего композитора; GTK можно использовать для общих диалогов в обеих сессиях.

## Umbriel

Нужны пакеты:

- `sys-apps/xdg-desktop-portal` — принимает запросы приложений;
- `gui-libs/xdg-desktop-portal-umbriel` — интеграция с композитором Umbriel;
- `sys-apps/xdg-desktop-portal-gtk` — общие диалоги и запасной обработчик.

Портал Umbriel устанавливается вместе с композитором по
[руководству Umbriel](../umbriel/). Для демонстрации экрана включи
`screencast` у композитора и `picker` у портала, если нужен графический выбор
источника захвата.

Файл: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

`default=umbriel;gtk` задаёт порядок выбора: сначала backend Umbriel,
затем GTK для интерфейсов, которых у первого нет. Строка `Secret` выбирает
GNOME Keyring для запросов секрета через портал; для неё нужен установленный
backend `gnome-keyring`.

## Niri

Niri предоставляет совместимый с Mutter интерфейс захвата экрана, который
обслуживает `sys-apps/xdg-desktop-portal-gnome`. Для общих диалогов используется
`sys-apps/xdg-desktop-portal-gtk`.

`gui-libs/xdg-desktop-portal-wlr` для этой связки не нужен: его протокол
захвата экрана отличается от используемого Niri.

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

Здесь GNOME отвечает за захват экрана и скриншоты, GTK — за выбор файлов,
приложений и настройки внешнего вида, GNOME Keyring — за Secret portal.

В поставляемой Niri конфигурации порядок по умолчанию — `gnome;gtk`.
Явный `FileChooser=gtk` позволяет использовать GTK-диалог без зависимости
от GNOME/Nautilus file chooser. Для Secret portal Niri также допускает
`oo7-portal`; переходить на него ради остальных порталов не требуется.

## Как выбирается конфигурация

Имя файла зависит от `XDG_CURRENT_DESKTOP`: для `umbriel` выбирается
`umbriel-portals.conf`, для `niri` — `niri-portals.conf`. Оба файла можно
сохранить, если используешь обе сессии.

Запускай Niri через `niri-session`, а Umbriel — через его обычный запуск
из greetd. Приложения и пользовательские службы должны получать окружение
текущей сессии, включая `WAYLAND_DISPLAY` и `XDG_CURRENT_DESKTOP`.

После изменения `portals.conf` выйди из рабочего стола и войди снова.
Это позволяет запустить порталы с новой конфигурацией и окружением.

## Проверка

В терминале внутри нужной сессии:

```bash
echo "$XDG_CURRENT_DESKTOP"
systemctl --user status xdg-desktop-portal.service \
                       xdg-desktop-portal-gtk.service
```

Имя рабочего стола должно соответствовать выбранному файлу. После открытия
диалога приложения frontend и используемые backend должны запускаться без ошибок.
Сервисы могут активироваться по запросу, поэтому сначала вызови нужный диалог.

Для Umbriel проверь его backend:

```bash
systemctl --user status xdg-desktop-portal-umbriel.service
```

Для Niri проверь GNOME backend:

```bash
systemctl --user status xdg-desktop-portal-gnome.service
```

Затем открой выбор файла и попробуй поделиться экраном из браузера или OBS.
Убедись, что выбранный экран или окно действительно видны получателю.

## Если диалог пустой или демонстрация экрана не работает

Сначала сравни окружение терминала с окружением пользовательских служб:

```bash
systemctl --user show-environment
journalctl --user -b -u xdg-desktop-portal.service
```

Если службы получили окружение другой сессии или не получили его вообще,
проверь способ запуска композитора. Для нестандартного ручного запуска
можно передать текущие значения и перезапустить frontend:

```bash
dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
systemctl --user restart xdg-desktop-portal.service
```

Перезапуск прерывает активные обращения к порталу; сначала заверши
демонстрацию экрана. При обычном входе это не должно быть ежедневным шагом.

`Settings` в portal-конфигурации отвечает за внешний вид, например тёмную
тему. Он не управляет звуком. Выбор Notification backend также не выбирает
обычный обработчик уведомлений — см. [уведомления](../notifications/).

## Связанные материалы

- [Umbriel](../umbriel/)
- [Niri](../niri/)
- [Рабочее окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/)
- [portals.conf](https://flatpak.github.io/xdg-desktop-portal/docs/portals.conf.html)
- [Конфигурация порталов Niri](https://github.com/niri-wm/niri/blob/main/resources/niri-portals.conf)
