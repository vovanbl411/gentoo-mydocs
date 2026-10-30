---
title: ASUS NumberPad — цифровая клавиатура на тачпаде
kind: guide
scope: system
status: current
last_verified: null
verified_on: []
---

Драйвер ASUS NumberPad превращает тачпад в цифровую клавиатуру. На ASUS B5402
для устройства `ASUE1410:01 04F3:3230` используется раскладка `b7402`.
Название раскладки относится к драйверу; выбирать её только по модели
ноутбука не стоит.

## Установка

Драйвер и его зависимость `dev-python/python-periphery` находятся в
[asus-numberpad-overlay](https://github.com/vovanbl411/asus-numberpad-overlay).
Подключи свой checkout оверлея к Portage по его README, разреши предложенные
Portage testing keywords и установи пакет:

```bash
emerge -pv sys-apps/asus-numberpad-driver
doas emerge --ask sys-apps/asus-numberpad-driver
```

Оба Python-пакета должны поддерживать выбранную версию интерпретатора.
Сервис запускается от обычного пользователя; установка пакета сама его
не запускает.

## Раскладка и каталог настроек

Доступные раскладки лежат в `/usr/share/asus-numberpad-driver/layouts`.
Пользовательский сервис читает переменные из
`~/.config/asus-numberpad-driver/service.conf`.

Если `service.conf` уже существует, сохрани его копию и измени нужные
значения вручную. Следующий блок создаёт новый файл:

```bash
mkdir -p "$HOME/.config/asus-numberpad-driver"
cat > "$HOME/.config/asus-numberpad-driver/service.conf" <<EOF
NUMBERPAD_LAYOUT=b7402
NUMBERPAD_CONFIG_DIR=$HOME/.config/asus-numberpad-driver/
EOF
```

`NUMBERPAD_LAYOUT` выбирает раскладку. Во втором параметре нужен абсолютный
путь без пробелов и со слэшем в конце. Команда подставляет твой домашний каталог;
сервис не раскрывает `~` как командная оболочка. Драйвер создаёт в этом
каталоге файл `numberpad_dev`.

## Доступ к устройствам

Драйвер читает события клавиатуры и тачпада через `/dev/input/event*`, создаёт
виртуальную клавиатуру через `/dev/uinput` и управляет тачпадом через hidraw.
Если hidraw недоступен, драйвер может обращаться к I²C-шине; рабочий hidraw
позволяет обойтись без доступа ко всей шине.

Номера `event*` и `hidraw*` могут изменяться. Сначала найди устройства:

```bash
cat /proc/bus/input/devices
```

В блоке нужного устройства поле `Handlers` указывает его `event*`.
Для выбранного узла посмотри постоянные атрибуты:

```bash
udevadm info --attribute-walk --name=/dev/input/eventN
udevadm info --attribute-walk --name=/dev/hidrawN
```

Здесь и далее `eventN` и `hidrawN` нужно заменить найденными именами.
Сопоставь hidraw с тачпадом по родительскому HID-устройству, а не по номеру узла.

Локальные правила хранятся в
`/etc/udev/rules.d/99-asus-numberpad-local.rules`. Ниже — шаблон: замени
`<user>`, имена устройств и HID-идентификатор значениями своей системы.
Для input возьми `ATTRS{name}`, для hidraw — `KERNELS` родительского
HID-устройства из вывода `udevadm`. Если идентификатор оканчивается
номером экземпляра, замени эту часть на `*`, сохранив шину, vendor и product:
правило не должно зависеть от порядка обнаружения устройств.

```udev
SUBSYSTEM=="input", KERNEL=="event*", ATTRS{name}=="<touchpad name>", OWNER="<user>", MODE="0600"
SUBSYSTEM=="input", KERNEL=="event*", ATTRS{name}=="<keyboard name>", OWNER="<user>", MODE="0600"
SUBSYSTEM=="hidraw", KERNELS=="<parent HID identifier>", OWNER="<user>", MODE="0600"
SUBSYSTEM=="misc", KERNEL=="uinput", OWNER="<user>", MODE="0600"
```

Не копируй шаблон с незаменёнными значениями. Для input добавляй только
устройства, которые нужны драйверу; не открывай все `event*`, hidraw или I²C
любому пользователю. Чтение input позволяет видеть нажатия клавиш, а запись
в uinput — вводить их от имени пользователя.

Если `/dev/uinput` отсутствует, загрузи модуль:

```bash
doas modprobe uinput
```

Для загрузки после перезагрузки добавь строку `uinput` в
`/etc/modules-load.d/uinput.conf`.

После редактирования правил перечитай их:

```bash
doas udevadm control --reload-rules
```

Новые права применяются при создании устройств. Для встроенного тачпада
простой способ применить их — перезагрузка. Проверь от обычного пользователя:

```bash
ls -l /dev/input/eventN /dev/hidrawN /dev/uinput
```

Пользователь сервиса должен иметь права чтения и записи нужных узлов.
Для отмены настройки удали только добавленные строки локальных правил
и перечитай правила; прежние права вернутся при следующем создании устройств.

## Запуск в Wayland-сессии

Сервису нужны переменные текущего рабочего стола. Выполняй команды из
терминала внутри Umbriel, не из SSH или отдельной текстовой консоли:

```bash
: "${WAYLAND_DISPLAY:?}" "${XDG_RUNTIME_DIR:?}" "${DBUS_SESSION_BUS_ADDRESS:?}" &&
test "${XDG_SESSION_TYPE:-}" = wayland &&
  systemctl --user import-environment WAYLAND_DISPLAY XDG_RUNTIME_DIR XDG_SESSION_TYPE DBUS_SESSION_BUS_ADDRESS &&
  systemctl --user start asus-numberpad-driver.service
```

Первые строки проверяют наличие окружения Wayland и передают его
пользовательскому systemd. Только после этого запускается драйвер.

Проверь состояние и попробуй включить NumberPad на тачпаде:

```bash
systemctl --user status asus-numberpad-driver.service
journalctl --user -b -u asus-numberpad-driver.service
```

Сервис должен работать без ошибок доступа; нажатия в цифровой области
должны вводить соответствующие цифры. При ошибке `Permission denied` проверь
узел устройства, указанный в журнале, и права именно этого узла.

Для остановки выполни отдельно:

```bash
systemctl --user stop asus-numberpad-driver.service
```

У сервиса нет секции установки для `systemctl enable`. Если настраиваешь
автозапуск из композитора, выполняй последовательность передачи окружения
и запуска после готовности Wayland, а при выходе останавливай сервис.
Обычный запуск из SSH не заменяет запуск внутри графической сессии.

## Связанные материалы

- [Рабочее окружение ноутбука](../../desktop/environment/)
- [README оверлея](https://github.com/vovanbl411/asus-numberpad-overlay)
