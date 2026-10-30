---
title: Рабочее окружение ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Текущее состояние

Рабочий стол ASUS B5402 работает в Wayland-сессии Umbriel
(`XDG_CURRENT_DESKTOP=umbriel`). Оболочка — Noctalia. Для входа используется
greetd с tuigreet. Niri и его конфигурация сохранены как запасной вариант.

## Запуск сессии

Файл: `/etc/greetd/config.toml`

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd umbriel"
user = "greetd"
```

Главный файл `~/.config/umbriel/config.toml` подключает `core.toml`, где
Umbriel запускает Noctalia через `autostart`:

```toml
[general]
autostart = ["noctalia"]
```

Noctalia запускается только через `autostart` Umbriel. Umbriel и его portal
backend установлены из
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay), Noctalia —
из [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay).

## Порталы и GNOME Keyring

Файл: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

Сначала выбирается backend Umbriel. GTK используется как запасной backend для
остальных интерфейсов. Запросы Secret portal направляются в GNOME Keyring.

При успешном входе по отпечатку PAM не запрашивает пароль пользователя.
greetd поэтому не получает пароль для автоматической разблокировки GNOME
Keyring; при обращении к хранилищу может потребоваться ввести пароль Keyring.

## Интеграции рабочего стола

- ASUS NumberPad настроен отдельно и запускается вручную в Umbriel-сессии.
- `~/.config/gtk-4.0/gtk.css` импортирует палитру Noctalia из
  `noctalia.css`; `settings.ini` задаёт предпочтение тёмной темы.

## Запасная сессия Niri

Пакет `gui-wm/niri` установлен; конфигурация Niri (`~/.config/niri/`) и
portal-файл `~/.config/xdg-desktop-portal/niri-portals.conf` сохранены для
возврата к Niri. Текущая конфигурация Niri отдельно не проверялась.

## Polkit

В Umbriel-сессии используется `polkit-gnome-authentication-agent-1`, который
запускается из системной записи XDG Autostart
`/etc/xdg/autostart/polkit-gnome-authentication-agent-1.desktop`. Отдельный
запуск агента в конфигурации Umbriel не задан; ручной запуск в конфигурации
Niri закомментирован.

## Связанные материалы

- [Руководство Umbriel](../../../../desktop/umbriel/)
- [Оболочка Noctalia](../../../../desktop/noctalia-shell/)
- [Порталы Wayland](../../../../desktop/wayland-portals/)
- [Noctalia на ASUS B5402](../noctalia/)
- [Настройка NumberPad](../../hardware/numberpad/)
- [Вход по отпечатку](../../hardware/fingerprint/)
- [Настройка GTK](../../../../settings/gtk/)
