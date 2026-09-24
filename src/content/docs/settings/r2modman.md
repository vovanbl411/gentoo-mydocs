---
title: r2modman AppImage со Steam Flatpak
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Этот документ решает один сценарий: r2modman работает как host AppImage, а
Steam установлен через Flatpak. Записанное состояние ASUS B5402 находится в
[системном разделе](../systems/asus-b5402/applications.md).

## Symptom

- r2modman работает как host AppImage;
- Steam установлен как Flatpak;
- r2modman ожидает host executable или путь Steam;
- прямой вызов внутренних Steam scripts из Flatpak data directory не является
  корректной host-side интеграцией.

Наблюдавшаяся ранее ошибка `DISTRIB_RELEASE: unbound variable` была симптомом
прямого запуска такого скрипта, а не универсальной причиной проблемы.

## Cause

У Steam Flatpak нет обычного host executable `steam`, который может вызвать
r2modman AppImage. Каталог данных Flatpak содержит файлы Steam, но не заменяет
точку входа из среды хоста. Нужен wrapper, который принимает аргументы
r2modman и передаёт их `flatpak run`.

## Working solution

Файл: `~/.local/bin/steam`

```sh
#!/bin/sh
exec flatpak run com.valvesoftware.Steam "$@"
```

Сделай wrapper исполняемым:

```bash
chmod +x ~/.local/bin/steam
```

### PATH

Проверь, что `~/.local/bin` входит в `PATH` и найден именно wrapper:

```bash
command -v steam
```

Ожидаемый путь — `/home/<username>/.local/bin/steam`. Для fish можно добавить
каталог так; это пример только для fish, а не универсальная настройка shell:

```bash
fish_add_path ~/.local/bin
```

### r2modman settings

Сначала проверь каталог данных Steam Flatpak:

```bash
test -d ~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

Если каталог существует, укажи его как Steam data path:

```text
~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

Если текущая версия r2modman позволяет задать Steam command, используй:

```text
steam
```

или абсолютный путь:

```text
/home/<username>/.local/bin/steam
```

Название и расположение этого UI-поля могут меняться между версиями r2modman.

### Flatpak filesystem access

Если r2modman хранит данные профилей или модов в
`~/.config/r2modmanPlus-local`, а Steam не может прочитать нужные скрипты
запуска или файлы, выдай доступ только к этому каталогу:

```bash
flatpak override --user \
  --filesystem="$HOME/.config/r2modmanPlus-local" \
  com.valvesoftware.Steam
```

Доступ ко всему `$HOME` для этого не нужен. Перед сбросом проверь текущие
permissions:

```bash
flatpak info --show-permissions com.valvesoftware.Steam
```

Полный сброс user overrides для Steam:

```bash
flatpak override --user --reset com.valvesoftware.Steam
```

`--reset` удаляет все user overrides этого app-id, а не только разрешение для
r2modman.

## Verification

Проверь установку Steam, wrapper и data path отдельно:

```bash
flatpak info com.valvesoftware.Steam
command -v steam
test -d ~/.var/app/com.valvesoftware.Steam/.local/share/Steam
```

Главная функциональная проверка: выбери профиль в r2modman, нажми
`Start modded` и убедись, что запускается именно modded game.

Steam URI handler можно проверить отдельно:

```bash
xdg-open steam://rungameid/<appid>
```

Эта команда проверяет URI handler, но не wrapper и не запуск из r2modman.

## Game-specific notes

### Example: Risk of Rain 2 / BepInEx

Для некоторых сочетаний игры и mod loader могут понадобиться отдельные Steam
launch parameters. Например:

```text
WINEDLLOVERRIDES="winhttp=n,b" %command%
```

Не добавляй этот параметр как часть общей интеграции r2modman со Steam
Flatpak: он зависит от конкретной игры, версии Proton и mod loader и не нужен
всем BepInEx games.

## Troubleshooting

- `command -v steam` ничего не выводит: добавь `~/.local/bin` в `PATH` текущего
  shell и перезапусти r2modman из того же user environment.
- Steam запускается, но игра остаётся vanilla: проверь выбранный профиль,
  launch instructions r2modman и доступ Steam Flatpak к нужным profile files.
- Ошибка возникает при прямом запуске `steam.sh` из Flatpak data directory:
  вернись к host wrapper; внутренние scripts Flatpak не являются host entry
  point.

Современные выпуски r2modman для Linux доступны как AppImage и Flatpak. Этот
документ сохранён именно для сочетания **r2modman AppImage + Steam Flatpak**;
wrapper не объявляется лучшим вариантом для других установок.

## Related docs

- [Flatpak](flatpak.md) — permissions и user overrides.
- [Perplexity AppImage](perplexity.md) — общая интеграция AppImage в desktop.
- [Приложения ASUS B5402](../systems/asus-b5402/applications.md) — проверенное состояние машины.
- [r2modman releases](https://github.com/ebkr/r2modmanPlus/releases) — текущие Linux artifacts.
