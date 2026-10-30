---
title: Политика doas на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Текущее состояние

На ASUS B5402 правила `doas` заданы в `/etc/doas.conf`: правило для `:wheel`
задаёт `persist`, для локального пользователя отдельно задан `keepenv`, а для
`snapper` есть отдельное command-specific правило с `persist`. Fingerprint
authentication подключена в `/etc/pam.d/doas`; общий `system-auth` не содержит
вызова `pam_fprintd.so`.

## Конфигурация

Файл: `/etc/doas.conf`

Фактические правила без имени пользователя:

```text
permit persist :wheel
permit keepenv <username>
permit persist :wheel as root cmd snapper
```

Правило `snapper` не использует `nopass`; в конфигурации оно указывает команду
как `snapper`, установленную в `/usr/bin/snapper`. Значение `persist`,
`keepenv`, `nopass` и семантика последнего совпавшего правила описаны в
[общем руководстве по doas](../../../../security/doas-configuration/).

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
