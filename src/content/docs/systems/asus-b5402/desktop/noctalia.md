---
title: Noctalia на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Текущее состояние

Noctalia — оболочка основной Umbriel-сессии ASUS B5402: она показывает панель,
меню приложений, уведомления и экран блокировки. Пакет `gui-apps/noctalia`
установлен из [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
с USE `jemalloc`, который выбирает альтернативный распределитель памяти.
Noctalia запускается через Umbriel `autostart` и владеет D-Bus-интерфейсом
`org.freedesktop.Notifications`. Для Portage установлен
`virtual/notification-daemon` из `noctalia-overlay`.

## Запуск

Главный файл `~/.config/umbriel/config.toml` подключает `core.toml`. В нём
Umbriel запускает Noctalia при входе в сессию.

Файл: `~/.config/umbriel/core.toml`

```toml
[general]
autostart = ["noctalia"]
```

Подробнее о запуске сессии — в [руководстве Umbriel](../../../../desktop/umbriel/).

## Конфигурация

Ручные настройки находятся в TOML-файлах `~/.config/noctalia/`. Изменения,
сделанные через интерфейс Noctalia, сохраняются в
`~/.local/state/noctalia/settings.toml` и загружаются после ручных настроек.
Значение из `settings.toml` может перекрыть то же значение в файлах
`~/.config/noctalia/`. Если правка не действует, проверь параметр в файле
состояния.

## Уведомления

Noctalia принимает уведомления через `org.freedesktop.Notifications`.
Установленный `virtual/notification-daemon` из `noctalia-overlay` позволяет
Portage использовать Noctalia как провайдер обработчика уведомлений.
Настройка `libnotify` и поиск причин непоказанных уведомлений описаны в
[руководстве по уведомлениям](../../../../desktop/notifications/).

## Проверка

Проверь объединённую конфигурацию:

```bash
noctalia config validate
```

Команда должна завершиться без ошибок.

Узнай, какая программа обслуживает D-Bus-интерфейс уведомлений:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

В ответе имя сервера должно быть `noctalia`.

## Связанные материалы

- [Установка и конфигурация Noctalia](../../../../desktop/noctalia-shell/)
- [Уведомления рабочего стола](../../../../desktop/notifications/)
- [Запуск оболочки в Umbriel](../../../../desktop/umbriel/)
- [Рабочее окружение ASUS B5402](../environment/)
