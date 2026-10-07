---
title: "Thunderbird: native Gentoo и Wayland"
kind: guide
scope: general
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

Thunderbird из Gentoo подходит для Wayland-first рабочего стола с несколькими
IMAP-провайдерами. При настройке отдельно проверяй возможности, включённые при
сборке, и фактическое поведение приложения в runtime: USE-флаги сами по себе
не подтверждают Wayland, рендеринг или аудиобэкенд.

Ниже приведены решения эталонной системы ASUS ExpertBook B5402. Это один
проверенный вариант настройки; правила Portage и размер локальной почты не
являются универсальной рекомендацией для Gentoo.

2026-10-07 повторно проверен только notification path Thunderbird 157.0.
Данные сборки, runtime backend, профиля и прочих настроек ниже относятся к
проверке 2026-10-01.

## Build policy

Проверенный resolver output для `mail-client/thunderbird-157.0` показывает:

| Решение | Значение и смысл |
|---------|------------------|
| Wayland | `wayland` включает native Wayland backend. В reference system также выбран `-X` как осознанная pure-Wayland policy; он не требуется для самого Wayland backend. |
| Audio | `pulseaudio` добавляет audio backend через libpulse. В runtime его обслуживает PipeWire/PulseAudio-compatible stack. `system-pipewire` для этого не требуется и в resolver output выключен. |
| Rendering | `hwaccel` добавляет Gentoo system-wide prefs, принудительно включающие hardware-accelerated rendering, и устанавливает `gfxtest`. При `-hwaccel` эти prefs не инжектируются; Thunderbird всё ещё может самостоятельно включить WebRender. |
| System libraries | В resolver output включены `system-av1`, `system-harfbuzz`, `system-jpeg`, `system-libevent`, `system-librnp`, `system-libvpx` и `system-webp`. |
| PGO | `pgo` замаскирован в текущем профиле и не включён. Не описывай эту сборку как PGO-сборку. |

Также resolver показывает `clang`, `hardened` и `jumbo-build`. Это свойства
текущей сборки; они не означают, что интерфейс или обработка почты
автоматически станут быстрее.

В эталонной системе тяжёлая сборка назначена на `p-cores ssd`:

```text
mail-client/thunderbird → p-cores ssd
```

`p-cores` задаёт CPU affinity для сборки, а `ssd` направляет большое build
tree в SSD-backed `PORTAGE_TMPDIR` (`/var/tmp/portage-disk` на Btrfs), а не в
tmpfs. Это локальное
решение для тяжёлой Mozilla-сборки, а не общее требование Gentoo.

## Provider setup

В reference setup используются шесть IMAP-аккаунтов: четыре Gmail, один
Yandex и один Mail.ru. Не помещай адреса, OAuth tokens, app passwords или
сохранённые учётные данные в документацию.

| Provider | Настройка |
|----------|-----------|
| Gmail | IMAP `imap.gmail.com:993` с SSL/TLS и Gmail SMTP; OAuth2. Gmail хранит отправленное на сервере, поэтому в reference setup выключен Thunderbird option `Place a copy in` для папки Sent. |
| Yandex | IMAP/SMTP с паролем приложения или другим поддерживаемым провайдером способом аутентификации внешнего клиента. |
| Mail.ru | IMAP/SMTP с паролем для внешнего приложения или другим поддерживаемым провайдером способом аутентификации. |

Для Yandex и Mail.ru используй текущие параметры подключения провайдера; этот
пример не фиксирует серверы и порты. Приём отправки и получения проверен для
всех шести аккаунтов.

## Runtime verification

Открой **Help → Troubleshooting Information** (`about:support`) и проверь
фактически выбранные backend и renderer. В acceptance эталонной системы были
зафиксированы:

| Поле `about:support` | Результат |
|----------------------|-----------|
| Window Protocol | `wayland` |
| Desktop Environment | `niri` |
| Compositing | `WebRender` |
| GPU | Intel Iris Xe ADL GT2 через Mesa `iris` |
| Audio Backend | `pulse-rust`, работающий через текущий PipeWire/Pulse stack |

`USE=-hwaccel` означает, что Gentoo не инжектирует force-enable prefs. Это не
запрещает Thunderbird самостоятельно включить WebRender: resolver reference
system показывает `-hwaccel`, а `about:support` — `Compositing: WebRender`.
Поэтому включать `USE=hwaccel` на этой системе сейчас не требуется.

## Profile and storage

Бери точный каталог из **about:support → Profile Directory**. В эталонной
системе профиль расположен под шаблонным путём:

```text
~/.config/thunderbird/<profile>.default-release
```

При последнем измерении профиль занимал около 648 MiB, каталог `ImapMail` —
около 574 MiB. Полная offline synchronization всех сообщений оставлена
включённой: фактический размер не создаёт проблем на этой системе. Эти размеры
зависят от объёма почты и не являются ориентиром для других профилей.

## Working policy

Для шести аккаунтов эталонной системы приняты следующие настройки:

- Unified Folders включены; список сообщений сгруппирован по threads и
  отсортирован по Date descending.
- Полная offline synchronization включена; Global Search включён.
- Встроенные adaptive spam controls Thunderbird выключены для всех аккаунтов;
  фильтрацию спама выполняют провайдеры.
- Remote content глобально заблокирован.
- Автоматическое destructive retention не настроено.
- End-to-End Encryption не настроено: OpenPGP keys и S/MIME certificates не
  добавлялись. Настраивай его только при наличии реального workflow.
- Return Receipts: не запрашивать исходящие receipts автоматически; на
  входящий запрос отвечать через `Ask me`.
- Пользовательское уведомление и звук включены только для двух выбранных Gmail;
  остальные аккаунты синхронизируются без уведомления. В профиле для этого
  установлен `NTFNTF: Notify on This Folder Not That Folder` 1.3.1.

## Desktop notifications

Для проверенного system notification path нужен установленный
`x11-libs/libnotify`. Текущий Gentoo ebuild Thunderbird предлагает его через
`optfeature "desktop notifications"`, без обязательного `RDEPEND`, поэтому
эталонная система сохраняет libnotify как explicit world package. Устройство
стека и проверка Portage — в [руководстве по уведомлениям](../../desktop/notifications/).

В Thunderbird включены **Show an alert**, **Use the system notification** и
**Play a sound**. NTFNTF 1.3.1 задаёт policy двух выбранных Gmail с
**Name & Message**; остальные аккаунты синхронизируются тихо.

На этой системе до установки libnotify письмо приходило и NTFNTF воспроизводил
звук, но визуального уведомления не было. Прямой вызов
`nsIAlertsService.showAlert` завершался
`NS_ERROR_FAILURE [nsIAlertsService.showAlert]`, а `dbus-monitor` не видел
`org.freedesktop.Notifications.Notify`. После установки libnotify backend test
дошёл до `Notify` с app `Thunderbird` и summary `Thunderbird backend test`,
и Noctalia показала уведомление. Это установленная причина данного случая,
а не универсальное объяснение всех сбоев уведомлений Thunderbird.

## Acceptance checklist

- [x] Native Wayland — PASS.
- [x] WebRender — PASS.
- [x] Audio — PASS.
- [x] Отправка и получение проверены для настроенных провайдеров — PASS.
- [x] Gmail сохраняет одну копию письма в Sent — PASS.
- [x] Локальное offline-хранилище присутствует.
- [x] 2026-10-07: два выбранных Gmail — звук + визуальное уведомление PASS.
- [x] 2026-10-07: остальные аккаунты — тихая синхронизация без звука и
  визуального уведомления PASS.
