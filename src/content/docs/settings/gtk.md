---
title: Настройка темы Noctalia для GTK4 на Niri
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Конкретная конфигурация ASUS B5402 записана в
[system document](../systems/asus-b5402/desktop/environment.md). Этот документ
описывает решение симптома, наблюдавшегося на проверенной машине; оно не
объясняет все проблемы тем GTK.

## Symptom

GTK4-приложения могут не получать палитру Noctalia, показывать прозрачный или
неверный фон, а GTK4 и libadwaita-приложения могут реагировать на тему
по-разному.

## Cause on the verified system

На проверенной машине проблема была связана с broken/local theme imports,
смешением system theme и `~/.config/gtk-4.0/`, а также различиями GTK4 и
libadwaita-приложений. Это не универсальная причина каждого GTK-проблемы.

## Working configuration

Финальная модель — локальный CSS импортирует палитру, которую генерирует
Noctalia:

```text
~/.config/gtk-4.0/
├── gtk.css
├── noctalia.css
└── settings.ini
```

```text
Noctalia generates palette
→ local GTK CSS imports it
→ application consumes resulting GTK colors/styles
```

GTK4 автоматически читает `$XDG_CONFIG_HOME/gtk-4.0/gtk.css`. Этот файл
импортирует сгенерированную палитру `noctalia.css` и содержит selectors для
виджетов, которым одной палитры недостаточно:

Файл: `~/.config/gtk-4.0/gtk.css`

```css
@import url("noctalia.css");

/* Дополнительные правила нужны только виджетам, которым недостаточно палитры. */
window {
  background-color: @window_bg_color;
  color: @window_fg_color;
}

headerbar, .titlebar {
  background-color: @headerbar_bg_color;
  color: @headerbar_fg_color;
}

button {
  background-color: @card_bg_color;
  color: @card_fg_color;
}

button:checked, button:active {
  background-color: @accent_bg_color;
  color: @accent_fg_color;
}

scale trough {
  background-color: @card_bg_color;
}

scale highlight, scale slider {
  background-color: @accent_bg_color;
}
```

Файл: `~/.config/gtk-4.0/settings.ini`

```ini
[Settings]
gtk-application-prefer-dark-theme=1
```

## Apply the fix

### Check imports first

Проверь, что локальные файлы существуют и импорт `noctalia.css` разрешается:

```bash
ls -la ~/.config/gtk-4.0/
```

Если `gtk.css` — старый symlink на system theme, замени его локальным файлом с
импортом выше. Не добавляй `@import url("noctalia.css")` в
`/usr/share/themes/...`: system theme не должна зависеть от палитры в `$HOME`.

### Repair a system theme only when needed

Не удаляй `/usr/share/themes/...` как первый шаг. Сначала установи, что
изменены именно system-owned files: проверь владельца и package integrity
доступным в системе инструментом, например `equery check <category/package>`.
Если проверка подтверждает повреждение, переустанови пакет штатным Portage
workflow и проверь восстановленные CSS-файлы.

Ручное удаление `/usr/share/themes/...` допустимо только для доказанных
leftovers, которые Portage не восстановил после переустановки. Перед ним
зафиксируй точный путь и причину, чтобы не удалить файлы другого пакета.

### Refresh palette and local CSS

После изменения палитры перегенерируй `noctalia.css` средствами Noctalia и
перезапусти приложение. Если нужно исключить старое локальное состояние,
очисти GTK4 cache только после проверки содержимого каталога:

```bash
rm -rf ~/.cache/gtk-4.0/
```

## GTK4 vs libadwaita

GTK4 и libadwaita theming заметно отличаются от GTK3. Пользовательский CSS в
`~/.config/gtk-4.0/` применяется независимо от старой GTK3 theme model;
`gtk-theme-name` не стоит считать единственным механизмом оформления GTK4.
libadwaita-приложения могут намеренно ограничивать traditional custom themes.
Поэтому custom CSS — локальное решение для нужных виджетов, а не универсальный
официальный механизм темизации всех приложений.

Если palette definitions не дают нужного результата в чистом GTK4-приложении,
добавляй selectors только для наблюдаемого виджета. Например, правила для
`scale` выше нужны для ползунков, а не для всей темы.

## Verification

Проверь следующее:

- `gtk.css` импортирует доступный `noctalia.css`;
- приложение запускается без CSS warnings или errors;
- визуально корректны фон, foreground и selected state;
- после regeneration Noctalia новая палитра отражается в приложении.

## Diagnostics

Эти команды запускают приложение только для диагностики; не используй
`GTK_THEME` или `GTK_DEBUG` как persistent configuration.

```bash
# Версия GTK4
pkg-config --modversion gtk4

# Зависимости приложения
ldd "$(command -v <приложение>)" | grep -E "gtk-4|adwaita"

# GTK Inspector
GTK_DEBUG=interactive <приложение>

# Запуск из terminal для CSS parsing warnings
<приложение>

# Временный запуск без темы или с явной GTK3-темой
GTK_THEME= <приложение> &
GTK_THEME=adw-gtk3-dark <приложение> &
```

## Example palette

Полный `noctalia.css` не дублируется здесь: его генерирует Noctalia, и значения
меняются вместе с палитрой. Минимальный иллюстративный фрагмент выглядит так:

```css
@define-color window_bg_color #0b0e14;
@define-color window_fg_color #d1d1c7;
@define-color accent_bg_color #e6b450;
@define-color accent_fg_color #0b0e14;
```

## Related docs

- [Окружение ASUS B5402](../systems/asus-b5402/desktop/environment.md) — проверенное состояние машины.
- [Noctalia](../desktop/noctalia-shell.md) — shell, генерирующий палитру.
- [Niri](../desktop/niri.md) — Wayland-композитор.
