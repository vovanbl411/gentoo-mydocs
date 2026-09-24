---
title: "Niri: тайловый композитор со скроллингом"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Niri — Wayland-композитор, который вместо классической сетки использует
горизонтальную ленту окон. Результат этого руководства — рабочая сессия:

```text
Niri
→ native Wayland session
→ niri-session
→ systemd user session
→ XDG autostart
→ portals / polkit / shell as desktop components
```

Записанное состояние эталонной системы ASUS B5402 — в
[системном разделе](../../systems/asus-b5402/desktop/environment/).

## Launch

### Установка

В Gentoo Niri обычно доступен через оверлеи (например, guru) или собственный
ebuild. Захват экрана и системные диалоги обеспечивают portal-бэкенды — см.
[XDG Desktop Portals](../wayland-portals/).

### niri-session

На systemd-системе основной способ запуска — `niri-session`. Он:

- стартует Niri как user-юнит `niri.service`;
- сам занимается интеграцией session environment с user systemd и D-Bus:
  `XDG_SESSION_TYPE=wayland`, `XDG_CURRENT_DESKTOP=niri` и остальные
  session-переменные создаются и импортируются автоматически;
- поднимает `graphical-session.target`, а вместе с ним —
  `xdg-desktop-autostart.target`.

Поэтому при запуске через `niri-session` не нужно вручную задавать
`XDG_*`-переменные или вызывать `dbus-update-activation-environment`.

### Display manager: greetd + tuigreet

Пример `/etc/greetd/config.toml` с tuigreet в качестве greeter:

```toml
[terminal]
vt = 1

[default_session]
command = "tuigreet --time --remember --asterisks --cmd niri-session"
user = "greetd"
```

Greeter'у достаточно указать `niri-session` командой сессии. Niri работает и с
другими display manager'ами — важно запускать именно `niri-session`, а не
голый бинарник `niri`, если нужна systemd-интеграция.

## Configuration

Конфигурация — `~/.config/niri/config.kdl` (формат KDL). Основные категории:

- `input` — клавиатура, тачпад, жесты, ускорение (libinput);
- `outputs` — мониторы, масштаб, положение;
- `layout` — ширина колонок, отступы, пресеты;
- `window-rule` — плавающие окна, декорации, правила для отдельных приложений;
- `binds` — клавиатурные сокращения;
- `spawn-at-startup` — запуск программ при старте (см. Autostart).

Полный reference — [Niri wiki: Configuration](https://github.com/YaLTeR/niri/wiki/Configuration:-Overview).
Базовый блок `environment {}` с session-переменными не нужен: их уже
выставляет `niri-session`.

## Autostart

`niri-session` поднимает `graphical-session.target`, а вместе с ним —
`xdg-desktop-autostart.target`. Приложения с XDG autostart entry
(`/etc/xdg/autostart/*.desktop`, `~/.config/autostart/*.desktop`) запускаются
сами.

Не дублируйте такое приложение через `spawn-at-startup`/`spawn-sh-at-startup`
— получится два экземпляра. Типичный пример — polkit authentication agent,
которого на пользовательскую сессию допускается ровно один: второй экземпляр
завершается ошибкой регистрации (`An authentication agent already exists for
the given subject`).

- [Niri wiki — Integrating niri (Autostart)](https://github.com/YaLTeR/niri/wiki/Integrating-niri)
- [Niri wiki — Configuration: Miscellaneous (`spawn-at-startup`)](https://github.com/YaLTeR/niri/wiki/Configuration:-Miscellaneous)

## Optional environment for processes spawned by Niri

`environment {}` задаёт переменные для процессов, которые Niri запускает
непосредственно. Это не механизм для настройки отдельных приложений, и эти
значения не попадают автоматически в окружение systemd --user.

Если переменная нужна только одному приложению, используй wrapper/launcher
или соответствующий systemd unit.

Глобально задавать backend'ы тулкитов (`GDK_BACKEND=wayland`,
`QT_QPA_PLATFORM=wayland`, `SDL_VIDEODRIVER=wayland`, `EGL_PLATFORM=wayland`)
не нужно: в Wayland-сессии тулкиты выбирают Wayland сами. Upstream Niri
предупреждает, что глобальный `GDK_BACKEND=wayland` ломает screencast portal.
## Xwayland (optional)

Xwayland не обязателен. Если нужны X11-приложения, установите
`xwayland-satellite >= 0.7`: Niri автоматически интегрирует его. Ручной
экспорт `$DISPLAY` и ручной запуск satellite как baseline не нужны. Подробнее
— [Niri wiki](https://github.com/YaLTeR/niri/wiki).

## Verification

Внутри запущенной сессии:

```bash
# Сессия представилась как niri
echo "$XDG_CURRENT_DESKTOP"

# Niri и session targets подняты как user-юниты
systemctl --user is-active niri.service \
                     graphical-session.target \
                     xdg-desktop-autostart.target
```

Ожидаемый результат: `niri` и `active` для каждого юнита. Затем можно
проверить компоненты сессии: [portals](../wayland-portals/) и, при
использовании, [Noctalia](../noctalia-shell/).

## Related docs

- [XDG Desktop Portals](../wayland-portals/) — screencast и диалоги.
- [Noctalia v5 для Niri](../noctalia-shell/) — оболочка.
- [Рабочее окружение ASUS B5402](../../systems/asus-b5402/desktop/environment/)
  — фактическое состояние.
- [Niri wiki](https://github.com/YaLTeR/niri/wiki) — полный reference.
