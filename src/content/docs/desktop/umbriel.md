---
title: Umbriel — установка и запуск
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Umbriel управляет окнами и выводом изображения в Wayland-сессии. Noctalia
добавляет панель, меню приложений, уведомления и экран блокировки. Здесь —
установка этой связки в Gentoo, запуск через greetd и возврат к Niri.

## Установка

Пакеты `gui-wm/umbriel` и `gui-libs/xdg-desktop-portal-umbriel` находятся в
[umbriel-overlay](https://github.com/vovanbl411/umbriel-overlay).
Портал нужен для демонстрации экрана из браузера и других приложений.

Файл: `/etc/portage/repos.conf/umbriel-overlay.conf`

```ini
[umbriel-overlay]
location = /var/db/repos/umbriel-overlay
sync-type = git
sync-uri = https://github.com/vovanbl411/umbriel-overlay.git
auto-sync = yes
```

```bash
doas emerge --sync umbriel-overlay
```

Umbriel и backend портала устанавливаются и откатываются как одна согласованная
пара. Текущую пару бери из строки «Принятая текущая пара» в
[таблице оверлея](https://github.com/vovanbl411/umbriel-overlay/blob/main/README.md#принятая-пара-и-откат).
Обе версии должны быть из одной строки: так ты не смешаешь версии из разных
принятых пар.

Для демонстрации экрана включи USE-флаг `screencast` у Umbriel. Флаг `picker`
у портала отвечает за окно выбора экрана или приложения. Сейчас `picker`
включён по умолчанию; явная запись фиксирует, что нужен графический выбор
источника.

Файл: `/etc/portage/package.use/umbriel`

```text
gui-wm/umbriel screencast
gui-libs/xdg-desktop-portal-umbriel picker
```

Оба пакета помечены testing keyword `~amd64`. Разреши точные версии из строки
«Принятая текущая пара» в `package.accept_keywords`.

Файл: `/etc/portage/package.accept_keywords/umbriel-overlay`

```text
=gui-wm/umbriel-<Umbriel-version> ~amd64
=gui-libs/xdg-desktop-portal-umbriel-<portal-version> ~amd64
```

Подставь обе версии из строки «Принятая текущая пара». Сначала проверь, что
Portage разрешает именно эту пару из `umbriel-overlay`:

```bash
emerge -pv \
  '=gui-wm/umbriel-<Umbriel-version>' \
  '=gui-libs/xdg-desktop-portal-umbriel-<portal-version>'
```

После проверки установи ту же пару:

```bash
doas emerge --ask \
  '=gui-wm/umbriel-<Umbriel-version>' \
  '=gui-libs/xdg-desktop-portal-umbriel-<portal-version>'
```

Для отката возьми версии нужной пары из одной строки таблицы и укажи их точными
атомами в `package.accept_keywords` и командах `emerge`.

Noctalia устанавливается отдельно: [установка и настройка оболочки](../noctalia-shell/).

## Конфигурация и Noctalia

Пакет устанавливает стартовую конфигурацию в
`/usr/share/umbriel/config.toml`. Umbriel сам не создаёт пользовательский
файл. Если его ещё нет, скопируй стартовую конфигурацию:

```bash
mkdir -p ~/.config/umbriel
cp /usr/share/umbriel/config.toml ~/.config/umbriel/config.toml
```

Существующий файл не перезаписывай: внеси изменения в него.

Для запуска Noctalia добавь `noctalia` в массив `autostart` секции `[general]`:

```toml
[general]
autostart = ["noctalia"]
```

Добавь команду в существующий массив `autostart` и не создавай вторую секцию
`[general]`: TOML не допускает повторного объявления таблицы. Сохрани другие
команды в массиве и оставь один способ запуска Noctalia в сессии.

Большую конфигурацию можно разделить на файлы. Например, в
`~/.config/umbriel/config.toml`:

```toml
[include]
files = ["core.toml"]
```

В этом случае `[general]` и `autostart` можно разместить в `core.toml`.
Подключённые файлы читаются по порядку, а главный `config.toml` — последним,
поэтому его значения могут перекрыть настройки из `core.toml`.

Проверь конфигурацию до выхода из работающей сессии:

```bash
umbriel config validate
```

Команда должна завершиться без ошибок. Большинство настроек применяется
при сохранении файла; изменение `autostart` требует нового входа в сессию.

## Вход через greetd и tuigreet

Сначала сохрани копию работающей конфигурации greetd. Так можно вернуться
к прежнему рабочему столу из текстовой консоли, если новая сессия не запустится.

```bash
doas cp -a /etc/greetd/config.toml /etc/greetd/config.toml.before-umbriel
```

В `/etc/greetd/config.toml` измени команду в существующей `[default_session]`:

```toml
[default_session]
command = "tuigreet --time --remember --asterisks --cmd umbriel"
user = "greetd"
```

Остальные настройки greetd сохрани. После выхода из рабочего стола следующий
вход должен открыть Umbriel и запустить Noctalia. Перезапуск greetd завершает
графическую сессию: сначала сохрани работу.

## Порталы и проверка сессии

Установка композитора сама по себе не выбирает backend портала. Настрой его по
[руководству по порталам](../wayland-portals/#umbriel). Для демонстрации экрана
нужны USE-флаг `screencast` и настроенный backend портала; `picker` включает
графический выбор экрана или приложения.

В терминале внутри Umbriel:

```bash
echo "$XDG_CURRENT_DESKTOP"
umbriel outputs
umbriel config validate
```

Ожидается имя `umbriel`, список подключённых экранов и конфигурация без ошибок.
Затем проверь, что появилась Noctalia, работает выбор файла и приложения могут
демонстрировать экран.

## Возврат к Niri

Если Niri установлен и его конфигурация сохранена, для возврата к нему замени
команду запуска greetd:

```toml
command = "tuigreet --time --remember --asterisks --cmd niri-session"
```

Используй `niri-session`, а не `niri`: эта команда подготавливает окружение и
пользовательские службы Niri. После изменения выйди из Umbriel и войди
снова. Если графический вход недоступен, переключись в текстовую консоль и
восстанови сохранённую копию greetd. Подробнее — [запуск Niri](../niri/).

## Связанные материалы

- [Рабочее окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/)
- [Конфигурация Umbriel](https://docs.noctalia.dev/umbriel/configuration/)
- [Исходный пример конфигурации](https://github.com/noctalia-dev/umbriel/blob/main/examples/config.toml)
