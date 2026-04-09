# Настройка XDG Desktop Portals

Порталы необходимы для взаимодействия приложений с композитором (скриншоты, шаринг экрана, открытие файлов, уведомления). В Niri это критически важный узел.

## 1. Необходимые пакеты

Для полноценной работы нам связка из нескольких порталов:

- `gui-libs/xdg-desktop-portal` — Основной демон.
- `gui-libs/xdg-desktop-portal-gnome` (или gtk) — Для системных диалогов и тем.
- `gui-libs/xdg-desktop-portal-wlr` (или нативный портал Niri) — Для захвата экрана (Screencasting).

## 2. Конфигурация (portals.conf)

С выходом обновлений xdg-desktop-portal необходимо явно указывать, какой портал за что отвечает.

Файл: `~/.config/xdg-desktop-portal/niri-portals.conf` (или conf для конкретного десктопа)

```ini
[preferred]
default=gtk
org.freedesktop.impl.portal.ScreenCast=wlr
org.freedesktop.impl.portal.Screenshot=wlr
```

## 3. Интеграция с D-Bus

Niri должен запускаться в контексте D-Bus сессии. В нашем случае мы используем dbus-broker для лучшей производительности.

Убедитесь, что при запуске Niri импортируются переменные окружения:

```bash
# В конфиге niri (spawn-at-startup)
spawn-sh-at-startup "dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP=niri"
```
