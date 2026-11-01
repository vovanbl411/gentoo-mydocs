---
title: r2modman AppImage со Steam Flatpak
kind: troubleshooting
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

Этот документ описывает один сценарий: r2modman работает как host AppImage,
а Steam установлен через Flatpak. Записанное состояние ASUS B5402 находится в
[системном разделе](../../systems/asus-b5402/applications/).

## Symptom

- r2modman работает как host AppImage;
- Steam установлен как Flatpak;
- для запуска игры r2modman нужен host executable, который передаёт аргументы
  Steam Flatpak;
- прямой вызов внутренних Steam scripts из каталога данных Flatpak не является
  host-side интеграцией.

Ранее при прямом запуске такого скрипта наблюдалась ошибка
`DISTRIB_RELEASE: unbound variable`. Это симптом неверной точки входа, а не
универсальная причина проблемы.

## Cause

Процесс r2modman AppImage работает на хосте. Для запуска через Steam Flatpak ему
нужен host wrapper, который принимает аргументы запуска и передаёт их команде
`flatpak run`.

## Working solution

Создай исполняемый wrapper. Имя `steam` в примере удобно для поиска через
`PATH`, но не является требованием архитектуры: имя может быть другим, если
r2modman настроен на абсолютный путь к wrapper.

Файл: `~/.local/bin/steam` (пример)

```sh
#!/bin/sh
exec flatpak run com.valvesoftware.Steam "$@"
```

Сделай wrapper исполняемым:

```bash
chmod +x ~/.local/bin/steam
```

### PATH и абсолютный путь

Если r2modman ищет executable по имени, каталог wrapper должен входить в
`PATH` процесса r2modman. Для примера с именем `steam` проверь:

```bash
command -v steam
```

Если в r2modman указан абсолютный путь, проверь, что файл существует и
исполняемый:

```bash
test -x /path/to/wrapper
```

При запуске из desktop entry окружение может отличаться от интерактивного
shell. Проверяй `PATH` тем же способом, которым запускаешь r2modman.

### Настройки r2modman

Сначала проверь каталог данных Steam Flatpak:

```bash
test -d "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"
```

Если каталог существует и r2modman запрашивает Steam data path, укажи:

```text
~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

Для запуска укажи host wrapper: абсолютный путь, если настройка принимает
путь, или имя wrapper, если приложение ищет executable через `PATH`. Названия
и расположение настроек могут различаться; ориентируйся на их назначение, а не
на конкретную надпись в интерфейсе.

### Доступ Steam Flatpak к файлам профиля

Filesystem permission нужен только если Steam Flatpak должен читать файлы
профиля или скрипты запуска, которые лежат вне доступных ему каталогов. Если
это подтверждённая проблема, выдай доступ только к нужному каталогу. Например,
некоторые установки r2modman хранят профили в
`~/.config/r2modmanPlus-local`; этот путь не обязателен для всех установок.

Перед изменением проверь permissions приложения и оба слоя overrides:

```bash
flatpak info --show-permissions com.valvesoftware.Steam
flatpak override --user --show com.valvesoftware.Steam
flatpak override --system --show com.valvesoftware.Steam
```

Если подтверждено, что Steam нужен доступ именно к этому каталогу, добавь
per-user permission:

```bash
flatpak override --user \
  --filesystem="$HOME/.config/r2modmanPlus-local" \
  com.valvesoftware.Steam
```

Не выдавай доступ ко всему `$HOME`, если для интеграции достаточно одного
каталога.

Не используй сброс overrides как первый шаг диагностики. Если ты намеренно
сбрасываешь per-user overrides, учитывай, что команда удалит все такие
настройки для этого app-id, а не только разрешение r2modman:

```bash
flatpak override --user --reset com.valvesoftware.Steam
```

### Verification

Проверяй уровни интеграции отдельно.

Установка Steam:

```bash
flatpak info com.valvesoftware.Steam
```

Wrapper: для поиска по `PATH` проверь имя wrapper; для примера `steam`:

```bash
command -v steam
```

Для absolute path проверь, что файл исполняемый:

```bash
test -x /path/to/wrapper
```

Не запускай wrapper только ради этой проверки: он запускает Steam.

Steam data path:

```bash
test -d "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"
```

Permissions и overrides:

```bash
flatpak info --show-permissions com.valvesoftware.Steam
flatpak override --user --show com.valvesoftware.Steam
flatpak override --system --show com.valvesoftware.Steam
```

Функциональная проверка выполняется вручную: выбери профиль в r2modman, нажми
`Start modded` и убедись, что запускается modded game.

## Game-specific notes

### Example: Risk of Rain 2 / BepInEx

Для некоторых сочетаний игры и mod loader могут понадобиться отдельные Steam
launch parameters. Например:

```text
WINEDLLOVERRIDES="winhttp=n,b" %command%
```

Этот параметр зависит от конкретной игры, версии Proton и mod loader. Он не
является частью общей интеграции и не нужен всем BepInEx games.

## Troubleshooting

- Wrapper не находится по имени: для PATH-based настройки проверь
  `command -v <wrapper-name>` и окружение, из которого запущен r2modman.
- Wrapper задан абсолютным путём, но не запускается: проверь
  `test -x /path/to/wrapper` и содержимое файла. Он должен передавать все
  аргументы через `"$@"`.
- Steam запускается, но игра остаётся vanilla: проверь выбранный профиль,
  launch instructions r2modman и доступ Steam Flatpak к нужным profile files.
- Ошибка возникает при прямом запуске `steam.sh` из Flatpak data directory:
  используй host wrapper; внутренние scripts Flatpak не являются host entry
  point.

В Linux-релизах r2modman доступны разные форматы, включая AppImage и Flatpak.
Это руководство описывает только сочетание **r2modman AppImage + Steam
Flatpak**.

## Related docs

- [Flatpak](../flatpak/) — permissions и user overrides.
- [Perplexity AppImage](../perplexity/) — общая интеграция AppImage в desktop.
- [Приложения ASUS B5402](../../systems/asus-b5402/applications/) — состояние машины.
- [r2modman releases](https://github.com/ebkr/r2modmanPlus/releases) — Linux artifacts.
