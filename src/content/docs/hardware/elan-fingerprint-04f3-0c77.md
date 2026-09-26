---
title: Сканер отпечатков ELAN 04f3:0c77 в Gentoo
kind: guide
scope: general
status: current
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

Сканер отпечатков ELAN:ARM-M4 с USB ID `04f3:0c77` работает в Gentoo с
`fprintd`, если применить к пакету `sys-auth/libfprint` серию из 11 патчей
из [Alexys829/elan-0c77-libfprint](https://github.com/Alexys829/elan-0c77-libfprint).
Запись и проверка отпечатка подтверждены на ASUS ExpertBook B5402. Штатный
`libfprint-1.94.7` это устройство не поддерживает.

## Применимость

Инструкция относится к устройству, которое определяется так:

```text
04f3:0c77 Elan Microelectronics Corp. ELAN:ARM-M4
```

На проверенной системе USB-интерфейс имеет класс Vendor Specific Class,
номер интерфейса 0 и не использует драйвер ядра. До настройки fingerprint
stack отсутствовал. Процедура проверена в Gentoo на ASUS ExpertBook B5402;
другие системы с таким же USB ID не проверялись.

## Установка пакетов Gentoo

Установи штатные пакеты через Portage:

```bash
doas emerge --ask dev-libs/libgusb sys-auth/libfprint sys-auth/fprintd
```

На проверенной системе установлены `dev-libs/libgusb-0.4.9`,
`sys-auth/libfprint-1.94.7` и `sys-auth/fprintd-1.94.3-r1`.

## Применение patchset для libfprint

Пользовательские патчи Gentoo хранят изменения отдельно от исходников пакета
и применяют их при обычной сборке Portage. Каталог привязан к версии
`libfprint-1.94.7`:

```text
/etc/portage/patches/sys-auth/libfprint-1.94.7/
```

Склонируй patchset, проверь `patches/series` и убедись, что там перечислены
все 11 патчей в исходном порядке. Скопируй всё содержимое `patches/`, включая
`series`, в версионный каталог Portage:

```bash
git clone https://github.com/Alexys829/elan-0c77-libfprint.git /tmp/elan-0c77-libfprint
cat /tmp/elan-0c77-libfprint/patches/series
doas install -d /etc/portage/patches/sys-auth/libfprint-1.94.7
doas cp -a /tmp/elan-0c77-libfprint/patches/. /etc/portage/patches/sys-auth/libfprint-1.94.7/
```

Сохрани порядок из `patches/series`. Проверенная сборка успешно применила
полную серию. Конкретный upstream commit SHA здесь не зафиксирован.

Пересобери пакет через Portage:

```bash
doas emerge --ask --oneshot =sys-auth/libfprint-1.94.7
```

Не устанавливай вручную собранную библиотеку в `/usr`: установленным пакетом
должен управлять Portage, который и применяет пользовательский patchset.

## Запись и проверка отпечатка

Убедись, что `fprintd` видит сканер, затем запиши и проверь палец. Замени
`YOUR_USER` именем учётной записи:

```bash
fprintd-list YOUR_USER
fprintd-enroll -f right-index-finger YOUR_USER
fprintd-verify -f right-index-finger YOUR_USER
```

На проверенной системе `fprintd` сообщил:

```text
found 1 devices
Device at /net/reactivated/Fprint/Device/0
Elan MOC Sensors
```

Запись `right-index-finger` завершилась успешно. Первая проверка после
неудачного сканирования вернула `verify-retry-scan` и `verify-no-match`, а
следующие две — `verify-match`.

### Известное наблюдение

После неудачного совпадения появлялось сообщение:

```text
Failed to query prints: Slot 0 returned status 0xff while listing
```

С этой прошивкой и patchset запрос списка может завершиться ошибкой вместо
возврата неполного списка отпечатков. Это не даёт `fprintd` принять локальные
отпечатки за отсутствующие и удалить их. Записанный отпечаток сохранился, а
последующие проверки завершились совпадением. Это известное наблюдение, а не
блокирующая проблема.

## Интеграция с рабочим столом и аутентификацией

Добавляй fingerprint только в PAM-сервис или приложение, которому он нужен.
Оставляй доступным обычный парольный путь.

### Экран блокировки Noctalia

Noctalia v5 использует собственную интеграцию с `fprintd`/D-Bus для экрана
блокировки. Разблокировка отпечатком подтверждена. Для этой интеграции не
нужна запись `pam_fprintd`.

### greetd и tuigreet

Для входа `greetd + tuigreet → niri-session` добавь fingerprint auth в начало
`/etc/pam.d/greetd`, перед существующим стеком `login`:

```text
auth            sufficient      pam_fprintd.so timeout=10
auth            include         login
account         include         login
password        include         login
session         include         login
```

Вход по отпечатку на проверенной системе подтверждён. Стек `login` остаётся
после строки fingerprint; парольный fallback отдельно во время работы не
проверялся.

### doas

Добавь fingerprint auth локально в `/etc/pam.d/doas`, перед существующим
стеком `system-auth`:

```text
#%PAM-1.0
auth            sufficient      pam_fprintd.so timeout=10
auth            include         system-auth
account         include         system-auth
session         include         system-auth
```

Аутентификация `doas` по отпечатку подтверждена. Оставь изменение в PAM-файле
`doas`; для этой интеграции не добавляй `pam_fprintd` в общий стек
`system-auth`.

### polkit

Создай локальный PAM override `/etc/pam.d/polkit-1`; vendor-файл
`/usr/lib/pam.d/polkit-1` не меняй:

```text
#%PAM-1.0

auth       sufficient   pam_fprintd.so timeout=10
auth       include      system-auth
account    include      system-auth
password   include      system-auth
session    include      system-auth
```

Штатное правило polkit для администратора выбирает `unix-user:0` (root). Если
отпечаток записан у обычной интерактивной учётной записи, создай локальное
правило `/etc/polkit-1/rules.d/49-local-admin.rules`, которое указывает эту
учётную запись:

```js
polkit.addAdminRule(function(action, subject) {
    return ["unix-user:YOUR_USER"];
});
```

Замени `YOUR_USER` на нужную локальную учётную запись администратора. Это
изменение политики выбора администратора polkit, а не только настройка
fingerprint prompt. Перед применением оцени последствия для доступа. На
проверенной системе подтверждены fingerprint-аутентификация polkit, парольный
fallback и успешный запуск `pkexec /usr/bin/id`.

## Проверка

Проверь обнаружение устройства и запись командами `fprintd-list`,
`fprintd-enroll` и `fprintd-verify`, приведёнными выше. Затем отдельно проверь
каждую настроенную интеграцию: экран блокировки Noctalia, вход greetd по
отпечатку, `doas` и действие polkit. Если парольный fallback требуется,
проверь его отдельно для каждого PAM-сервиса: успешная fingerprint-проверка
сама по себе не подтверждает fallback.

## Откат

Перед изменением PAM-файлов или правила polkit сохрани их текущие версии и
оставь открытой административную сессию.

- Чтобы отключить интеграцию сервиса, удали строку `pam_fprintd.so` из
  `/etc/pam.d/greetd` или `/etc/pam.d/doas`.
- Удали локальные override `/etc/pam.d/polkit-1` и правило
  `/etc/polkit-1/rules.d/49-local-admin.rules`, чтобы вернуть vendor PAM-файл
  и штатное правило администратора polkit.
- Чтобы убрать поддержку устройства, удали версионный каталог патчей и
  принудительно пересобери пакет через Portage:

  ```bash
  doas emerge --ask --oneshot --rebuild =sys-auth/libfprint-1.94.7
  ```

  Пакет без патчей не поддерживает `04f3:0c77`.
- Удали сохранённый отпечаток командой `fprintd-delete -f
  right-index-finger YOUR_USER`, если он больше не нужен.

## Ссылки

- [Patchset ELAN 04f3:0c77 для libfprint](https://github.com/Alexys829/elan-0c77-libfprint)
- [Обсуждение ELAN fingerprint](https://github.com/depau/elanpoc/issues/2)
- [Обсуждение Linux Surface](https://github.com/linux-surface/linux-surface/issues/1380)
- [Gentoo Wiki: Portage](https://wiki.gentoo.org/wiki/Portage)

Результаты проверки на ASUS B5402 приведены в документе
[о состоянии fingerprint на этой системе](../../systems/asus-b5402/hardware/fingerprint/).
