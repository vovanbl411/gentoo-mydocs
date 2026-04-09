# Niri: Тайловый композитор со скроллингом

Niri — это современный Wayland-композитор, который вместо классической сетки использует бесконечную ленту окон. Это идеально подходит для ультрабуков (как наш ASUS ExpertBook) и работы с кодом.

## 1. Установка

В Gentoo Niri обычно доступен через оверлеи (например, guru) или как бинарный пакет/ebuild для сборки из исходников.

Убедитесь, что пакет собран с поддержкой нужных вам функций (например, screencast).

## 2. Запуск (Pure Wayland)

Мы используем Display Manager (greetd).

Для корректной работы GTK/Qt приложений в Wayland-режиме, добавьте в переменные окружения (например, в `~/.config/niri/config.kdl`):

```kdl
environment {
    // ==========================================
    // Core Wayland Session
    // ==========================================
    XDG_SESSION_TYPE "wayland"
    XDG_CURRENT_DESKTOP "niri"
    XDG_SESSION_DESKTOP "niri"
    
    // ==========================================
    // GDK / GTK Applications
    // ==========================================
    GDK_BACKEND "wayland"
    // GDK_SCALE убран — берёт из monitor config
    
    // ==========================================
    // QT Applications
    // ==========================================
    QT_QPA_PLATFORM "wayland"
    QT_WAYLAND_DISABLE_WINDOWDECORATION "1"
    QT_QPA_PLATFORMTHEME "qt6ct"
    
    // ==========================================
    // Other Toolkits
    // ==========================================
    CLUTTER_BACKEND "wayland"
    SDL_VIDEODRIVER "wayland"
    
    // ==========================================
    // Graphics & Browsers
    // ==========================================
    EGL_PLATFORM "wayland"
    MOZ_ENABLE_WAYLAND "1"
    MOZ_DBUS_REMOTE "1"
    MOZ_USE_XINPUT2 "1"
    // ==========================================
    // Electron / Chrome
    // ==========================================
    ELECTRON_OZONE_PLATFORM_HINT "auto"
    
    // ==========================================
    // XWayland (опционально — лучше через systemd/user service)
    // ==========================================
    // DISPLAY ":0"                 
}
```

## 3. Основные концепции конфига

Конфигурация Niri использует формат KDL. Основные акценты нашего сетапа:

- **Layout**: Настройка ширины колонок (по умолчанию 0.5 или "пресеты").
- **Input**: Настройка тачпада с поддержкой жестов и ускорения (libinput).
- **Window Rules**: Отключение украшений окон или принудительный запуск определенных приложений в плавающем режиме.

## Настройка Display Manager

Niri поддерживает большинство Display Manager'ов.

### Greetd

Ниже приведен пример конфигурации с использованием Tuigreet в качестве greeter:

Файл: `/etc/greetd/config.toml`

```toml
[terminal]
# The VT to run the greeter on. Can be "next", "current" or a number
# designating the VT.
vt = 1

# The default session, also known as the greeter.
[default_session]

# `agreety` is the bundled agetty/login-lookalike. You can replace `/bin/sh`
# with whatever you want started, such as `sway`.
command = "tuigreet --time --remember --asterisks --cmd niri-session"

# The user to run the command as. The privileges this user must have depends
# on the greeter. A graphical greeter may for example require the user to be
# in the `video` group.
user = "greetd"
```
