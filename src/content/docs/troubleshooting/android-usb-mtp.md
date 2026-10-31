---
title: Подключение Android-телефона по USB к Gentoo Linux
kind: troubleshooting
scope: general
status: current
last_verified: null
verified_on: []
---

Проверяй проблему по слоям: USB enumeration → kernel authorization → USBGuard → права userspace → режим MTP/PTP → desktop- или FUSE-клиент. Ошибка на одном уровне сама по себе не доказывает причину на другом.

## 1. Видит ли USB subsystem телефон?

```bash
lsusb
doas journalctl -k -b --no-pager | grep -Ei 'usb|mtp|ptp|authorized|authorization' || true
```

Если телефона нет в `lsusb`, сначала проверь кабель с передачей данных, другой физический порт и подключение напрямую, без проблемного hub или dock. В журнале ищи ошибки enumeration, например `error -71`, `device descriptor read` или `not accepting address`. Пока устройство не появилось на USB-уровне, диагностика MTP преждевременна.

## 2. Авторизовано ли USB-устройство?

Если журнал сообщает `Device is not authorized for usage`, найди имя устройства в kernel log или sysfs и прочитай его состояние. Например, если имя устройства `3-1`:

```bash
cat /sys/bus/usb/devices/3-1/authorized
```

`0` означает, что USB-устройство сейчас не авторизовано; `1` — что оно авторизовано. Это состояние не показывает, какая политика его установила. Сначала выясни, управляет ли им USBGuard, пользовательское udev-правило или другой механизм.

Для USBGuard проверь состояние сервиса, решение для устройства и загруженные правила:

```bash
systemctl is-active usbguard.service
doas usbguard list-devices
doas usbguard list-rules
```

Если USBGuard не показывает решение для телефона, проверь пользовательские udev-правила и другие локальные компоненты, которые могут менять USB authorization:

```bash
grep -R -n 'authorized' /etc/udev/rules.d /usr/lib/udev/rules.d 2>/dev/null || true
```

В `list-devices` найди внутренний ID телефона и его решение. Если устройство заблокировано и ты решил разрешить именно этот экземпляр, команда USBGuard — `doas usbguard allow-device -p <internal-id>`. Флаг `-p` сохраняет решение для конкретного устройства, добавляя соответствующее правило в текущую policy. После команды проверь `list-rules` и `list-devices`: действует первое совпавшее правило, поэтому более ранний общий `block` или `reject` может помешать новому `allow`. Правило USBGuard задаёт VID:PID через `id <vendor-id>:<product-id>`; `with-vid` не является синтаксисом правила.

Не обходи работающий USBGuard записью `authorized=1` или общим udev-правилом на авторизацию. Не останавливай USBGuard и не генерируй заново весь ruleset ради одного телефона. Порядок правил и решения для устройств описаны в [руководстве по USBGuard](../../security/usbguard/).

При переключении телефона между зарядкой, MTP и ADB могут измениться USB descriptors, interfaces или PID; USBGuard может обработать новую конфигурацию отдельно. Это возможное объяснение повторной блокировки, а не универсальное поведение. Если проблема воспроизводится при таком переключении, сравни `lsusb`, `doas usbguard list-devices` и `doas usbguard list-rules` до и после него.

## 3. Есть ли у userspace доступ к устройству?

udev-правило Gentoo-пакета `media-libs/libmtp` задаёт для MTP-устройств группу `plugdev` и режим `0660`. Проверь активные группы пользователя и само правило:

```bash
id
getent group plugdev
grep -R 'plugdev' /usr/lib/udev/rules.d 2>/dev/null | grep -Ei 'mtp|android|usb' || true
```

Сопоставь результат с группой и правами на USB device node. Это проверка доступа для libmtp/MTP, а не универсальное требование для ADB. Правила ADB могут использовать другой способ доступа; проверяй установленное правило, а не добавляй `plugdev` наугад.

В текущем Gentoo tree команда `mtp-detect` входит в `media-libs/libmtp`.

