---
title: XDG Desktop Portals
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Как работают порталы

Приложение отправляет запрос через `xdg-desktop-portal`, а тот передаёт его
подходящему обработчику — backend. Для каждого интерфейса, например выбора
файлов или демонстрации экрана, backend выбирается отдельно. В `portals.conf`
параметр `default` задаёт порядок для интерфейсов без отдельной записи;
`org.freedesktop.impl.portal.<Interface>` позволяет выбрать обработчик
конкретного интерфейса.

Значения разделяются точкой с запятой и проверяются по порядку. Например,
`default=umbriel;gtk` означает: для интерфейсов, которые реализует Umbriel,
использовать его backend; для остальных `xdg-desktop-portal` может перейти к
GTK, если GTK реализует этот интерфейс.

## Umbriel

Портал Umbriel устанавливается вместе с композитором по
[руководству Umbriel](../umbriel/); GTK подходит для общих диалогов и может
быть запасным обработчиком. Портал Umbriel реализует `ScreenCast` и
`Screenshot`, а также `InputCapture` версии 2. Он не заменяет обработчики для
всех интерфейсов портала.

Для демонстрации экрана включи USE-флаг `screencast` у композитора. USE-флаг
`picker` у портала добавляет графический выбор экрана или окна; в актуальном
Gentoo ebuild он включён по умолчанию.

Файл: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

Этот пример совпадает с текущей конфигурацией ASUS B5402. Выбор обработчика
Secret portal описан ниже.

## Niri

Для демонстрации экрана в Niri нужны PipeWire и
`sys-apps/xdg-desktop-portal-gnome`. Конфигурация Niri предпочитает GNOME,
затем GTK для интерфейсов без отдельного выбора backend.

Niri поставляет конфигурацию с `default=gnome;gtk;`, GTK для Access и
Notification. В примере ниже сохранены эти значения и добавлено только
переопределение FileChooser на GTK. Оно нужно, если ты не устанавливаешь
Nautilus, который GNOME использует для выбора файлов по умолчанию.

Файл: `~/.config/xdg-desktop-portal/niri-portals.conf`

```ini
[preferred]
default=gnome;gtk;
org.freedesktop.impl.portal.Access=gtk;
org.freedesktop.impl.portal.Notification=gtk;
org.freedesktop.impl.portal.FileChooser=gtk;
org.freedesktop.impl.portal.Secret=oo7-portal;gnome-keyring;
```

Порядок `gnome;gtk` направляет ScreenCast в GNOME portal, необходимый Niri
для демонстрации экрана; GTK остаётся запасным обработчиком. Строка
`FileChooser=gtk` меняет только выбор файлов.

## Secret portal

Secret portal даёт приложениям доступ к хранилищу секретов через выбранный
обработчик. В конфигурации Niri для Secret portal предусмотрены `oo7-portal`
и `gnome-keyring`; их можно оставить в порядке upstream или явно выбрать
установленный вариант. На ASUS B5402 выбран GNOME Keyring — это настройка
конкретной системы, описанная в
[системном разделе](../../systems/asus-b5402/desktop/environment/).

## Как выбирается конфигурация

`xdg-desktop-portal` ищет файл по значению `XDG_CURRENT_DESKTOP`: для `umbriel`
используется `umbriel-portals.conf`, для `niri` — `niri-portals.conf`. Если
переменная содержит несколько имён через `:`, они проверяются по порядку.
Оба файла можно сохранить, если используешь обе сессии.

Запускай Niri через `niri-session`; способ запуска Umbriel для этой системы
описан в [его руководстве](../umbriel/). Службам порталов нужны переменные
текущей графической сессии `WAYLAND_DISPLAY` и `XDG_CURRENT_DESKTOP`.

После изменения `portals.conf` выйди из сессии и войди снова, чтобы службы
порталов запустились с новой конфигурацией.

## Проверка

В терминале внутри нужной сессии:

```bash
echo "$XDG_CURRENT_DESKTOP"
systemctl --user status xdg-desktop-portal.service
```

Имя рабочего стола должно соответствовать нужному файлу. GTK backend может
запускаться по запросу, поэтому сначала открой нужный диалог.

Для Umbriel проверь его backend:

```bash
systemctl --user status xdg-desktop-portal-umbriel.service
```

Для Niri проверь GNOME backend:

```bash
systemctl --user status xdg-desktop-portal-gnome.service
```

Затем открой FileChooser и попробуй поделиться экраном из браузера или OBS.
Проверь у получателя, что передаётся выбранный экран или окно.

## Устранение проблем

### Диалог пустой или демонстрация экрана не работает

Сравни окружение пользовательских служб с окружением сессии и проверь журнал:

```bash
systemctl --user show-environment
journalctl --user -b -u xdg-desktop-portal.service
```

Если службы получили окружение другой сессии или не получили его вообще,
проверь способ запуска композитора. Только при нестандартном ручном запуске
можно импортировать текущие значения в D-Bus и systemd user manager:

```bash
dbus-update-activation-environment --systemd \
  WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
```

Если портал уже запущен со старым окружением, перезапусти основной сервис:

```bash
systemctl --user restart xdg-desktop-portal.service
```

Перезапуск прерывает активные запросы к порталам. Сначала заверши демонстрацию
экрана. При обычном входе вручную импортировать окружение не нужно.

### Уведомления

`org.freedesktop.portal.Notification` — интерфейс портала, а
`org.freedesktop.Notifications` — обычная служба уведомлений рабочего стола.
Выбор Notification backend не запускает Noctalia как обработчик уведомлений;
подробнее — в руководстве [об уведомлениях](../notifications/).

`Settings` управляет настройками приложений, например предпочтением тёмной
темы, но не звуком.

## Связанные материалы

- [Umbriel](../umbriel/)
- [Niri](../niri/)
- [Рабочее окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/)
- [portals.conf](https://flatpak.github.io/xdg-desktop-portal/docs/portals.conf.html)
- [Конфигурация порталов Niri](https://github.com/niri-wm/niri/blob/main/resources/niri-portals.conf)
- [Niri: важные программы](https://github.com/niri-wm/niri/wiki/Important-Software)
- [Niri: демонстрация экрана](https://github.com/niri-wm/niri/wiki/Screencasting)
- [XDG Desktop Portal for Umbriel](https://github.com/noctalia-dev/xdg-desktop-portal-umbriel)
