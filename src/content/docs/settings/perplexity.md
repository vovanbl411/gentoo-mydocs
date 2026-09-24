---
title: Perplexity AppImage в Wayland desktop
kind: guide
scope: general
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Perplexity AppImage можно интегрировать в Wayland desktop стабильным путём,
desktop entry, иконкой и URI handler:

```text
AppImage
→ ~/.local/bin/
→ desktop entry
→ Wayland launch
→ perplexity-app:// handler
```

Записанная конфигурация ASUS B5402 находится в
[applications.md](../../systems/asus-b5402/applications/).

## Prerequisites

Нужны скачанный AppImage, `dev-util/desktop-file-utils` для
`desktop-file-validate` и `update-desktop-database`, а также `xdg-utils` для
регистрации `perplexity-app://`. FUSE2 нужен только обычному Type-2 AppImage,
который сообщает, что требует FUSE или `libfuse.so.2`.

```bash
command -v fusermount
```

## Install AppImage

Используй стабильное имя target, чтобы обновление не меняло `Exec=`:

```bash
mv "$HOME/Downloads/<downloaded-Perplexity-AppImage>" "$HOME/.local/bin/Perplexity.AppImage"
chmod +x "$HOME/.local/bin/Perplexity.AppImage"
```

## Desktop entry

Файл: `~/.local/share/applications/perplexity.desktop`

```ini
[Desktop Entry]
Name=Perplexity
Comment=AI-powered search and chat
Exec=env ELECTRON_OZONE_PLATFORM_HINT=wayland /home/<username>/.local/bin/Perplexity.AppImage --ozone-platform=wayland %U
Terminal=false
Type=Application
Icon=Perplexity
MimeType=x-scheme-handler/perplexity-app;
Categories=Network;Chat;
TryExec=/home/<username>/.local/bin/Perplexity.AppImage
```

Замени `/home/<username>` на свой абсолютный путь: desktop entry не разворачивает
`$HOME` как shell. `ELECTRON_OZONE_PLATFORM_HINT=wayland` и
`--ozone-platform=wayland` задают современный Wayland path для Electron.

`--no-sandbox` не является требованием AppImage и не должен быть baseline:
он ослабляет Electron sandbox. Если конкретный AppImage не запускается из-за
sandbox, сначала проверь точное сообщение об ошибке и поддержку unprivileged
user namespaces. Только затем оцени отдельный workaround и его последствия.

Поля наподобие `StartupWMClass` и `X-AppImage-Version` добавляй лишь когда они
действительно присутствуют во внутреннем desktop entry AppImage или нужны для
этого приложения; это не общие требования.

## Icon

Сначала извлеки AppImage и посмотри, какие иконки в нём действительно есть:

```bash
workdir=$(mktemp -d)
cd "$workdir"
"$HOME/.local/bin/Perplexity.AppImage" --appimage-extract
find squashfs-root -type f \( -iname '*.png' -o -iname '*.svg' \) | sort
```

Скопируй существующую подходящую иконку в каталог с соответствующим размером,
например:

```bash
mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"
cp "<path-to-existing-icon>" "$HOME/.local/share/icons/hicolor/256x256/apps/Perplexity.png"
```

Не предполагается, что AppImage содержит все размеры иконок. При необходимости
обнови icon cache после копирования:

```bash
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor/"
```

## URI handler

Обнови desktop database и назначь handler:

```bash
update-desktop-database ~/.local/share/applications/
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
xdg-mime query default x-scheme-handler/perplexity-app
```

Последняя команда должна вывести `perplexity.desktop`. Общие правила для MIME
и URI scheme описаны в [приложениях по умолчанию](../../desktop/default-applications/).

## Verification

Проверь в одном месте:

- `~/.local/bin/Perplexity.AppImage` существует и исполняем;
- desktop entry проходит проверку и виден launcher'у;
- иконка разрешается в меню;
- `gtk-launch perplexity.desktop` запускает приложение;
- `xdg-mime query default x-scheme-handler/perplexity-app` возвращает `perplexity.desktop`;
- приложение действительно использует Wayland backend.

```bash
desktop-file-validate ~/.local/share/applications/perplexity.desktop
gtk-launch perplexity.desktop
xdg-mime query default x-scheme-handler/perplexity-app
```

`WAYLAND_DEBUG=1` можно использовать как расширенную диагностику, но это не
единственный способ подтвердить backend: также подходят сведения самого
приложения или compositor о его окне.

## Troubleshooting

### FUSE not found

Если обычный Type-2 AppImage сообщает, что требует FUSE или `libfuse.so.2`,
установи FUSE2 slot:

```bash
doas emerge --ask sys-fs/fuse:0
```

`--appimage-extract` остаётся fallback для конкретного AppImage; extraction
не является предпочтительным способом установки.

### Wayland launch fails

Сначала проверь вывод приложения и текущие Electron/Ozone flags. Дополнительные
Chromium flags добавляй только для подтверждённой версии и симптома, а не как
исторический baseline. Не добавляй `--no-sandbox` в общий desktop entry.

### Icon or URI handler is missing

Проверь путь к реально извлечённой иконке и повтори обновление icon cache.
Для URI handler повтори:

```bash
xdg-mime query default x-scheme-handler/perplexity-app
xdg-mime default perplexity.desktop x-scheme-handler/perplexity-app
```

## Related docs

- [Flatpak](../flatpak/) — другой способ установки GUI-приложений.
- [r2modman](../r2modman/) — пример интеграции AppImage со Steam Flatpak.
- [Niri](../../desktop/niri/) — Wayland-композитор.
- [Приложения по умолчанию](../../desktop/default-applications/) — MIME-ассоциации и URI schemes через XDG.
