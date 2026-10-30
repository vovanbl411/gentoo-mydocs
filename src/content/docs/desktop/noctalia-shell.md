---
title: Noctalia — оболочка рабочего стола
kind: guide
scope: general
status: current
last_verified: "2026-09-15"
verified_on: [asus-b5402]
---

Noctalia добавляет к Umbriel или Niri панель, dock, меню приложений,
уведомления, обои, экран блокировки и историю буфера обмена. Настройки
хранятся в TOML, а управление из командной строки доступно через `noctalia msg`.
Эта инструкция относится к реализации с TOML; старые инструкции для
Quickshell/QML к ней не подходят.

## Установка

Пакет `gui-apps/noctalia` доступен в дополнительных репозиториях Gentoo.
На ASUS B5402 используется
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay).
Подключение репозитория описано в его README.

После подключения синхронизируй оверлей и посмотри план установки:

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose gui-apps/noctalia
```

Если используешь другой репозиторий, подставь его имя в команду sync.
Keyword-правила для пакета и зависимостей добавляй по сообщению Portage
в `/etc/portage/package.accept_keywords/`.

После просмотра плана:

```bash
doas emerge --ask --verbose gui-apps/noctalia
```

## Запуск вместе с рабочим столом

В Umbriel добавь Noctalia в существующую секцию `[general]` конфигурации:

```toml
[general]
autostart = ["noctalia"]
```

Сохрани остальные элементы массива, если они есть. Пример разделённой
конфигурации — в [руководстве Umbriel](../umbriel/#конфигурация-и-noctalia).

В Niri используй автозапуск конфигурации KDL:

```kdl
spawn-at-startup "noctalia"
```

Выбери один способ запуска в каждой сессии. Если Noctalia уже запускается
пользовательским сервисом или через XDG-autostart, второй запуск из
конфигурации композитора не нужен.

## Где хранятся настройки

Noctalia читает два слоя конфигурации:

| Где | Для чего |
|-----|----------|
| `~/.config/noctalia/*.toml` | Настройки, которые ты редактируешь вручную; их можно хранить в dotfiles |
| `~/.local/state/noctalia/settings.toml` | Изменения, сделанные через интерфейс Noctalia |

Все TOML-файлы в `~/.config/noctalia/` объединяются. Для начала достаточно
`config.toml`; затем настройки можно разделить на несколько файлов.

Файл `settings.toml` загружается позже и перекрывает ручные настройки.
Если изменение в `config.toml` не действует, проверь соответствующее
значение в `settings.toml`. Не удаляй весь файл ради одного параметра:
в нём могут быть другие нужные настройки.

Перед серьёзной правкой сохрани копии конфигурации и файла состояния.
Для возврата восстанови оба: старый `config.toml` не поможет, если параметр
по-прежнему перекрывается более поздней настройкой.

## Проверка

```bash
noctalia config validate
```

Команда проверяет TOML. Исправь указанные ошибки в файлах перед следующим
входом в рабочий стол. Работу панели и горячих клавиш проверь в самой сессии.

Чтобы посмотреть установленную версию и источник пакета:

```bash
noctalia --version
cat /var/db/pkg/gui-apps/noctalia-*/repository
```

Noctalia также показывает системные уведомления. Установка libnotify,
интеграция с Portage и пробное сообщение описаны в
[руководстве по уведомлениям](../notifications/).

## Обновление

```bash
doas emaint sync -r noctalia-overlay
emerge --pretend --verbose --update gui-apps/noctalia
doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
```

Сначала прочитай план, затем подтверди установку. Portage обновляет пакет,
а пользовательские TOML-файлы остаются в домашнем каталоге.
Порядок подготовки новых релизов сопровождается в README оверлея.

## Связанные материалы

- [Umbriel](../umbriel/) — запуск композитора и оболочки.
- [Niri](../niri/) — запасная сессия и её автозапуск.
- [Noctalia на ASUS B5402](../../systems/asus-b5402/desktop/noctalia/)
- [Документация Noctalia](https://docs.noctalia.dev/noctalia/configuration/)
- [Перенос палитры из старой реализации](https://docs.noctalia.dev/noctalia/theming/palette/)
