---
title: "Perplexity AppImage: интеграция с рабочим столом"
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Руководство показывает, как разместить AppImage, добавить приложение в меню,
установить иконку и зарегистрировать URI-схему `perplexity-app://`. Desktop
entry позволяет запускать Perplexity из Wayland-сессии, но сам по себе не
выбирает графический backend приложения.
Для настройки и проверки должны быть доступны `update-desktop-database`,
`xdg-mime` и `desktop-file-validate`.

## Установка AppImage

После скачивания скопируй AppImage в постоянный каталог под стабильным именем:

```bash
install -Dm755 "<path-to-downloaded-AppImage>" "$HOME/.local/bin/Perplexity.AppImage"
```

## Desktop entry

Файл: `$HOME/.local/share/applications/perplexity.desktop`

```ini
[Desktop Entry]
Type=Application
Name=Perplexity
Exec=/home/<user>/.local/bin/Perplexity.AppImage %U
Icon=Perplexity
Terminal=false
MimeType=x-scheme-handler/perplexity-app;
```

Замени `/home/<user>` на абсолютный путь к AppImage. `Exec=` не выполняется
через shell, поэтому `$HOME` и `~` в нём не раскрываются. Шаблон не задаёт
Electron/Ozone flags: добавляй конкретный флаг только при подтверждённой
проблеме запуска или выбора backend.

## Иконка и URI handler

Для PNG используй каталог hicolor, соответствующий фактическому размеру
изображения:

```bash
install -Dm644 "<path-to-existing-PNG>" \
  "$HOME/.local/share/icons/hicolor/<size>/apps/Perplexity.png"
```

Для SVG используй каталог `scalable` и расширение `.svg`:

```bash
install -Dm644 "<path-to-existing-SVG>" \
  "$HOME/.local/share/icons/hicolor/scalable/apps/Perplexity.svg"
```

В обоих случаях `Icon=Perplexity` остаётся без расширения. После создания или
изменения desktop entry обнови MIME cache и назначь обработчик схемы:

```bash
update-desktop-database "$HOME/.local/share/applications"
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
```

`xdg-mime default` меняет пользовательскую ассоциацию. Общие правила описаны в
[руководстве по приложениям по умолчанию](../../desktop/default-applications/).

## Проверка

```bash
test -x "$HOME/.local/bin/Perplexity.AppImage"
desktop-file-validate "$HOME/.local/share/applications/perplexity.desktop"
test -f "<path-to-installed-icon>"
xdg-mime query default x-scheme-handler/perplexity-app
```

Для проверки иконки подставь путь к установленному PNG или SVG. Запрос
обработчика должен вывести `perplexity.desktop`. Эти команды не запускают
приложение. Для функциональной проверки открой Perplexity из меню. Если нужно
подтвердить именно Wayland backend, проверь тип окна средствами композитора:
наличие desktop entry и URI-ассоциации этого не подтверждает.

## Если AppImage не запускается

Если AppImage явно сообщает об отсутствии FUSE или `libfuse.so.2`, проверь
runtime dependency, соответствующую точному сообщению. Это руководство не
предписывает конкретный пакет или слот FUSE.

Не добавляй `--no-sandbox` как универсальное исправление: этот флаг отключает
часть Chromium/Electron sandbox.

## Связанные материалы

- [Приложения по умолчанию](../../desktop/default-applications/) — MIME-типы и URI-схемы.
- [Приложения ASUS B5402](../../systems/asus-b5402/applications/) — записанное состояние системы.
