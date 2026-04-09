# Running r2modman (AppImage) with Steam (Flatpak) on Gentoo/Niri

## Данный гайд описывает решение проблемы интеграции r2modman (запущенного как AppImage) со Steam, установленным через Flatpak, в окружении с Wayland/Niri

### Проблема

По умолчанию r2modman пытается вызвать бинарник steam или запустить steam.sh напрямую из директории Steam. В случае с Flatpak исполняемого файла steam в системе нет, а прямой запуск скрипта из песочницы Flatpak в хост-системе Gentoo ломается из-за отсутствия рантайма (ошибка DISTRIB_RELEASE: unbound variable).

### Решение

1. Создание Steam Wrapper (Скрипта-прослойки)
Создаем скрипт, который будет перехватывать вызовы r2modman и корректно пробрасывать их внутрь Flatpak.
Файл: ~/.local/bin/steam (или steam.sh)

```bash
# !/bin/bash

# Пробрасываем все аргументы ($@) внутрь контейнера Flatpak

flatpak run com.valvesoftware.Steam "$@"

Права на исполнение:
chmod +x ~/.local/bin/steam
```

2. Настройка PATH
Убедитесь, что ~/.local/bin находится в начале переменной $PATH. Для Fish shell:

```bash
set -u FISH_USER_PATHS ~/.LOCAL/BIN $FISH_USER_PATHS
```

3. Конфигурация r2modman
В интерфейсе r2modman (Settings -> Locations/Linux) необходимо убедиться, что:

* Steam Directory: Указывает на внутреннюю папку Flatpak:
   ~/.var/app/com.valvesoftware.Steam/.local/share/Steam
* Steam Command: (если доступно в версии) установлено в steam или полный путь /home/vladimir/.local/bin/steam.

4. Параметры запуска в Steam (BepInEx Fix)
Чтобы Proton разрешил загрузку BepInEx, в свойствах Risk of Rain 2 в Steam необходимо установить параметры запуска:
WINEDLLOVERRIDES="winhttp=n,b" %command%

### Дополнительная диагностика
Если игра не запускается, проверьте обработку ссылок в терминале:

> Должен открыться Steam на странице игры

```bash 
xdg-open steam://rungameid/632360
```
