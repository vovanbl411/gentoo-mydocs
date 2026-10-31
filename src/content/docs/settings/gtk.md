---
title: "Палитра Noctalia в GTK4: настройка и диагностика"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

Если GTK4-приложение не получает ожидаемую палитру Noctalia или показывает
неверный фон, включи оба штатных template Noctalia v5+ — GTK 3 и GTK 4. В
текущей реализации Noctalia рендерит только включённые templates, а оба GTK
template используют общий apply hook, который проверяет оба сгенерированных
файла `noctalia.css`. Ручные CSS-правила нужны только для подтверждённой
проблемы конкретного приложения или виджета.

## Штатные GTK templates Noctalia

В Noctalia открой **Settings → Templates** и включи оба встроенных template:
**GTK 3** и **GTK 4**. Выключенный GTK3 template не рендерится автоматически
вместе с GTK4, поэтому включение только GTK4 может завершить общий apply hook
ошибкой.

Noctalia создаёт `noctalia.css` отдельно в каталогах GTK3 и GTK4, а общий hook
добавляет импорт в оба `gtk.css`. При смене палитры или режима Noctalia
обновляет templates. После успешной проверки hook выбирает тему
`adw-gtk3` для светлого режима или `adw-gtk3-dark` для тёмного. GTK4 читает пользовательский файл
`$XDG_CONFIG_HOME/gtk-4.0/gtk.css`, если он есть; при незаданном
`XDG_CONFIG_HOME` используется `~/.config`.

```text
Палитра Noctalia
→ встроенные templates GTK3 и GTK4
→ отдельные noctalia.css в gtk-3.0/ и gtk-4.0/
→ соответствующие импорты в обоих gtk.css
→ GTK-приложения
```

Проверь, что соответствующая тема `adw-gtk3` установлена. Не редактируй
сгенерированный `noctalia.css` вручную: при повторной генерации Noctalia
заменит его содержимое.

## Цветовая схема и `settings.ini`

`theme.sync_color_scheme` отвечает за системное предпочтение тёмного или
светлого режима. GTK-приложения в Wayland-сессии получают такие desktop-wide
настройки через settings portal. GTK template решает другую задачу: передаёт
цвета палитры через CSS. Синхронизация цветовой схемы сама по себе не создаёт
палитру, а template не заменяет системное предпочтение dark/light.

`settings.ini` не нужен для передачи палитры Noctalia. GTK использует desktop
settings через платформенный API, а читает значения из `settings.ini` как
настройки по умолчанию, если такого механизма нет. Не добавляй
`gtk-application-prefer-dark-theme=1` как обязательную часть интеграции: это
свойство GTK4 устарело начиная с версии 4.20. Существующий `settings.ini`
проверяй только тогда, когда конкретное GTK-предпочтение ведёт себя не так,
как ожидается.

## Если палитра не применяется

Сначала полностью закрой и снова открой GTK4-приложение. Затем проверь
пользовательские файлы:

```bash
config_home="${XDG_CONFIG_HOME:-$HOME/.config}"

for gtk_version in gtk-3.0 gtk-4.0; do
  gtk_dir="$config_home/$gtk_version"
  printf '\n%s\n' "$gtk_dir"
  ls -la "$gtk_dir"
  sed -n '1,40p' "$gtk_dir/gtk.css"
  head -20 "$gtk_dir/noctalia.css"
  readlink "$gtk_dir/gtk.css" || true
  readlink -f "$gtk_dir/gtk.css" || true
done
```

Убедись, что `noctalia.css` существует, а `gtk.css` импортирует именно его.
Если `gtk.css` — symlink на старую тему или содержит посторонние импорты,
сначала зафиксируй текущий target и содержимое и сравни их со штатным выводом
Noctalia. Не заменяй файл и не добавляй импорт в `/usr/share/themes/...`
вслепую.

Исправляй системную тему только после проверки владельца файлов и целостности
пакета. Если проверка подтвердила повреждение package-managed CSS, восстанови
пакет штатным менеджером пакетов. Не удаляй файлы тем вручную без доказанной
причины и точного пути.

