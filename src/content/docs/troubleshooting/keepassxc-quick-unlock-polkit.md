---
title: "KeePassXC Quick Unlock: ошибка QMap при polkit-аутентификации"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Текущий способ решения

Ошибка `Marshalling failed: Unregistered type QMap<QString,QString> passed in arguments` возникала в Linux Quick Unlock на `app-admin/keepassxc-2.8.0_pre20260629-r1`: KeePassXC не регистрировал `QMap<QString, QString>` как D-Bus metatype перед вызовом polkit.

В текущем Gentoo `app-admin/keepassxc-2.8.0` нужная регистрация уже входит в ebuild. Он применяет `keepassxc-2.8.0-polkit-register-details.patch`, который вызывает `qDBusRegisterMetaType<QMap<QString, QString>>()`. Если установлен старый snapshot, обновись до `app-admin/keepassxc-2.8.0`. Локальный patch для snapshot переносить не нужно: он хранится в каталоге, привязанном к `2.8.0_pre20260629-r1`, и не является частью текущей настройки.

## История ошибки

### Симптом и причина

На `2.8.0_pre20260629-r1` Linux Quick Unlock завершался сообщением:

```text
Failed to authenticate with Quick Unlock: Polkit returned an error:
Marshalling failed: Unregistered type QMap<QString,QString> passed in arguments
```

Сборка snapshot была основана на upstream commit [`ce28e2afb7a59ab5c4b64512b7119eec4a9f2008`](https://github.com/keepassxreboot/keepassxc/commit/ce28e2afb7a59ab5c4b64512b7119eec4a9f2008). KeePassXC не мог сериализовать аргумент `details` вызова polkit `CheckAuthorization`, потому что Qt не знал тип `QMap<QString, QString>` как D-Bus metatype. Ошибка происходила внутри KeePassXC до проверки polkit/PAM, поэтому работавшие отдельно сканер и polkit не устраняли её.

Настройки polkit не были причиной ошибки: policy `/usr/share/polkit-1/actions/org.keepassxc.KeePassXC.policy` присутствовал, а действие `org.keepassxc.KeePassXC.unlockDatabase` использовало `implicit active: auth_self`.

Сбой происходил раньше — при сериализации аргумента `details` внутри KeePassXC.

### Старый workaround для `2.8.0_pre20260629-r1`

Для snapshot-версии локальный Portage patch добавлял вызов:
`qDBusRegisterMetaType<QMap<QString, QString>>()` в регистрацию типов polkit.
Путь старого файла:
`/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1/01-fix-quick-unlock-qmap-dbus.patch`.

После пересборки snapshot с локальным patch Quick Unlock снова работал через polkit и `pam_fprintd`.

Этот workaround относится только к `2.8.0_pre20260629-r1`; в Gentoo `2.8.0` нужное исправление уже входит в ebuild.

## Проверка Quick Unlock

При запуске Quick Unlock KeePassXC должен запросить polkit-аутентификацию. Проверь, что polkit проходит настроенную fingerprint- или парольную аутентификацию и что ошибка `Unregistered type QMap<QString,QString>` больше не появляется.

Если нужно проверить путь через auditd, успешная fingerprint-аутентификация polkit helper выглядит так:

```text
op=PAM:authentication grantors=pam_fprintd acct="<user>" exe="/usr/lib/polkit-1/polkit-agent-helper-1" res=success
```

`<user>` — placeholder для имени локальной учётной записи. Такая запись подтверждает PAM-аутентификацию helper, но сама по себе не доказывает успешный Quick Unlock: проверь также результат в KeePassXC.

## Ссылки

- [Upstream PR KeePassXC #13848](https://github.com/keepassxreboot/keepassxc/pull/13848)
- [Upstream PR KeePassXC #13089](https://github.com/keepassxreboot/keepassxc/pull/13089)
- [ELAN 04f3:0c77: руководство по сканеру](../../hardware/elan-fingerprint-04f3-0c77/)
- [Состояние сканера на ASUS B5402](../../systems/asus-b5402/hardware/fingerprint/)
