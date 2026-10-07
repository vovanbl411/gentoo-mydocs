---
title: Уведомления рабочего стола
kind: guide
scope: general
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

Этот guide помогает проверить доставку desktop notifications в Wayland-сессии:
от приложения через клиентскую библиотеку и D-Bus до оболочки. Команды
выполняются от обычного пользователя в активной desktop-сессии; нужны
`gdbus` и, для теста libnotify, `notify-send`.

Дата 2026-10-07 относится к явно обозначенным ниже результатам ASUS B5402,
предоставленным пользователем. Финальная проверка Portage migration пока
не подтверждена.

## 1. Desktop notification stack

Для приложений, использующих libnotify, путь к Noctalia выглядит так:

```text
application
    ↓
libnotify
    ↓
org.freedesktop.Notifications
    ↓
Noctalia
```

Приложение решает, когда отправлять уведомление; библиотека передаёт запрос;
notification daemon показывает его. Звук приложения сам по себе не доказывает,
что визуальное уведомление дошло до daemon. Другие приложения могут обращаться
к D-Bus напрямую или использовать portal API.

## 2. org.freedesktop.Notifications

Обычные Freedesktop desktop notifications используют session D-Bus service
`org.freedesktop.Notifications` и object path `/org/freedesktop/Notifications`.
Метод `Notify` отправляет уведомление, а `GetServerInformation` возвращает
имя сервера, vendor, версию и версию поддерживаемой спецификации.
См. [Desktop Notifications Specification](https://specifications.freedesktop.org/notification/latest/protocol.html).

Это другой интерфейс, чем `org.freedesktop.portal.Notification` и его backend
`org.freedesktop.impl.portal.Notification`. Portal Notification входит в
[XDG Desktop Portal API](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Notification.html).
Настройка Notification backend в `xdg-desktop-portal` не определяет владельца
`org.freedesktop.Notifications`. Выбор portal backend описан в
[Wayland portals](../wayland-portals/).

## 3. Роль notification daemon

Notification daemon обслуживает стандартный notification service. Эту роль
может выполнять оболочка, включая Noctalia; отдельный daemon ей не обязателен.
Проверяй, кто реально обслуживает D-Bus name, и не запускай второй daemon
только ради наличия пакета с названием `notification-daemon`.

Если запрос дошёл, но уведомление скрыто, проверь DND и настройки отображения
у текущего daemon.

## 4. libnotify и приложения

[libnotify](https://gnome.pages.gitlab.gnome.org/libnotify/) — клиентская
библиотека для desktop notifications, а не daemon. В Gentoo это
`x11-libs/libnotify`; префикс категории `x11-libs` сам по себе не означает,
что приложение должно работать через X11.

На ASUS B5402 Thunderbird 157.0 требует libnotify для проверенного system
notification path. Ebuild предлагает его как optional feature, поэтому
наличие Thunderbird не гарантирует наличие библиотеки. Настройки аккаунтов и
диагностика приложения — в [Thunderbird guide](../../settings/thunderbird/).

## 5. Noctalia на reference system

На ASUS ExpertBook B5402 / Gentoo / Niri проверено 2026-10-07:

- Noctalia обслуживает `org.freedesktop.Notifications` и возвращает
  `('noctalia', 'noctalia-dev', '5.2.1', '1.2')`.
- DND выключен; прямое внешнее D-Bus уведомление отображается — PASS.
- После установки libnotify Thunderbird отправляет `Notify`, и Noctalia
  показывает визуальное уведомление — PASS.

Это пример работающего стека, а не требование использовать Noctalia на всех
системах. Подробности машины — в [системной записи Noctalia](../../systems/asus-b5402/desktop/noctalia/).

## 6. Portage integration

Package dependency chain для интеграции с Noctalia:

```text
x11-libs/libnotify
    ↓
virtual/notification-daemon
    ↓
gui-apps/noctalia
```

По проверке 2026-10-07 libnotify имеет
`PDEPEND="virtual/notification-daemon"`, но `virtual/notification-daemon-0::gentoo`
не распознаёт Noctalia как provider. Resolver пытался добавить
`x11-misc/notification-daemon`, `libXcursor`, `gtk+[X]` и `cairo[X]` —
неподходящий fallback для принятой pure-Wayland конфигурации.

В noctalia-overlay подготовлен `virtual/notification-daemon-0-r1`: он
сохраняет upstream semantics и добавляет `gui-apps/noctalia` в fallback
provider OR-group при `-gnome -kde`. Реализация и порядок подключения
сопровождаются в [README noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay/blob/main/README.md).

**Pending migration:** финальный live resolver PASS после удаления temporary
`package.provided` не предоставлен. Local virtual пока не записан как принятая
интеграция эталонной машины. Временная запись в
`/etc/portage/profile/package.provided` — диагностический workaround,
который подменяет удовлетворение dependency; это не рекомендуемое конечное
состояние. После перехода на local virtual она не должна использоваться.

На reference workstation `x11-libs/libnotify` установлен как explicit world
package: текущий Thunderbird ebuild не имеет обязательного `RDEPEND` на него,
а лишь сообщает `optfeature "desktop notifications" x11-libs/libnotify`.

## 7. Verification

Проверь сервер в текущей пользовательской сессии:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

На проверенной ASUS B5402 ожидается tuple из раздела 5. На другой системе имя
и версия могут отличаться. Затем проверь клиентский путь libnotify:

```bash
notify-send "Notification test" "libnotify → desktop daemon"
```

При выключенном DND должно появиться визуальное уведомление. Этот тест
не проверяет policy уведомлений почтовых аккаунтов.

План Portage, без установки пакетов:

```bash
emerge -pv virtual/notification-daemon
emerge -pv --tree x11-libs/libnotify
```

Для принятия local virtual нужны оба resolver output после удаления временной
записи и подтверждение, что `/etc/portage/profile/package.provided` больше
не используется:

- Выбран `virtual/notification-daemon-0-r1::noctalia-overlay`.
- Установленная `gui-apps/noctalia` удовлетворяет provider dependency.
- Не требуются `x11-misc/notification-daemon` и `libXcursor`.
- Нет требований включить `USE=X` для `gtk+` или `cairo`.

## 8. Troubleshooting

Для приложений с обычным Freedesktop notification path можно наблюдать
отправку запроса, затем вызвать тестовое уведомление:

```bash
dbus-monitor --session \
  "interface='org.freedesktop.Notifications',member='Notify'"
```

Если `Notify` не появляется, проверь настройки приложения, его клиентский
backend и runtime libraries. Успешный внешний тест daemon не подтверждает
исправность backend приложения. Если `Notify` виден, но баннера нет, проверь
владельца сервиса, DND и настройки отображения. Для portal-приложений
отсутствие прямого `Notify` от приложения само по себе не доказывает сбой:
проверь выбранный portal path.

## 9. Related docs

- [Noctalia](../noctalia-shell/) — установка и конфигурация оболочки.
- [Wayland portals](../wayland-portals/) — отдельный portal path.
- [Thunderbird](../../settings/thunderbird/) — выбор аккаунтов и mail acceptance.