Если используешь `nwg-look`, проверь, не навязывает ли он отдельную тему для
GTK4: такой выбор может мешать применению палитры Noctalia. В Flatpak
проверяй доступность GTK-темы и файлов внутри sandbox; результат `ldd` для
хостового приложения здесь неприменим.

## GTK4 и libadwaita

GTK4 загружает пользовательский `gtk.css` с приоритетом
`GTK_STYLE_PROVIDER_PRIORITY_USER`, выше приоритета CSS приложения. Но этот
приоритет не гарантирует одинаковый результат во всех приложениях.
libadwaita отдельно управляет светлым и тёмным видом и предоставляет CSS
variables; приложения также могут использовать собственные CSS-классы и
стили. Поэтому один selector может сработать в обычном GTK4-приложении и не
дать такого же эффекта в приложении на libadwaita. Проверяй selectors на
конкретном приложении, не рассчитывая на универсальный внешний вид.

Если после проверки конкретный виджет GTK4 всё ещё не использует нужный цвет,
добавь узкое локальное правило в пользовательский
`$XDG_CONFIG_HOME/gtk-4.0/gtk.css` после импорта Noctalia и проверь его в этом
приложении. Такие selectors — необязательная локальная настройка, а не часть
обязательной конфигурации template. Не добавляй их в сгенерированный
`noctalia.css`.

## Диагностика

```bash
# Версия GTK4
pkg-config --modversion gtk4

# Библиотеки нативного динамически связанного приложения
ldd /path/to/native-application | grep -E 'libgtk-4|libadwaita'

# GTK Inspector и сообщения GTK
GTK_DEBUG=interactive application-name

# Запуск из терминала для просмотра предупреждений разбора CSS
application-name

# Временная проверка разрешения темы для одного запуска
GTK_THEME=adw-gtk3-dark application-name
```

`ldd` не подходит для Flatpak, статически связанных приложений и некоторых
wrapper-команд. `GTK_DEBUG` и `GTK_THEME` используй только для диагностики
одного запуска, не как постоянную конфигурацию.

## Проверка результата

- В **Settings → Templates** включены templates **GTK 3** и **GTK 4**.
- Существуют файлы `noctalia.css` в `$XDG_CONFIG_HOME/gtk-3.0/` и
  `$XDG_CONFIG_HOME/gtk-4.0/`; если `XDG_CONFIG_HOME` не задан, используй
  `~/.config/gtk-3.0/` и `~/.config/gtk-4.0/`.
- Оба `gtk.css` импортируют `noctalia.css` из своего каталога.
- GTK4-приложение после перезапуска не сообщает об ошибках разбора CSS.
- После смены палитры в Noctalia обновлённый цвет появляется в приложении.
- Если добавлены локальные selectors, они влияют только на нужные виджеты.

Если нужна визуальная приёмка, проверяй её в целевом приложении после
перезапуска; проверка файлов сама по себе её не подтверждает.

## Связанные материалы

- [Окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/) — локальное состояние
  эталонной системы.
- [Noctalia](../../desktop/noctalia-shell/) — установка и конфигурация оболочки.
- [Порталы Wayland](../../desktop/wayland-portals/) — desktop-wide настройки и portal.
- [GTK и Qt templates Noctalia](https://docs.noctalia.dev/noctalia/templates/official/gtk-qt/)
- [Темы и палитры Noctalia](https://docs.noctalia.dev/noctalia/theming/)
- Исходный код Noctalia: [описания GTK templates](https://github.com/noctalia-dev/noctalia/blob/main/assets/templates/builtin.toml), [TemplateApplyService](https://github.com/noctalia-dev/noctalia/blob/main/src/theme/template_apply_service.cpp) и [общий apply hook](https://github.com/noctalia-dev/noctalia/blob/main/assets/templates/gtk/apply.sh)
- GTK [`GtkCssProvider`](https://docs.gtk.org/gtk4/class.CssProvider.html) и
  [приоритет пользовательского CSS](https://docs.gtk.org/gtk4/const.STYLE_PROVIDER_PRIORITY_USER.html)
- GTK [`GtkSettings`](https://docs.gtk.org/gtk4/class.Settings.html) и
  [отладка GTK-приложений](https://docs.gtk.org/gtk4/running.html)
- [Styles & Appearance libadwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/styles-and-appearance.html)
