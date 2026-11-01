---
title: "Thunderbird: native Gentoo и Wayland"
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

В Gentoo Thunderbird можно собрать с native Wayland backend. Проверяй отдельно
возможности пакета и работу приложения: USE-флаги не подтверждают выбранные в
runtime backend и renderer.

## Возможности сборки

Посмотри доступную версию и план Portage, прежде чем менять USE-флаги:

```bash
thunderbird --version
emerge --pretend --verbose mail-client/thunderbird
```

Смысл отдельных USE-флагов зависит от текущего ebuild. Основные различия:

| USE-флаг | Что меняет |
|----------|------------|
| `wayland` | Добавляет native Wayland backend. Флаг `-X` отключает X11 backend, но не требуется для Wayland и может сосуществовать с `wayland`. Если нужен только Wayland, проверь ограничения `REQUIRED_USE` текущего ebuild. |
| `pulseaudio` | Собирает audio backend через libpulse. Его может обслуживать PipeWire через PulseAudio compatibility layer. |
| `system-pipewire` | Использует system PipeWire для WebRTC и screencast. Это отдельная настройка от обычного audio output. |
| `hwaccel` | Применяет Gentoo prefs для принудительного включения accelerated rendering. Флаг не показывает, какой renderer запущен в приложении. |
| `pgo` | Включает Profile-Guided Optimization при сборке, если текущие версия и профиль допускают этот вариант. Смотри план Portage: доступность флага меняется. |
| `system-*` | Для соответствующих библиотек выбирает system library вместо bundled-копии. Набор флагов зависит от ebuild. |

`clang` выбирает Clang как compiler. `jumbo-build` включает unified builds и
может увеличить расход памяти при сборке. Ни эти флаги, ни другие build-time
опции сами по себе не гарантируют ускорения интерфейса или обработки почты.

## Настройка почтовых аккаунтов

При добавлении аккаунта сначала попробуй autodiscovery Thunderbird. Проверь
выбранные протокол, сервер и способ аутентификации; если параметры не подходят,
введи значения из текущей документации провайдера. IMAP хранит почту на сервере
и синхронизирует её с клиентом; POP использует другую модель хранения.

Используй поддерживаемую провайдером аутентификацию. Gmail обычно подключается
через **Sign in with Google** и OAuth2. Пароль приложения используй только если
провайдер поддерживает этот способ и рекомендует его для почтового клиента.
Не сохраняй пароли, OAuth tokens и app passwords в документации.

Gmail сам сохраняет отправленные через SMTP письма на сервере. Проверь, не
создаёт ли включённый в Thunderbird `Place a copy in` дубликаты в твоём setup;
Google описывает вариант с отключённой копией в настройках Thunderbird.

## Проверка Wayland и runtime

Открой **Help → Troubleshooting Information** (`about:support`) и проверь
**Window Protocol**, **Compositing**, **Audio Backend** и **Profile Directory**.
Сведения о GPU смотри, если проверяешь графический путь.

`USE=wayland` добавляет backend, но не подтверждает, что приложение запущено
через него. Аналогично, `USE=-hwaccel` не запрещает Thunderbird включить
WebRender самостоятельно, а `USE=hwaccel` не доказывает, что renderer работает
с аппаратным ускорением. Проверяй runtime в `about:support`.

## Профиль и локальное хранилище

Для расположения профиля используй **Profile Directory** из `about:support`;
пути `~/.config/thunderbird/` и `~/.thunderbird/` не универсальны. Размер
профиля можно проверить по фактическому пути:

```bash
du -sh -- "/path/from/Profile Directory"
```

В **Account Settings → Synchronization & Storage** выбери, какие сообщения и
папки хранить локально. Полная offline synchronization занимает больше места,
но позволяет читать синхронизированные письма без сети. Global Search
индексирует сообщения и занимает место для поисковой базы; поиск по телу письма
доступен для синхронизированных сообщений. Выбирай объём хранения с учётом
свободного места и нужной работы офлайн.

## Уведомления

Уведомления о почте зависят от настроек Thunderbird и работающего обработчика
уведомлений рабочего стола. Gentoo ebuild Thunderbird может предлагать
`x11-libs/libnotify` как optional feature для desktop notifications; это не
обязательная зависимость. Проверяй рекомендацию в текущем ebuild и плане
Portage. Звук и визуальный баннер могут работать по разным путям.

Если звуковое уведомление есть, а баннера нет, проверь настройку системных
уведомлений Thunderbird, наличие optional feature и обработчик desktop
notifications. Подробности о `libnotify`, D-Bus и сервере уведомлений — в
[руководстве по уведомлениям](../../desktop/notifications/).

## Устранение неполадок и проверка

| Симптом | Что проверить |
|---------|---------------|
| Окно запущено не через Wayland | USE `wayland`, способ запуска и **Window Protocol** в `about:support`. |
| Неясно, использует ли renderer GPU | **Compositing** и сведения о GPU в `about:support`; `hwaccel` сам по себе этого не подтверждает. |
| Не работает звук | **Audio Backend**; `pulseaudio` и `system-pipewire` отвечают за разные части сборки. |
| Не проходит вход или отправка почты | Authentication method, серверные параметры и требования провайдера. |
| Письма недоступны офлайн или профиль велик | Синхронизацию сообщений и папок в **Synchronization & Storage**. |
| Нет desktop banner | Настройки уведомлений Thunderbird и [руководство по уведомлениям](../../desktop/notifications/). |

Проверь, что план Portage соответствует выбранным возможностям, приложение
показывает ожидаемый **Window Protocol**, звук, отправка и получение почты
работают, а локальное хранение и уведомления соответствуют выбранной настройке.

## Связанные материалы

- [Настройка аккаунта Thunderbird](https://support.mozilla.org/en-US/kb/automatic-account-configuration)
- [Добавление Gmail в почтовый клиент](https://support.google.com/mail/answer/7126229?hl=en)
- [IMAP synchronization](https://support.mozilla.org/en-US/kb/imap-synchronization)
- [Global Search](https://support.mozilla.org/en-US/kb/global-search)
- [Профили Thunderbird](https://support.mozilla.org/en-US/kb/profiles-where-thunderbird-stores-user-data)
- [Уведомления рабочего стола](../../desktop/notifications/)
- [Приложения ASUS B5402](../../systems/asus-b5402/applications/)
