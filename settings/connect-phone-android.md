# Подключение Android-телефона через USB к Gentoo Linux

## Что такое MTP и зачем он нужен?

**MTP** (Media Transfer Protocol) – протокол для передачи медиафайлов между устройствами. На Android используется при подключении по USB в режиме «Передача файлов».

В отличие от USB-флешки, MTP не даёт прямого доступа к файловой системе телефона. Он работает через **сессии**: телефон сам решает, какие файлы показывать. Это безопаснее, но менее надёжно: сессия сбрасывается при блокировке экрана, смене режима USB или ошибках авторизации.

**Почему MTP часто «ломается» в Linux?**

- Требует разблокированного экрана и явного разрешения доступа.
- Некоторые производители (Vivo, Xiaomi, Oppo, Huawei) используют нестандартные MTP-реализации → ошибки `NULL device`.
- Ядро Linux может блокировать USB-устройство (`usbguard`, отсутствие авторизации).

---

## Типичные проблемы при подключении

- Телефон постоянно переподключается (цикл: подключился → отключился → подключился)
- В `dmesg` ошибка: `Device is not authorized for usage`
- `simple-mtpfs` выдаёт: `LIBMTP PANIC: NULL device!`
- `mtp-detect` показывает: `PTP_ERROR_IO: failed to open session`

### Пример логов (ядро)

```bash
[1456.402150] usb 3-1: Product: Android Phone
[1456.402153] usb 3-1: Manufacturer: ManufacturerName
[1456.402156] usb 3-1: SerialNumber: ABC123
[1456.402624] usb 3-1: Device is not authorized for usage
```

---

## Причины (общие)

1. **Авторизация USB на уровне ядра** – устройство получает `authorized=0`, ядро блокирует его.
2. **usbguard блокирует устройство** – при смене режима (зарядка → MTP → ADB) телефон перерегистрируется, и usbguard видит «новое» устройство и блокирует.
3. **MTP-сессия не открывается**, если:
   - экран заблокирован;
   - не выбран режим «Передача файлов (MTP)»;
   - не нажато «Разрешить» в диалоге доступа к данным.
4. **Библиотека `libmtp` несовместима с конкретной моделью** → ошибка `NULL device` в `simple-mtpfs`.
5. **`gvfs-mtp` перехватывает устройство** – мешает ручному монтированию через `jmtpfs`/`simple-mtpfs`.

---

## Диагностика

### 1. Логи ядра в реальном времени

```bash
dmesg -w
```

Подключите телефон. Ищите:
- `Device is not authorized for usage`
- `usb X-X: Product:`
- `PTP_ERROR_IO`

### 2. Статус авторизации USB

Из `dmesg` узнайте порт (например, `3-1`). Затем:

```bash
cat /sys/bus/usb/devices/3-1/authorized
# 0 – не авторизовано, 1 – авторизовано
```

### 3. VID и PID вашего телефона

```bash
lsusb | grep -i "название вашего телефона"
# Пример вывода: Bus 003 Device 004: ID 2d95:6002 Android Phone
```

Здесь `2d95` – **VID** (Vendor ID), `6002` – **PID** (Product ID). Запомните их.

### 4. Проверка MTP-обнаружения

```bash
sudo emerge --ask mtp-tools   # установка, если нет
mtp-detect
```

Если `PTP_ERROR_IO: failed to open session` – проблема в открытии сессии (экран заблокирован / нет разрешения).

---

## Решение (пошагово)

### Этап 1: Авторизация USB-устройства (ядро)

**Быстрое решение (до перезагрузки):**

```bash
# Замените 3-1 на свой порт из dmesg
echo 1 | sudo tee /sys/bus/usb/devices/3-1/authorized
```

**Постоянное решение (через udev):**

```bash
sudo nano /etc/udev/rules.d/99-android-usb.rules
```
Добавьте строку (замените `2d95` на свой VID):

