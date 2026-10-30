---
title: Umbriel — установка и запуск
kind: guide
scope: general
status: current
last_verified: null
verified_on: []
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
doas emaint sync -r umbriel-overlay
```

Композитор и портал развиваются вместе. Выбери их версии из одной строки
[таблицы оверлея](https://github.com/vovanbl411/umbriel-overlay#принятая-пара-и-откат).
Если нужны точные версии для установки или отката, используй приведённые
там команды с двумя атомами пакетов. Не смешивай строки таблицы.

Для захвата экрана у Umbriel нужен `screencast`. Флаг `picker` у портала
добавляет окно выбора экрана или приложения, которым ты хочешь поделиться.

Файл: `/etc/portage/package.use/umbriel`

```text
gui-wm/umbriel screencast
gui-libs/xdg-desktop-portal-umbriel picker
```

Оба пакета используют testing keyword `~amd64`. Добавь их в
`package.accept_keywords`, если они ещё не разрешены в твоей конфигурации.

```text
# /etc/portage/package.accept_keywords/umbriel
gui-wm/umbriel ~amd64
gui-libs/xdg-desktop-portal-umbriel ~amd64
```

Посмотри план установки. Portage должен выбрать оба пакета из
`umbriel-overlay` и совместимые версии из таблицы.

```bash
emerge -pv gui-wm/umbriel gui-libs/xdg-desktop-portal-umbriel
doas emerge --ask gui-wm/umbriel gui-libs/xdg-desktop-portal-umbriel
```

Noctalia устанавливается отдельно: [установка и настройка оболочки](../noctalia-shell/).

## Конфигурация и Noctalia

Если пользовательской конфигурации ещё нет, скопируй пример из пакета:

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

Если секция уже есть, измени существующую. В TOML нельзя объявлять одну
секцию дважды. Сохрани остальные команды в массиве; не запускай Noctalia
одновременно отсюда и другим способом.

Большую конфигурацию можно разделить на файлы. Например, в
`~/.config/umbriel/config.toml`:

```toml
[include]
files = ["core.toml"]
```

В этом случае `[general]` и `autostart` можно разместить в `core.toml`.
Umbriel читает включённые файлы по порядку, а главный файл — последним.
Поэтому значение в `config.toml` может перекрыть значение из `core.toml`.

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

Настрой backend Umbriel по [руководству по порталам](../wayland-portals/#umbriel).
Это отдельная настройка: установка композитора сама по себе не определяет,
какой backend выберет `xdg-desktop-portal`.

В терминале внутри Umbriel:

```bash
echo "$XDG_CURRENT_DESKTOP"
umbriel outputs
umbriel config validate
```

Ожидается имя `umbriel`, список подключённых экранов и конфигурация без ошибок.
Затем проверь Noctalia и [доставку уведомлений](../notifications/), открой
диалог выбора файла и попробуй демонстрацию экрана в браузере.

## Возврат к Niri

Niri можно оставить установленным вместе с его конфигурацией. Чтобы сделать
его следующей сессией greetd, замени только команду запуска:

```toml
command = "tuigreet --time --remember --asterisks --cmd niri-session"
```

Используй именно `niri-session`: он настраивает окружение и пользовательские
службы Niri. После изменения выйди из Umbriel и войди снова.
Если графический вход недоступен, переключись в текстовую консоль и восстанови
сохранённый файл greetd. Подробнее — [запуск Niri](../niri/).

## Связанные материалы

- [Рабочее окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/)
- [Конфигурация Umbriel](https://docs.noctalia.dev/umbriel/configuration/)
- [Исходный пример конфигурации](https://github.com/noctalia-dev/umbriel/blob/main/examples/config.toml)