## 4. Выбран ли режим MTP на телефоне?

Для описанного здесь MTP-пути выбери **Передача файлов / File transfer (MTP)**, а не режим передачи фото (PTP). Разблокируй телефон и подтверди доступ к данным, если Android покажет запрос. Поведение при заблокированном экране зависит от устройства и его состояния: держи экран разблокированным для первой проверки, но не считай блокировку доказанной причиной сбоя.

Перед запуском `mtp-detect` проверь, не открыл ли другой клиент MTP-сеанс:

```bash
pgrep -a -f 'gvfs.*mtp|kio.*mtp|mtpfs|jmtpfs|simple-mtpfs' || true
```

Найденный процесс — повод проверить открытый сеанс в соответствующем приложении, но сам по себе он не доказывает, что клиент занял телефон. Закрой сеанс штатно, не завершай процессы автоматически. Если `mtp-detect` установлен, он проверит userspace-обнаружение MTP, открыв собственный MTP-сеанс.

Ошибки `PTP_ERROR_IO` и `NULL device` не указывают на единственную причину. После предыдущих проверок они могут быть связаны с доступом к устройству, занятым MTP-сеансом, режимом или состоянием телефона, реализацией устройства либо проблемой клиента/libmtp. Сопоставь их с наблюдениями предыдущих слоёв и выводом `mtp-detect`.

## 5. Какой клиент открывает MTP?

MTP обычно обслуживает один активный клиент за раз, поэтому desktop automounter и ручной FUSE-клиент могут конфликтовать. Для desktop-интеграции выясни, какой framework использует приложение:

- GIO/GVfs-приложения используют MTP backend `gnome-base/gvfs[mtp]`.
- Dolphin использует отдельный KDE KIO backend из `kde-apps/kio-extras[mtp]`.
- Для других файловых менеджеров проверь документацию их framework и доступный backend.

Для отдельной проверки или если desktop backend недоступен, запусти один ручной FUSE-клиент после закрытия другого MTP-сеанса. Пример с `jmtpfs`:

```bash
mkdir -p ~/phone
jmtpfs ~/phone
ls ~/phone
fusermount -u ~/phone
```

В Gentoo также доступны `sys-fs/mtpfs` и `sys-fs/simple-mtpfs`; если выберешь один из них, сначала проверь справку установленного клиента. Не запускай одновременно несколько MTP-клиентов.

## ADB — отдельный канал

`dev-util/android-tools` предоставляет `adb` и `fastboot`; его USE-флаг `udev` подключает `dev-util/android-udev-rules`. Для ADB на телефоне нужно отдельно включить USB debugging и подтвердить запрос доверия компьютеру. ADB — отдельный канал управления и отладки, он не заменяет MTP backend для файлового менеджера. `android-tools` не предоставляет `adbfs`.

## Источники

- Gentoo: [`media-libs/libmtp`](https://packages.gentoo.org/packages/media-libs/libmtp), [`sys-fs/mtpfs`](https://packages.gentoo.org/packages/sys-fs/mtpfs), [`sys-fs/simple-mtpfs`](https://packages.gentoo.org/packages/sys-fs/simple-mtpfs), [`sys-fs/jmtpfs`](https://packages.gentoo.org/packages/sys-fs/jmtpfs).
- Gentoo: [`gnome-base/gvfs`](https://packages.gentoo.org/packages/gnome-base/gvfs), [`kde-apps/kio-extras`](https://packages.gentoo.org/packages/kde-apps/kio-extras), [`dev-util/android-tools`](https://packages.gentoo.org/packages/dev-util/android-tools).
- Upstream: [USBGuard command](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard.1.adoc) и [язык USBGuard rules](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard-rules.conf.5.adoc); [Linux USB authorization](https://docs.kernel.org/usb/authorization.html).
- Upstream: [libmtp diagnostics](https://github.com/libmtp/libmtp); Android: [передача файлов по USB](https://support.google.com/android/answer/9064445) и [Android Debug Bridge](https://developer.android.com/tools/adb).