```bash
# Авторизует все устройства с данным VID
SUBSYSTEM=="usb", ATTR{idVendor}=="2d95", ATTR{authorized}="1"

# Или для конкретных VID+PID:
# SUBSYSTEM=="usb", ATTR{idVendor}=="2d95", ATTR{idProduct}=="6002", ATTR{authorized}="1"
```

Примените правила:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Отключите и подключите телефон заново.

---

### Этап 2: Настройка usbguard (если используется)

Если `usbguard` активен, он блокирует телефон при смене режима. Добавьте разрешение по VID:

```bash
sudo systemctl stop usbguard
echo "allow with-vid 2d95" | sudo tee -a /etc/usbguard/rules.conf
sudo systemctl start usbguard
```

Или сгенерируйте политику без хэшей:

```bash
sudo usbguard generate-policy --no-hashes --no-ports-sn > /etc/usbguard/rules.conf
sudo systemctl restart usbguard
```

---

### Этап 3: Подготовка телефона (обязательно!)

Перед монтированием MTP выполните на телефоне:

1. **Разблокируйте экран** (PIN/пароль/жест).
2. Подключите USB-кабель.
3. Нажмите на уведомление «Зарядка через USB».
4. Выберите **«Передача файлов (MTP)**» (может называться «MTP» или «Передача данных»).
5. Если появится диалог «Разрешить доступ к данным?» – нажмите **«Разрешить»**.
6. Держите экран разблокированным во время монтирования.

---

### Этап 4: Монтирование MTP в Gentoo

> **Примечание от автора:** В соответствии с официальной документацией Gentoo Wiki, предпочтительным инструментом для монтирования MTP-устройств является `sys-fs/mtpfs` (MTPfs). Это FUSE-файловая система, которая предоставляет доступ к MTP-устройствам.

#### Способ 1: `mtpfs` (рекомендуется, основано на официальной документации)

```bash
sudo emerge --ask sys-fs/mtpfs
mkdir -p ~/phone
mtpfs ~/phone
ls ~/phone
fusermount -u ~/phone   # отмонтировать
```

**Важно:** Будьте терпеливы, первое монтирование может занять несколько минут.

#### Способ 2: `gvfs` с поддержкой MTP (для файловых менеджеров GNOME/KDE/Xfce)

Этот метод не требует ручного монтирования через терминал и интегрирован в файловые менеджеры популярных рабочих окружений.

```bash
# Включите USE-флаг "mtp" для пакета gvfs
echo "gnome-base/gvfs mtp" >> /etc/portage/package.use/gvfs
sudo emerge --ask gnome-base/gvfs
```

После этого перезапустите сеанс рабочего стола. Подключите телефон в режиме MTP, и он должен автоматически появиться в боковой панели вашего файлового менеджера (Nautilus, Dolphin, Thunar и т.д.).

#### Способ 3: `simple-mtpfs` (альтернатива, может не работать на некоторых моделях)

```bash
sudo emerge --ask sys-fs/simple-mtpfs
mkdir -p ~/phone
simple-mtpfs --device 1 --mount ~/phone
```

При ошибке `LIBMTP PANIC: NULL device` – попробуйте другой способ.

#### Способ 4: `jmtpfs` (альтернатива, если другие не работают)

```bash
sudo emerge --ask jmtpfs
mkdir -p ~/phone
jmtpfs ~/phone
ls ~/phone
fusermount -u ~/phone
```

#### Способ 5: `adbfs` – через ADB (самый надёжный, не требует MTP)

На телефоне включите **USB-отладку** (режим разработчика). Затем:

```bash
# Установите android-tools, который предоставляет ADB и fastboot
sudo emerge --ask dev-util/android-tools
adb devices   # разрешите доступ на телефоне
mkdir -p ~/phone
adbfs ~/phone
ls ~/phone
fusermount -u ~/phone
```

Этот метод обходит все проблемы MTP.

---

## Чек-лист для быстрого решения (подставьте свой VID и порт)

