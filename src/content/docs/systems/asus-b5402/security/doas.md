---
title: Политика doas на ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

## Current state

- Группа `wheel` выполняет команды с `persist`.
- Окружение сохраняется для локального пользователя.
- Отдельно разрешён запуск `snapper`.

## Configuration

Действующая конфигурация — `/etc/doas.conf` на машине. Точные строки не
публикуются: имя пользователя не раскрывается.

## Verification

- Политика подтверждена сверкой с `/etc/doas.conf` 2026-09-22.
- PAM fingerprint authentication через `doas` проверена 2026-09-27; изменение
  находится в `/etc/pam.d/doas`, общий `system-auth` не изменялся.

## Related docs

- [doas: конфигурация](../../../../security/doas-configuration/) — общая
  конфигурация и параметры.
- [ELAN fingerprint на ASUS B5402](../../hardware/fingerprint/) — состояние
  устройства и проверенные интеграции.
