---
title: Приложения по умолчанию и MIME-типы (XDG)
kind: guide
scope: general
status: current
last_verified: "2026-09-14"
verified_on: [asus-b5402]
---

Посмотреть и изменить приложение по умолчанию для MIME-типа или URI-схемы:

```bash
xdg-mime query default <mime-or-scheme>          # текущий обработчик
xdg-mime default <desktop-id> <mime-or-scheme>   # назначить обработчик
```

Пример:

```bash
xdg-mime query default x-scheme-handler/https
xdg-mime default firefox.desktop x-scheme-handler/https
```

Ассоциации действуют для пользовательской сессии и не зависят от
Wayland-композитора. Приложения, включая Flatpak, обычно используют эти
XDG-ассоциации при открытии внешних ссылок.

## Desktop ID и mimeapps.list

Команды работают с ID desktop-файла, например `firefox.desktop` или
`com.google.Chrome.desktop`. ID не обязан совпадать с именем исполняемого
файла. Для ассоциации нужен установленный desktop-файл: локальные обычно
находятся в `~/.local/share/applications/`, системные — в
`/usr/share/applications/`.

Результат `xdg-mime default` сохраняется в пользовательском `mimeapps.list`,
обычно в `~/.config/mimeapps.list`. По XDG-спецификации это не единственное
возможное местоположение: существуют также системные и desktop-специфичные
файлы (например, `<desktop>-mimeapps.list`). Настройка сохраняется между
перезагрузками, но её может изменить интерфейс рабочего стола или другое
приложение. Если файл управляется через dotfiles, перед добавлением проверь,
что перечисленные desktop-файлы существуют на целевой системе.

## Examples

Ниже — примеры, а не универсальный набор по умолчанию: подставляй свои
desktop ID. Какие приложения реально установлены на эталонной системе,
зафиксировано в [её записи](../../systems/asus-b5402/applications/).

### HTTP/HTML/PDF (пример: Firefox)

```bash
xdg-mime default firefox.desktop x-scheme-handler/http
xdg-mime default firefox.desktop x-scheme-handler/https
xdg-mime default firefox.desktop text/html
xdg-mime default firefox.desktop application/xhtml+xml
xdg-mime default firefox.desktop application/pdf
```

### Images (пример: qimgv)

```bash
xdg-mime default qimgv.desktop image/jpeg
xdg-mime default qimgv.desktop image/png
xdg-mime default qimgv.desktop image/gif
xdg-mime default qimgv.desktop image/webp
xdg-mime default qimgv.desktop image/bmp
```

### Audio/video (пример: mpv)

```bash
xdg-mime default mpv.desktop audio/mpeg
xdg-mime default mpv.desktop audio/ogg
xdg-mime default mpv.desktop audio/flac
xdg-mime default mpv.desktop video/mp4
xdg-mime default mpv.desktop video/webm
xdg-mime default mpv.desktop video/x-matroska
```

### Custom URI schemes

Протоколы вида `perplexity-app://`, `tg://` или `steam://` назначай по
документации соответствующего приложения. Формат тот же:

```bash
xdg-mime default <application>.desktop x-scheme-handler/<scheme>
xdg-mime query default x-scheme-handler/<scheme>
```

См. [Perplexity AppImage](../../settings/perplexity/) и
[r2modman](../../settings/r2modman/).

## Verification

Собранные query-команды для основных типов:

```bash
xdg-mime query default x-scheme-handler/http
xdg-mime query default x-scheme-handler/https
xdg-mime query default text/html
xdg-mime query default application/pdf
xdg-mime query default image/png
xdg-mime query default video/mp4
```

Чтобы заменить обработчик, повтори команду `xdg-mime default` с другим
desktop ID. Ручное редактирование `mimeapps.list` обычно не требуется.

## Related docs

- [Приложения ASUS B5402](../../systems/asus-b5402/applications/) — фактический
  набор приложений эталонной системы.