```bash
# 1. Авторизация USB (порт из dmesg)
echo 1 | sudo tee /sys/bus/usb/devices/3-1/authorized

# 2. Постоянное правило udev
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="2d95", ATTR{authorized}="1"' | sudo tee /etc/udev/rules.d/99-android-usb.rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# 3. usbguard: разрешить VID
sudo systemctl stop usbguard
echo "allow with-vid 2d95" | sudo tee -a /etc/usbguard/rules.conf
sudo systemctl start usbguard

# 4. Подготовка телефона (разблокировать, MTP, разрешить)

# 5. Установка mtpfs и монтирование
sudo emerge --ask sys-fs/mtpfs
mkdir -p ~/phone
mtpfs ~/phone
ls ~/phone
```

---

## Дополнительные советы

### Если телефон всё равно переподключается

- Попробуйте другой USB-кабель (обязательно с поддержкой данных).
- Подключитесь напрямую в USB 2.0 порт (без хаба).
- Если ноутбук от батареи – включите питание от сети (недостаток тока).
- Смотрите `dmesg -w` на предмет ошибок `error -71` или `device not accepting address`.

### Права доступа для ADB (android-tools)

Для работы ADB от имени обычного пользователя необходимо добавить себя в группу `plugdev`:

```bash
sudo gpasswd -a <USER_NAME> plugdev
```

После этого выйдите из системы и зайдите снова, чтобы изменения вступили в силу.

---

## FAQ

**Вопрос:** Откуда взять VID/PID моего телефона?  
**Ответ:** Выполните `lsusb` без аргументов. Найдите строку с вашим телефоном. VID – первое число после `ID`, PID – второе. Например, `ID 18d1:4ee1` → VID=18d1, PID=4ee1.

**Вопрос:** Какой пакет предоставляет ADB в Gentoo?  
**Ответ:** **`dev-util/android-tools`**. Именно он официально поддерживается в Gentoo и включает в себя ADB и fastboot.

**Вопрос:** Почему `simple-mtpfs` выдаёт `NULL device`?  
**Ответ:** Библиотека `libmtp` не смогла инициализировать MTP-сессию. Это часто бывает на телефонах Vivo, Xiaomi, Oppo. Используйте `mtpfs` или `adbfs`.

**Вопрос:** Нужно ли отключать usbguard?  
**Ответ:** Нет, достаточно добавить правило `allow with-vid <ваш ID>`.

**Вопрос:** Можно ли монтировать MTP при заблокированном экране?  
**Ответ:** Нет, сессия не откроется. Экран должен быть разблокирован во время первого монтирования.

**Вопрос:** Какой способ самый надёжный?  
**Ответ:** `adbfs` через ADB. Он не зависит от MTP и работает почти всегда, если включена USB-отладка.

---

## Ссылки на официальную документацию Gentoo Wiki

- [MTPfs](https://wiki.gentoo.org/wiki/MTPfs) — FUSE-файловая система для доступа к MTP-устройствам.  
  *(Используется как основной инструмент для монтирования в данном гайде.)*
- [GVfs](https://wiki.gentoo.org/wiki/GVfs) — Виртуальная файловая система, обеспечивающая интеграцию MTP в файловые менеджеры.  
  *(Рекомендуется для десктопных сред.)*
- [Android Debug Bridge (ADB)](https://wiki.gentoo.org/wiki/Android/adb) — Официальная страница, посвящённая ADB в Gentoo.  
  *(Содержит информацию о пакете `dev-util/android-tools`, настройке udev и прав доступа.)*

---

**Проблемы:**  
- `Device is not authorized for usage` → цикл переподключений  
- `LIBMTP PANIC: NULL device` → `simple-mtpfs` не работает  
- `PTP_ERROR_IO: failed to open session` → экран заблокирован / нет разрешения  

**Решения:**  
1. Авторизация через `/sys/bus/usb/devices/*/authorized` + правило udev  
2. `allow with-id` в usbguard  
3. `mtpfs` (официально рекомендуется) или `adbfs` (самый надёжный) вместо `simple-mtpfs`  
4. Разблокировка экрана + режим MTP + подтверждение доступа
