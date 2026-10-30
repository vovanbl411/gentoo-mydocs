---
title: Политика doas на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Текущее состояние

В `/etc/doas.conf` для `:wheel` задано одно правило с `persist` и `keepenv`.
Отдельного правила для конкретного пользователя и отдельного правила для
`snapper` нет; `snapper` использует общую policy `:wheel`. Fingerprint
authentication подключена локально в `/etc/pam.d/doas`; общий `system-auth` не
содержит вызова `pam_fprintd.so`.

## Конфигурация

Файл: `/etc/doas.conf`

Фактические правила без имени пользователя:

```text
permit persist keepenv :wheel
```

Оба параметра находятся в одном правиле, потому что `doas` применяет последнее
совпавшее правило и не объединяет параметры разных правил. Подробности описаны
в [общем руководстве по doas](../../../../security/doas-configuration/).

## Fingerprint authentication

В service-local `/etc/pam.d/doas` для этапа `auth` сначала вызывается
`pam_fprintd.so` с control `sufficient`, затем подключается `system-auth`.
Секции `account` и `session` также включают `system-auth`. Сам
`/etc/pam.d/system-auth` не содержит вызова `pam_fprintd.so`. Настройка
fingerprint и поддерживаемое устройство описаны в
[системной странице сканера ELAN](../../hardware/fingerprint/).

## Связанные документы

- [doas: конфигурация](../../../../security/doas-configuration/) — общие
  параметры и семантика правил.
- [Сканер отпечатков ELAN на ASUS B5402](../../hardware/fingerprint/) —
  состояние устройства и его интеграции.
