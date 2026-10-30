---
title: Сканер отпечатков ELAN на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Текущее состояние

- В ASUS ExpertBook B5402 используется сканер `04f3:0c77 Elan Microelectronics Corp. ELAN:ARM-M4`. Его обслуживают `sys-auth/libfprint` и `sys-auth/fprintd`; для поддержки этого устройства нужен аппаратный patchset ELAN для libfprint.
- Для установленного `sys-auth/libfprint-1.94.7` настроен каталог `/etc/portage/patches/sys-auth/libfprint-1.94.7/`; применяется полная серия из 11 патчей `patches/series` от Alexys829. В частности, `10-elanmoc-list-never-under-report.patch` не даёт вернуть неполный список отпечатков как успешный.
- `fprintd` обнаруживает сканер; в списке для пользователя сохранён `right-index-finger`. Сервис запускается по запросу и после проверки списка отпечатков не остаётся активным.
- Отпечаток настроен для аутентификации через greetd, doas и polkit. PAM-конфигурация polkit сначала вызывает `pam_fprintd`, затем включает `system-auth`. Noctalia использует собственную интеграцию с `fprintd`/D-Bus.
- KeePassXC Linux Quick Unlock обращается к polkit, где настроена fingerprint-аутентификация. В текущем `app-admin/keepassxc-2.8.0` нужную регистрацию D-Bus metatype поставляет Gentoo ebuild; отдельный локальный патч для старой snapshot-версии этому пакету не нужен. Подробности и история ошибки — в [разборе Quick Unlock и polkit](../../../../troubleshooting/keepassxc-quick-unlock-polkit/).

Общий PAM `system-auth` не менялся: вызовы `pam_fprintd` настроены в отдельных файлах PAM для greetd, doas и polkit.

## Ошибка чтения слота

`Slot 0 returned status 0xff while listing` означает ошибку чтения одного из слотов сканера. Используемый patchset libfprint не возвращает неполный список отпечатков как успешный, чтобы `fprintd` не принял его за полный и не удалил отсутствующие записи.

Сам статус `0xff` не объясняет причину ошибки со стороны сканера.

## Связанные документы

- [Руководство по ELAN 04f3:0c77 в Gentoo](../../../../hardware/elan-fingerprint-04f3-0c77/)
- [KeePassXC Quick Unlock: ошибка polkit/D-Bus](../../../../troubleshooting/keepassxc-quick-unlock-polkit/)
