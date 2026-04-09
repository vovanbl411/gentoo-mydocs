# Настройка MAC-рандомизации и iwd в NetworkManager (Gentoo)

## Содержание
1. [Цель](#цель)
2. [Исходная проблема](#исходная-проблема)
3. [Пошаговое решение](#пошаговое-решение)
4. [Проверка работы](#проверка-работы)
5. [Теория и пояснения](#теория-и-пояснения)
6. [Устранение неполадок](#устранение-неполадок)

---

## Цель

Настройка NetworkManager для:
- Использования **iwd** вместо wpa_supplicant (быстрее переподключается, стабильнее)
- Включения **рандомизации MAC-адреса** при сканировании сетей
- Использования **стабильного/случайного MAC** при подключении (защита приватности)

---

## Исходная проблема

### Конфликт конфигураций
Системный файл `/usr/lib/NetworkManager/conf.d/31-mac-addr-change.conf` переопределял пользовательские настройки:

```ini
# Системный конфиг (защита проблемных драйверов)
wifi.scan-rand-mac-address=no
wifi.cloned-mac-address=preserve
```

**Проблема:** Параметры применялись ко всем устройствам, хотя предназначались только для драйверов `eagle_sdio` и `wl` (Broadcom).

### Устаревший параметр
```ini
# НЕ ИСПОЛЬЗОВАТЬ — устаревший синтаксис
[connection]
wifi.mac-address-randomization=2
```

---

## Пошаговое решение

### Шаг 1: Проверка драйвера Wi-Fi

**Важно:** Убедитесь, что у вас не проблемный драйвер (`eagle_sdio`, `wl`).

```bash
lspci -k | grep -A3 "Network controller"
```

**Пример вывода (Intel AX201 — поддерживается):**
```
00:14.3 Network controller: Intel Corporation Alder Lake-P PCH CNVi WiFi (rev 01)
    DeviceName: Onboard - Ethernet
    Subsystem: Intel Corporation Dual Band Wi-Fi 6(802.11ax) AX201 160MHz 2x2 [Harrison Peak]
    Kernel driver in use: iwlwifi
```

**Поддерживаемые драйверы** (можно отключать 31-mac-addr-change.conf):
- `iwlwifi` (Intel) — ✅ рекомендуется
- `mt76` (MediaTek) — ✅
- `ath10k`, `ath9k`, `ath11k` (Atheros/Qualcomm) — ✅
- `rtl8xxxu`, `rtw88`, `rtw89` (Realtek) — ✅

**Проблемные драйверы** (нужен 31-mac-addr-change.conf):
- `wl` (Broadcom проприетарный) — ❌ не поддерживает смену MAC
- `eagle_sdio` — ❌ редкий, встроенный

### Шаг 2: Отключение конфликтующего системного конфига

```bash
# Создаём пустой файл-заглушку (маскируем системный)
sudo touch /etc/NetworkManager/conf.d/31-mac-addr-change.conf

# Или с комментарием:
echo "# Disabled: iwlwifi supports MAC randomization" | sudo tee /etc/NetworkManager/conf.d/31-mac-addr-change.conf
```

**Почему нельзя использовать symlink на /dev/null:**
NetworkManager проверяет `stat()` и отказывается читать не-regular файлы.

### Шаг 3: Настройка iwd как backend

```bash
sudo nano /etc/NetworkManager/conf.d/wifi-backend.conf
```

Содержимое:
```ini
[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
```

**Почему iwd:**
- Быстрее переподключается к известным сетям (~1 сек vs ~5-10 сек у wpa_supplicant)
- Лучше работает с Enterprise-сетями (WPA2-Enterprise, 802.1X)
- Меньше потребление памяти
- Современный кодовая база (написан на C, использует kernel API напрямую)

### Шаг 4: Настройка MAC-рандомизации

```bash
sudo nano /etc/NetworkManager/conf.d/99-mac-privacy.conf
```

**Вариант A: Стабильный MAC (рекомендуется)**
```ini
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
connection.stable-id=${CONNECTION}/${BOOT}
```

**Вариант B: Случайный MAC (максимальная приватность)**
```ini
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=random
ethernet.cloned-mac-address=random
```

**Вариант C: Стабильный на основе SSID (баланс)**
```ini
[connection]
wifi.cloned-mac-address=stable-ssid
```

### Шаг 5: Перезапуск и проверка

```bash
sudo systemctl restart NetworkManager

# Проверка конфигурации
NetworkManager --print-config | grep -E "wifi\."

# Ожидаемый вывод:
# wifi.backend=iwd
# wifi.scan-rand-mac-address=yes
# wifi.cloned-mac-address=stable
# ethernet.cloned-mac-address=stable
```

---

## Проверка работы

### Проверка 1: Текущий MAC-адрес

```bash
# Аппаратный (постоянный) MAC
ethtool -P wlan0

# Текущий (может быть рандомизирован)
ip link show wlan0
```

**Пример успеха:**
```bash
$ ethtool -P wlan0
Permanent address: 8c:c6:81:xx:xx:xx  # Intel OUI

$ ip link show wlan0
link/ether 92:4a:xx:xx:xx:xx  # Другой MAC → рандомизация работает!
```

### Проверка 2: Используемый backend

```bash
# Должно показать iwd
NetworkManager --print-config | grep backend

# Или через nmcli
nmcli -f GENERAL.DEVICE,GENERAL.TYPE,GENERAL.DRIVER device show wlan0
```

### Проверка 3: Статус iwd

```bash
systemctl status iwd

# iwd должен быть active (running)
# NetworkManager запускает его автоматически через D-Bus
```

---

## Теория и пояснения

### Уровни рандомизации MAC

| Уровень | Параметр | Когда меняется | Use case |
|---------|----------|---------------|----------|
| Сканирование | `wifi.scan-rand-mac-address` | Каждое сканирование | Защита от трекинга при поиске сетей |
| Подключение (stable) | `wifi.cloned-mac-address=stable` | При каждой загрузке для данной сети | Баланс приватности и удобства (рекомендуется) |
| Подключение (random) | `wifi.cloned-mac-address=random` | Каждое подключение | Максимальная приватность |
| Подключение (stable-ssid) | `wifi.cloned-mac-address=stable-ssid` | Зависит от SSID | Один MAC для дома, другой для работы |
| Подключение (preserve) | `wifi.cloned-mac-address=preserve` | Никогда | Сохраняет вручную заданный MAC |

### Порядок загрузки конфигов NetworkManager

1. `/etc/NetworkManager/NetworkManager.conf`
2. `/usr/lib/NetworkManager/conf.d/*.conf`
3. `/etc/NetworkManager/conf.d/*.conf` (последний wins внутри группы)
4. `/run/NetworkManager/conf.d/*.conf` (временные, highest priority)

**Проблема:** `/usr/lib/NetworkManager/conf.d/` сканируется **после** `/etc/NetworkManager/conf.d/`, поэтому `31-*` перезаписывает `99-*`!

**Решение:** Создать файл с тем же именем в `/etc/` — он заменит системный.

### Устаревшие параметры

| Устаревший | Современный | Примечание |
|------------|-------------|------------|
| `wifi.mac-address-randomization=0\|1\|2` | `wifi.cloned-mac-address` | 0=default, 1=never, 2=always |
| `wifi.mac-address-randomization` в `[device]` | `wifi.scan-rand-mac-address` | Разделение сканирования и подключения |

---

## Устранение неполадок

### Проблема: `Failed to read configuration: Not a regular file`

**Причина:** Использован symlink на `/dev/null`.

**Решение:**
```bash
sudo rm /etc/NetworkManager/conf.d/31-mac-addr-change.conf
sudo touch /etc/NetworkManager/conf.d/31-mac-addr-change.conf
```

### Проблема: Wi-Fi не подключается после смены MAC

**Причина:** Captive portal или MAC-фильтрация на роутере.

**Решение:** Использовать `stable` вместо `random`:
```ini
wifi.cloned-mac-address=stable
```

### Проблема: iwd не запускается

**Проверка:**
```bash
# Должен быть установлен
emerge -qv net-wireless/iwd

# Не должен быть включен как сервис (NM управляет им)
sudo systemctl disable iwd  # если был включен
```

### Проблема: Конфликт с systemd-networkd

**Симптом:** Соединения в `/run/NetworkManager/system-connections/`.

**Решение:** Отключить systemd-networkd для Wi-Fi:
```bash
sudo systemctl disable systemd-networkd
# или
sudo systemctl mask systemd-networkd-wait-online.service
```

---

## Итоговая конфигурация

### Файлы

```
/etc/NetworkManager/
├── NetworkManager.conf          # [main] plugins=keyfile
├── conf.d/
│   ├── 31-mac-addr-change.conf  # ПУСТОЙ (маскирует системный)
│   ├── wifi-backend.conf        # iwd + scan rand MAC
│   └── 99-mac-privacy.conf      # stable MAC для подключений
```

### Содержимое файлов

**`/etc/NetworkManager/NetworkManager.conf`:**
```ini
[main]
plugins=keyfile
```

**`/etc/NetworkManager/conf.d/wifi-backend.conf`:**
```ini
[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
```

**`/etc/NetworkManager/conf.d/99-mac-privacy.conf`:**
```ini
[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
connection.stable-id=${CONNECTION}/${BOOT}
```

**`/etc/NetworkManager/conf.d/31-mac-addr-change.conf`:**
```ini
# Masked: iwlwifi driver supports MAC randomization
# Original file: /usr/lib/NetworkManager/conf.d/31-mac-addr-change.conf
```

---

## Полезные команды

```bash
# Мониторинг изменений MAC
watch -n 1 ip link show wlan0

# Просмотр логов NM
journalctl -u NetworkManager -f

# Просмотр логов iwd
journalctl -u iwd -f

# Список всех конфигов с приоритетами
NetworkManager --print-config

# Информация о текущем соединении
nmcli connection show --active

# Ручная смена MAC (тестирование)
sudo ip link set wlan0 down
sudo ip link set wlan0 address 92:4a:00:00:00:01
sudo ip link set wlan0 up
```

---

**Дата:** 2026-03-03  
**Окружение:** Gentoo Linux, NetworkManager 1.4x+, iwd 2.x
