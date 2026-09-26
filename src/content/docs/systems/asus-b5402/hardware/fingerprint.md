---
title: Сканер отпечатков ELAN на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

## Текущее состояние

- Сканер: `04f3:0c77 Elan Microelectronics Corp. ELAN:ARM-M4`; USB-интерфейс
  класса Vendor Specific Class, интерфейс 0, без драйвера ядра.
- Установленные пакеты: `dev-libs/libgusb-0.4.9`,
  `sys-auth/libfprint-1.94.7`, `sys-auth/fprintd-1.94.3-r1`.
- Патчи Portage: `/etc/portage/patches/sys-auth/libfprint-1.94.7/`; применена
  полная серия из 11 патчей `patches/series` от Alexys829.
- Обнаружение устройства через `fprintd`, запись `right-index-finger` и
  последующая проверка: успешно.
- Разблокировка экрана Noctalia v5 по отпечатку: успешно.
- Вход через greetd по отпечатку: успешно.
- Аутентификация `doas` по отпечатку: успешно.
- Аутентификация polkit по отпечатку и парольный fallback: успешно.
- KeePassXC Linux Quick Unlock через polkit/отпечаток: PASS. Для текущего
  `app-admin/keepassxc-2.8.0_pre20260629-r1` нужен однострочный патч Portage,
  привязанный к версии пакета, для регистрации D-Bus metatype.
- Общий `system-auth` не менялся; PAM настроен локально для соответствующих
  сервисов. Noctalia использует собственную интеграцию с `fprintd`/D-Bus.

Указанное состояние проверено 2026-09-27. Парольный fallback greetd отдельно
во время работы не проверялся.

## Результаты проверки

Запись auditd подтверждает успешную аутентификацию через отпечаток в doas;
имя локальной учётной записи заменено шаблоном:

```text
op=PAM:authentication grantors=pam_fprintd acct="<user>" exe="/usr/bin/doas" res=success
```

## Известное наблюдение

После неудачного совпадения отпечатка при запросе списка появлялось сообщение
`Slot 0 returned status 0xff while listing`. С этой прошивкой и patchset такой
сбой не позволяет вернуть неполный список, из-за которого `fprintd` мог бы
удалить локальные отпечатки. Записанный отпечаток сохранился, а последующая
проверка завершилась совпадением. Это не мешало работе.

## Связанные документы

- [Руководство по ELAN 04f3:0c77 в Gentoo](../../../../hardware/elan-fingerprint-04f3-0c77/)
- [KeePassXC Quick Unlock: ошибка polkit/D-Bus](../../../../troubleshooting/keepassxc-quick-unlock-polkit/)
