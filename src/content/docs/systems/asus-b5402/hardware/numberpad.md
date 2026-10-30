---
title: ASUS NumberPad — цифровая клавиатура на тачпаде
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Текущее состояние

На ASUS B5402 драйвер `sys-apps/asus-numberpad-driver` из
[asus-numberpad-overlay](https://github.com/vovanbl411/asus-numberpad-overlay)
использует NumberPad на тачпаде `ASUE1410:01 04F3:3230` с раскладкой `b7402`.
Драйвер работает как пользовательский systemd-сервис и подключается к
Wayland-сессии Umbriel. Сервис запускается вручную; автозапуска из Umbriel нет.

При запуске драйвер обнаруживает встроенную клавиатуру, тачпад и его hidraw-
устройство. Для обмена с тачпадом используется hidraw; резервный доступ через
I²C в текущей настройке не задействован. Номера `eventN` и `hidrawN` могут
меняться.

## Конфигурация

Файл: `~/.config/asus-numberpad-driver/service.conf`

Пользовательский unit читает из него параметры раскладки и каталога настроек:

```ini
NUMBERPAD_LAYOUT=b7402
NUMBERPAD_CONFIG_DIR=<absolute-home>/.config/asus-numberpad-driver/
```

В `NUMBERPAD_CONFIG_DIR` указывается абсолютный путь к домашнему каталогу:
`<absolute-home>` — placeholder, его нужно заменить реальным путём. Сервис не
раскрывает `~` или `$HOME` в значении переменной; путь заканчивается `/`.

## Доступ к устройствам

Локальное правило назначает владельца только для hidraw тачпада и `/dev/uinput`.
В правиле вместо `<user>` указывается пользователь, запускающий сервис.

Файл: `/etc/udev/rules.d/99-asus-numberpad-local.rules`

```text
SUBSYSTEM=="hidraw", KERNELS=="0018:04F3:3230.*", OWNER="<user>", MODE="0600"
SUBSYSTEM=="misc", KERNEL=="uinput", OWNER="<user>", MODE="0600"
```

Доступ к событиям клавиатуры и тачпада предоставляется через группу `input`.
Её права распространяются и на другие устройства ввода, поэтому можно читать
события устройств, не связанных с NumberPad.

> ⚠️ **Важный нюанс**: членство в `input` даёт более широкий доступ к событиям
> устройств ввода, чем требуется для одного NumberPad.

## Запуск в Umbriel

В терминале активной Umbriel-сессии запускай сервис вручную:

```bash
systemctl --user start asus-numberpad-driver.service
```

Юнит статический: у него нет секции `[Install]`, поэтому `systemctl enable` для
него не используется. При запуске сервис обнаруживает Wayland-сессию через
окружение пользовательского systemd. Для ручной остановки:

```bash
systemctl --user stop asus-numberpad-driver.service
```

## Проверка

Проверь состояние сервиса и его журнал:

```bash
systemctl --user status asus-numberpad-driver.service
journalctl --user -b -u asus-numberpad-driver.service --no-pager
```

В журнале не должно быть ошибок доступа или конфигурации. После запуска вручную
проверь NumberPad на тачпаде: нажатия в цифровой области должны вводить
соответствующие цифры. Состояние сервиса само по себе не подтверждает работу
физического ввода.

## Устранение проблем

- **`Permission denied`** — проверь права именно того узла, который указан в
  журнале, и соответствующее правило udev. Не открывай доступ ко всем input
  или hidraw-устройствам.
- **Сервис не видит Wayland** — проверь окружение пользовательского systemd.
  Из Umbriel импортируй переменные текущей сессии и перезапусти сервис:

  ```bash
  systemctl --user import-environment WAYLAND_DISPLAY XDG_RUNTIME_DIR XDG_SESSION_TYPE DBUS_SESSION_BUS_ADDRESS
  systemctl --user restart asus-numberpad-driver.service
  ```

- **Неверная раскладка** — проверь `NUMBERPAD_LAYOUT` в
  `service.conf`; для этого тачпада используется `b7402`.
- **hidraw недоступен** — проверь, что udev-правило совпадает с родительским
  HID-устройством тачпада. Не добавляй доступ к I²C, пока не выяснена причина.

## Связанные материалы

- [Рабочее окружение ASUS B5402](../../desktop/environment/)
- [asus-numberpad-overlay](https://github.com/vovanbl411/asus-numberpad-overlay) —
  установка пакета, поддерживаемые версии Python и сведения о сборке.
