---
title: "Niri: тайловый композитор со скроллингом"
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Niri — Wayland-композитор, который размещает окна в горизонтальной ленте.
Здесь описаны установка в Gentoo, запуск через systemd и основные настройки.
Записанное состояние ASUS B5402 см. в
[системном разделе](../../systems/asus-b5402/desktop/environment/).

## Установка и запуск

В Gentoo Niri доступен как `gui-wm/niri` из
[GURU](https://github.com/gentoo/guru/tree/master/gui-wm/niri). Если оверлей
ещё не подключён, включи и синхронизируй его:

```bash
doas eselect repository enable guru
doas emaint sync -r guru
```

Для systemd включи USE-флаги `dbus` и `systemd`.

Файл: `/etc/portage/package.use/niri`

```text
gui-wm/niri dbus systemd
```

Для демонстрации экрана добавь USE-флаг `screencast` к этой строке. Он требует
`dbus` и добавляет `media-video/pipewire` и
`sys-apps/xdg-desktop-portal-gnome`.

```bash
emerge --pretend --verbose gui-wm/niri::guru
doas emerge --ask --verbose gui-wm/niri::guru
```

На systemd запускай Niri через `niri-session`: он подготавливает окружение
пользователя для D-Bus и systemd, затем запускает композитор через
`niri.service`. Служба Niri запускает `niri --session` и связана с
`graphical-session.target` и `xdg-desktop-autostart.target`. После выхода
`niri-session` очищает переменные окружения сессии. При обычном запуске через
`niri-session` вручную вызывать `dbus-update-activation-environment` не нужно.

Пример для greetd и tuigreet:

Файл: `/etc/greetd/config.toml`

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd niri-session"
user = "greetd"
```

## Конфигурация

Основной файл — `~/.config/niri/config.kdl`. Конфигурация KDL состоит из
блоков `input` для устройств ввода, `output` для экранов, `layout` для
раскладки колонок, `window-rule` для правил окон, `binds` для сочетаний клавиш
и `spawn-at-startup` для запуска программ.
Полное описание параметров — в
[справочнике конфигурации Niri](https://niri-wm.github.io/niri/Configuration:-Introduction.html).

## Автозапуск

XDG autostart запускается через обычную интеграцию с графической сессией.
Для каждого компонента выбери один способ запуска: если одновременно
использовать XDG autostart и `spawn-at-startup`, могут появиться два экземпляра,
например два экземпляра polkit-агента.

Noctalia shell можно запускать из конфигурации Niri:

```kdl
spawn-at-startup "noctalia"
```

Настройка оболочки описана в руководстве по
[Noctalia](../noctalia-shell/).

## Окружение

Блок `environment {}` задаёт переменные только для процессов, которые Niri
запускает сам; он не заменяет подготовку окружения сессии командой
`niri-session`. Не задавай `GDK_BACKEND` глобально: это ломает работу портала
демонстрации экрана.

## Порталы

Для корректной работы порталов Niri должен быть запущен как полноценная
графическая сессия. В описанной здесь systemd-схеме для этого используется
`niri-session`. GTK обеспечивает общие интерфейсы портала, а для демонстрации
экрана нужен `xdg-desktop-portal-gnome`. Подробности настройки — в руководстве
по [порталам Wayland](../wayland-portals/).

## Xwayland

Если нужны X11-приложения, установи `gui-apps/xwayland-satellite`. Niri
автоматически создаёт X11-сокеты, задаёт `DISPLAY` и запускает satellite по
запросу; при сбое запускает его снова. Вручную экспортировать `DISPLAY` и
запускать satellite не нужно.

## Проверка

После входа в Niri-сессию проверь её окружение и состояние службы:

```bash
echo "$XDG_CURRENT_DESKTOP"
systemctl --user is-active niri.service
```

Ожидаемый вывод:

```text
niri
active
```

Эти команды проверяют уже запущенную Niri-сессию.

## Связанные материалы

- [Порталы Wayland](../wayland-portals/) — выбор backend и проверка.
- [Noctalia](../noctalia-shell/) — установка и настройка оболочки.
- [Рабочее окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/) — записанное состояние системы.
- [Niri: интеграция с systemd и автозапуск](https://niri-wm.github.io/niri/Integrating-niri.html).
- [Niri: важные программы и порталы](https://niri-wm.github.io/niri/Important-Software.html).
- [Niri: Xwayland](https://niri-wm.github.io/niri/Xwayland.html).
