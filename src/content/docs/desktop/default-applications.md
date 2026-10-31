---
title: Приложения по умолчанию и MIME-типы (XDG)
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

`xdg-mime query default` показывает текущий обработчик, а `xdg-mime default`
назначает новый. Запускай команды от обычного пользователя в графической
сессии.

## Как посмотреть и изменить обработчик

Для MIME-типа укажи его имя; URI-схемы записываются как
`x-scheme-handler/<scheme>`:

```bash
xdg-mime query default <mime-type>
xdg-mime default <desktop-id> <mime-type>
```

Вместо значений в угловых скобках подставь MIME-тип и desktop ID.
Первая форма только читает настройку. Вторая назначает обработчик по умолчанию
для пользовательской сессии.

```bash
xdg-mime query default x-scheme-handler/https
xdg-mime default firefox.desktop x-scheme-handler/https
```

Перед назначением проверь, что приложение установлено и его desktop entry
объявляет поддержку нужного MIME-типа или URI-схемы.

## Desktop ID и mimeapps.list

`xdg-mime` принимает ID `.desktop`-файла, а не имя бинарного файла. Например,
`firefox.desktop` — ID Firefox. `query default` выводит ID выбранного
обработчика. Пользовательские записи обычно находятся в
`$XDG_DATA_HOME/applications/`, системные — в
`/usr/share/applications/`.

Файл `mimeapps.list` хранит обработчики по умолчанию в группе
`[Default Applications]`: MIME-типы и URI-схемы сопоставляются там с одним или
несколькими desktop ID, разделёнными `;`. Пользовательский файл обычно
находится в `$XDG_CONFIG_HOME/mimeapps.list` (`~/.config/mimeapps.list`, если
переменная не задана). Команда `xdg-mime default` просит среду рабочего стола
назначить новый обработчик; изменяемый файл зависит от среды.

Назначения по умолчанию обычно общие для разных сессий. Спецификация также
допускает файлы для конкретной среды рабочего стола, например
`<desktop>-mimeapps.list`, которые могут задавать другие значения. Имя среды
берётся из `XDG_CURRENT_DESKTOP`; файл с более высоким приоритетом может
переопределить настройку из файла с более низким приоритетом.

## Примеры

Команды `query default` ниже только читают настройку. Каждая команда
`xdg-mime default` меняет её. Примеры показывают разные виды ассоциаций, а не
универсальный набор обработчиков; выбирай установленное приложение, которое
поддерживает нужный тип.

Для обычного MIME-типа, например PDF:

```bash
xdg-mime query default application/pdf
xdg-mime default firefox.desktop application/pdf
```

Для нестандартной URI-схемы, например Perplexity:

```bash
xdg-mime query default x-scheme-handler/perplexity-app
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
```

Desktop ID и URI-схема для Perplexity описаны в
[руководстве Perplexity AppImage](../../settings/perplexity/).

## Flatpak и порталы

Приложения в sandbox, включая Flatpak, могут передавать открытие файлов и URI
через XDG Desktop Portal. Ассоциации хоста по-прежнему важны, но портал
может использовать обработчик по умолчанию, последний выбранный вариант или
показать выбор приложения, если вызывающее приложение этого попросило.
Подробности — в [руководстве по порталам Wayland](../wayland-portals/).

Справка `xdg-mime(1)` предупреждает: результат `xdg-mime query default` может
отличаться от приложения, которое фактически запускает `xdg-open`. Среда
рабочего стола может использовать собственный механизм открытия. Если команды
показывают разные результаты, проверь этот механизм и путь через портал.

## Проверка

Проверь текущие значения:

```bash
xdg-mime query default x-scheme-handler/https
xdg-mime query default application/pdf
```

После изменения повтори `query default` для того же MIME-типа или URI-схемы.
Затем проверь открытие подходящего тестового файла или URI.

## Связанные материалы

- [Perplexity AppImage](../../settings/perplexity/) — пример регистрации URI-схемы.
- [Порталы Wayland](../wayland-portals/) — работа backend порталов.
- [Приложения ASUS B5402](../../systems/asus-b5402/applications/) — приложения
  эталонной системы.
- [Спецификация MIME Applications (freedesktop.org)](https://specifications.freedesktop.org/mime-apps/latest-single/).
- [XDG Desktop Portal: OpenURI](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.OpenURI.html).
