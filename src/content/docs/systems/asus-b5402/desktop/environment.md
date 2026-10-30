---
title: Рабочее окружение ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

## Рабочий стол

Основной композитор — Umbriel, оболочка — Noctalia. Вход выполняется через
greetd и текстовый экран tuigreet. Niri оставлен как запасная сессия.

Композитор и `xdg-desktop-portal-umbriel` установлены из
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay).
Полная последовательность установки, примеры конфигурации и возврат к Niri —
в [руководстве Umbriel](../../../../desktop/umbriel/).

В `/etc/greetd/config.toml` команда входа выглядит так:

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd umbriel"
user = "greetd"
```

Noctalia запускается из секции `[general]` в `~/.config/umbriel/core.toml`:

```toml
[general]
autostart = ["noctalia"]
```

Этот фрагмент показывает запуск оболочки. При добавлении других программ
расширяй существующий массив, сохраняя остальные команды. В разделённой
конфигурации `core.toml` должен быть включён из главного `config.toml`.

## Порталы

Для Umbriel используется `~/.config/xdg-desktop-portal/umbriel-portals.conf`:

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

Сначала выбирается backend Umbriel, затем GTK для остальных интерфейсов.
Для Secret portal используется GNOME Keyring.
[Назначение backend и проверка диалогов](../../../../desktop/wayland-portals/).

## Цифровая клавиатура на тачпаде

ASUS NumberPad работает через `sys-apps/asus-numberpad-driver` из
`asus-numberpad-overlay`. Для тачпада `ASUE1410:01 04F3:3230` выбрана
раскладка `b7402`.

[Настройка драйвера, доступа к устройствам и запуск](../../hardware/numberpad/).

## Вход по отпечатку и GNOME Keyring

При входе по отпечатку greetd не получает пароль пользователя. Поэтому он
не может автоматически разблокировать GNOME Keyring. При первом обращении
к хранилищу `gcr-prompter` показывает `Unlock Keyring`; введи пароль хранилища.
Менять PAM ради устранения этого запроса не требуется.

## GTK и палитра Noctalia

- `~/.config/gtk-4.0/noctalia.css` содержит палитру Noctalia.
  Чтобы применять её к GTK4-приложениям, файл импортируется из `gtk.css`.
- `~/.config/gtk-4.0/settings.ini` задаёт предпочтение тёмной темы.

[Пример настройки GTK](../../../../settings/gtk/).

## Запасная сессия Niri

Конфигурация Niri сохранена в `~/.config/niri/`. Для входа в неё укажи
`niri-session` вместо `umbriel` в команде tuigreet, выйди и войди снова.
Пример и способ возврата — в [руководстве Umbriel](../../../../desktop/umbriel/#возврат-к-niri).

В Niri используются GTK для общих диалогов и GNOME для захвата экрана.
Сохрани `~/.config/xdg-desktop-portal/niri-portals.conf` вместе с
конфигурацией Niri: пример приведён в [руководстве по порталам](../../../../desktop/wayland-portals/#niri).
Настройки Umbriel не заменяют конфигурацию запасной сессии.

## Polkit: один агент на сессию

Polkit-агент показывает окно подтверждения привилегированного действия.
Два экземпляра не могут обслуживать одну пользовательскую сессию. Если
возникает `An authentication agent already exists for the given subject`,
проверь, не запускается ли агент одновременно через автозапуск рабочего
стола и вручную из конфигурации композитора.

В конфигурации Niri ручной запуск
`/usr/libexec/polkit-gnome-authentication-agent-1` закомментирован в
`~/.config/niri/autostart.kdl`: XDG-autostart может запускать его самостоятельно.
При переходе между композиторами проверь процесс, а не только имя юнита:

```bash
pgrep -af '[p]olkit-gnome-authentication-agent-1'
```

Для этого агента ожидается один процесс. Имя автоматически созданного
systemd-юнита не является обязательным условием работы. Запросить
подтверждение в приложении — практический способ убедиться, что окно появляется.

Сообщения polkitd об отсутствии `/run/polkit-1/rules.d` и
`/usr/local/share/polkit-1/rules.d` сами по себе не требуют исправления:
это дополнительные каталоги правил. Создавать их пустыми ради журнала не нужно.

## Связанные материалы

- [Установка Umbriel](../../../../desktop/umbriel/)
- [Noctalia на ноутбуке](../noctalia/)
- [Уведомления](../../../../desktop/notifications/)
- [Вход по отпечатку](../../hardware/fingerprint/)
