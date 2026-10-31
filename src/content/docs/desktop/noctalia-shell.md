---
title: Noctalia — оболочка рабочего стола
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Noctalia — нативная оболочка рабочего стола для Wayland. Руководство описывает
установку пакета Gentoo, запуск с Umbriel или Niri, ручную TOML-конфигурацию,
проверку и обновление.

## Установка

Пакет `gui-apps/noctalia` находится в
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay). Следуй
README оверлея, чтобы подключить репозиторий. Пакет помечен testing keyword
`~amd64`.

Файл: `/etc/portage/package.accept_keywords/noctalia`

```text
gui-apps/noctalia ~amd64
```

Если Portage запрашивает keyword для зависимостей, добавь записи, указанные
в его сообщениях. После подключения оверлея посмотри план установки:

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose gui-apps/noctalia
```

Если план корректен, установи пакет:

```bash
doas emerge --ask --verbose gui-apps/noctalia
```

## Запуск

В существующей секции `[general]` конфигурации Umbriel добавь Noctalia в
массив `autostart`, сохранив другие команды, если они есть:

```toml
[general]
autostart = ["noctalia"]
```

В конфигурации Niri KDL можно указать:

```kdl
spawn-at-startup "noctalia"
```

В одной графической сессии запускай Noctalia только одним способом.

## Конфигурация

Ручная конфигурация по умолчанию находится в `~/.config/noctalia/`. Noctalia
загружает все `*.toml` непосредственно из этой директории, сортирует файлы
по имени и объединяет их настройки. Для начала достаточно одного файла:
`~/.config/noctalia/config.toml`. Разделять настройки на несколько файлов
можно по желанию.

Изменения из интерфейса и действия, выполненные во время работы Noctalia,
записываются в `~/.local/state/noctalia/settings.toml`. Этот файл загружается
после ручных TOML-настроек и перекрывает совпадающие параметры. Если правка в
`~/.config/noctalia/*.toml` не действует, сначала проверь то же значение в
`settings.toml`.

Указаны стандартные пути; Noctalia также учитывает XDG-переменные и собственные
переопределения `NOCTALIA_*`.

Если конфигурацию нужно организовать сложнее, `[include]` позволяет подключать
другие файлы и каталоги. Подробности — в
[документации Noctalia](https://docs.noctalia.dev/noctalia/configuration/).

## Проверка

Проверь конфигурацию:

```bash
noctalia config validate
```

Без аргументов команда проверяет и объединяет ручные `*.toml`-файлы, затем
учитывает переопределения из `settings.toml`. Успешная проверка означает, что
ошибок конфигурации нет. Предупреждения об устаревших или игнорируемых
настройках сами по себе не означают ошибку проверки. Предупреждения об
устаревших ключах после обновления подскажут, какие ручные TOML-файлы нужно
привести к текущему формату.

В графической сессии отдельно проверь работу панели и горячих клавиш. Версию
CLI можно посмотреть командой:

```bash
noctalia --version
```

Noctalia может обслуживать системные уведомления; `libnotify`, виртуальный
пакет Portage и поиск причин непоказанных уведомлений описаны в
[руководстве по уведомлениям](../notifications/).

## Обновление

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose --update gui-apps/noctalia
doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
```

Сначала проверь план Portage, затем подтверди обновление. Пользовательские
TOML-файлы хранятся отдельно от пакета.

> **Примечание**: руководство относится к текущей реализации Noctalia с
> TOML-конфигурацией. Старые инструкции для Quickshell/QML к ней не применимы.

## Связанные материалы

- [Umbriel](../umbriel/) — запуск оболочки в основной сессии.
- [Niri](../niri/) — конфигурация запасной сессии.
- [Noctalia на ASUS B5402](../../systems/asus-b5402/desktop/noctalia/)
- [Документация Noctalia](https://docs.noctalia.dev/noctalia/configuration/)
- [Исходный код Noctalia](https://github.com/noctalia-dev/noctalia)
