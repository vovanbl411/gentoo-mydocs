---
title: Рабочее окружение ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

## Current state

Umbriel — основной Wayland-композитор: он управляет окнами и выводом
рабочего стола. Вход выполняется через greetd с текстовым экраном tuigreet,
который настроен запускать `umbriel`. Umbriel запускает оболочку Noctalia по
настройке `autostart` в `~/.config/umbriel/core.toml`. Niri сохранён как
запасная сессия.

Композитор `gui-wm/umbriel` и его портал
`gui-libs/xdg-desktop-portal-umbriel` установлены из
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay). Их версии
подбираются вместе: при обновлении выбирай обе версии из одной строки
[таблицы принятых пар](https://github.com/vovanbl411/umbriel-overlay#принятая-пара-и-откат).
Источник таблицы — [accepted-pairs.json](https://github.com/vovanbl411/umbriel-overlay/blob/main/automation/accepted-pairs.json).

## Portals Umbriel

Порталы позволяют приложениям обращаться к возможностям рабочего стола,
например к выбору файлов или захвату экрана. В конфигурации Umbriel сначала
выбирается его собственный обработчик, затем GTK; для доступа к секретам
указан `gnome-keyring`.

Файл: `~/.config/xdg-desktop-portal/umbriel-portals.conf`

```ini
[preferred]
default=umbriel;gtk
org.freedesktop.impl.portal.Secret=gnome-keyring
```

Работа каждого интерфейса портала в Umbriel отдельно не проверялась.

## ASUS NumberPad

Драйвер включает цифровую клавиатуру на тачпаде. Для устройства
`ASUE1410:01 04F3:3230` используется раскладка `b7402` и пакет
`sys-apps/asus-numberpad-driver::asus-numberpad-overlay`.

Файл `~/.config/asus-numberpad-driver/service.conf` задаёт раскладку и каталог
`~/.config/asus-numberpad-driver/`, где хранится `numberpad_dev`. Его читает
пользовательский сервис `/usr/lib/systemd/user/asus-numberpad-driver.service`.
Установка пакета не запускает сервис автоматически. После передачи окружения
Wayland пользовательскому менеджеру systemd сервис можно запустить или остановить:

```bash
systemctl --user start asus-numberpad-driver.service
systemctl --user stop asus-numberpad-driver.service
```

Порядок передачи окружения и настройки запуска при входе описан в
[README overlay](https://github.com/vovanbl411/asus-numberpad-overlay). Способ
автозапуска и остановки в текущей сессии не проверен.

Драйвер читает события тачпада и клавиатуры через input-устройства, создаёт
виртуальную клавиатуру через `/dev/uinput` и управляет тачпадом через hidraw.
Если hidraw недоступен, запасной доступ через I²C открывает всю шину.
Локальное правило `/etc/udev/rules.d/99-asus-numberpad-local.rules` назначает
владельца и права `0600` для hidraw этого тачпада и `/dev/uinput`; права на
input-устройства отдельно не проверены. Доступ к input позволяет читать
нажатия, а к uinput — вводить их, поэтому предоставляй только необходимые
права доверенному пользователю. Подготовка доступа описана в README overlay.

## Fingerprint login and GNOME Keyring

При входе по отпечатку через greetd пароль пользователя не передаётся GNOME
Keyring, поэтому login keyring автоматически не разблокируется. При первом
запросе `gcr-prompter` показывает `Unlock Keyring`; keyring разблокируется
отдельным паролем. Такое поведение принято, PAM stack оставлен без изменений.

## GTK

- `~/.config/gtk-4.0/noctalia.css` — палитра Noctalia; импортируется в
  пользовательскую GTK4-конфигурацию.
- `~/.config/gtk-4.0/settings.ini` — предпочтение тёмной темы.

Содержимое этих файлов в audit 2026-09-23 не перепроверялось.

## Niri fallback

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
- Fingerprint: Noctalia lockscreen, greetd login и polkit authentication
  проверены 2026-09-27. Парольный fallback polkit проверен; fallback greetd
  отдельно не проверялся.
- Вход через greetd по отпечатку не передаёт пароль пользователя GNOME Keyring;
  login keyring автоматически не разблокируется.

Сессия, systemd user targets, portals и polkit-агент сверены с живой системой
2026-09-23. GTK theme в этом аудите заново не проверялась.

В проверенной сессии были активны user units:

- `niri.service`;
- `graphical-session.target`;
- `xdg-desktop-autostart.target`.

### Portals Niri

Для порталов выбраны GTK и GNOME (проверено 2026-09-23):

- GTK обслуживает FileChooser, AppChooser и Settings.
- GNOME (`sys-apps/xdg-desktop-portal-gnome`, поверх реализованного в Niri
  mutter ScreenCast D-Bus API) — ScreenCast и Screenshot.
- WLR-портал не установлен.

В проверенной сессии были установлены и запущены:

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

## Polkit authentication agent

В проверенной сессии Niri работал ровно один процесс
`/usr/libexec/polkit-gnome-authentication-agent-1` (проверено 2026-09-23);
конфликт дублирующихся агентов устранён. Цель — ровно один agent на
пользовательскую сессию.

Точный источник запуска работающего процесса по имеющимся данным не установлен.
Ожидаемый проектный путь — системный XDG autostart
(`/etc/xdg/autostart/polkit-gnome-authentication-agent-1.desktop`), который
Niri как systemd session поднимает через `xdg-desktop-autostart.target`, но это
не доказывал источник этого процесса.

- Ручной spawn из конфигурации Niri убран: строка
  `spawn-sh-at-startup "/usr/libexec/polkit-gnome-authentication-agent-1 &"`
  закомментирована в `~/.config/niri/autostart.kdl`.
- Юнит `app-polkit-gnome-authentication-agent-1@autostart.service` в проверенной
  user manager-сессии не существовал (`systemctl --user status` — «could not be
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

## Verification

Настройки Umbriel и NumberPad и источники пакетов проверены 2026-10-30.
Установленная пара Umbriel не сверялась с таблицей принятых пар; работа
пользовательских сервисов и polkit в Umbriel не проверена. Наблюдения для
Niri относятся к указанным датам и не подтверждают состояние Umbriel.

## Общие руководства

- [Niri](../../../../desktop/niri/)
- [XDG Desktop Portals](../../../../desktop/wayland-portals/)
- [GTK4 и палитра Noctalia](../../../../settings/gtk/)
- [ELAN fingerprint на ASUS B5402](../../hardware/fingerprint/)
