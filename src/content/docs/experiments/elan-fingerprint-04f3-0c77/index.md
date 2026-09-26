---
title: История эксперимента ELAN 04f3:0c77
kind: reference
scope: system
status: historical
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

Эксперимент с ELAN `04f3:0c77` завершён 2026-09-27. Этот URL сохранён для
исторических ссылок; страница больше не является инструкцией.

Ранее проверявшийся quirk-based подход не учитывал различия протокола
прошивки `04f3:0c77`. Рабочая поддержка получена через актуальный patchset для
Gentoo `sys-auth/libfprint`, установленный штатно через Portage. Старые
инструкции с `xerootg/libfprint`, ручным редактированием драйвера, перебором
quirks, `ninja install` и отдельным udev-правилом больше не являются текущей
процедурой.

- [Действующее руководство для Gentoo](../../hardware/elan-fingerprint-04f3-0c77/)
- [Состояние ASUS ExpertBook B5402](../../systems/asus-b5402/hardware/fingerprint/)

Исторические обсуждения: [Linux Surface](https://github.com/linux-surface/linux-surface/issues/1380),
[depau/elanpoc](https://github.com/depau/elanpoc/issues/2).
