---
title: Настройка MAC-рандомизации и iwd в NetworkManager (Gentoo)
kind: troubleshooting
scope: general
status: current
last_verified: "2026-03-03"
verified_on: [asus-b5402]
---

## 1. Symptom / Goal

Документ относится к ситуации, когда NetworkManager использует `iwd` для
Wi-Fi, ожидается MAC randomization, но фактическая конфигурация не даёт
ожидаемого результата или перекрывается другим config.

Это troubleshooting исходного инцидента и набор вариантов конфигурации, а не
универсально рекомендуемая настройка для любого Wi-Fi-устройства.

## 2. Когда применять и что проверить

Перед изменениями проверь:

- какой Wi-Fi driver используется;
- итоговую конфигурацию NetworkManager;
- существующие файлы в `/etc/NetworkManager/conf.d/` и системных config dirs;
- допустим ли временный разрыв Wi-Fi при перезапуске NetworkManager.

Фактическое текущее состояние ASUS B5402 находится в
[системном документе](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
и не дублируется здесь.

## 3. Cause: наблюдения исходного инцидента

### Конфликт конфигураций

В исходном инциденте системный файл
`/usr/lib/NetworkManager/conf.d/31-mac-addr-change.conf` переопределял
пользовательские настройки:

```ini
# Системный конфиг (защита проблемных драйверов)
wifi.scan-rand-mac-address=no
wifi.cloned-mac-address=preserve
```

Параметры применялись ко всем устройствам, хотя предназначались только для
драйверов `eagle_sdio` и `wl` (Broadcom). Это наблюдение исходного инцидента,
а не универсальный факт для всех современных версий NetworkManager.

### Historical / legacy configuration

В исходной конфигурации также встречался старый параметр:

```ini
# НЕ ИСПОЛЬЗОВАТЬ — устаревший синтаксис
[connection]
wifi.mac-address-randomization=2
```

## 4. Fix / Configuration

### 1. Определи Wi-Fi driver

```bash
lspci -k | grep -A3 "Network controller"
```

Пример из исходного инцидента на ASUS B5402 с Intel AX201:

```text
00:14.3 Network controller: Intel Corporation Alder Lake-P PCH CNVi WiFi (rev 01)
    DeviceName: Onboard - Ethernet
    Subsystem: Intel Corporation Dual Band Wi-Fi 6(802.11ax) AX201 160MHz 2x2 [Harrison Peak]
    Kernel driver in use: iwlwifi
```

В исходном документе драйверы были разделены так:

**Поддерживаемые драйверы** — для них предлагалось отключать
`31-mac-addr-change.conf`:

- `iwlwifi` (Intel) — ✅ рекомендуется
- `mt76` (MediaTek) — ✅
- `ath10k`, `ath9k`, `ath11k` (Atheros/Qualcomm) — ✅
- `rtl8xxxu`, `rtw88`, `rtw89` (Realtek) — ✅

**Проблемные драйверы** — для них сохранялся
`31-mac-addr-change.conf`:

- `wl` (Broadcom проприетарный) — ❌ не поддерживает смену MAC
- `eagle_sdio` — ❌ редкий, встроенный

### 2. Проверь и отключи конфликтующий config

```bash
# Создаём пустой файл-заглушку (маскируем системный)
doas touch /etc/NetworkManager/conf.d/31-mac-addr-change.conf

# Или с комментарием:
echo "# Disabled: iwlwifi supports MAC randomization" | doas tee /etc/NetworkManager/conf.d/31-mac-addr-change.conf
```

В исходном решении symlink на `/dev/null` не использовался: NetworkManager
проверяет `stat()` и отказывается читать не-regular файлы.

### 3. Настрой iwd как backend

```bash
doas nano /etc/NetworkManager/conf.d/wifi-backend.conf
```

Содержимое:

```ini
[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
```

### 4. Выбери MAC policy

```bash
doas nano /etc/NetworkManager/conf.d/99-mac-privacy.conf
```

**Вариант A: stable**

```ini
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
connection.stable-id=${CONNECTION}/${BOOT}
```

**Вариант B: random**

```ini
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=random
ethernet.cloned-mac-address=random
```

**Вариант C: stable-ssid**

```ini
[connection]
wifi.cloned-mac-address=stable-ssid
```

### 5. Примени конфигурацию

> ⚠️ **Важный нюанс**: перезапуск NetworkManager может временно оборвать
> текущее Wi-Fi-соединение.

```bash
doas systemctl restart NetworkManager
```

## 5. Verification

### Effective NetworkManager config

```bash
NetworkManager --print-config | grep -E "wifi\."
```

Пример ожидаемых строк для варианта `stable`:

```text
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
```

### Permanent и current MAC

```bash
# Аппаратный (постоянный) MAC
ethtool -P wlan0

# Текущий (может быть рандомизирован)
ip link show wlan0
```

Пример из исходного документа, а не обязательный exact output:

```text
$ ethtool -P wlan0
Permanent address: 8c:c6:81:xx:xx:xx  # Intel OUI

$ ip link show wlan0
link/ether 92:4a:xx:xx:xx:xx  # Другой MAC → рандомизация работает!
```

### Используемый backend

```bash
# Должно показать iwd
NetworkManager --print-config | grep backend

# Или через nmcli
nmcli -f GENERAL.DEVICE,GENERAL.TYPE,GENERAL.DRIVER device show wlan0
```

### Статус iwd

```bash
systemctl status iwd

# iwd должен быть active (running)
# NetworkManager запускает его автоматически через D-Bus
```

## 6. Rollback / Recovery

Если после изменения Wi-Fi перестал работать, верни прежние конфиги. Удали
созданный masking file или восстанови его прежнее содержимое, верни прежние
файлы backend и MAC policy, затем снова примени конфигурацию NetworkManager:

```bash
doas systemctl restart NetworkManager
```

После отката проверь восстановление Wi-Fi и effective NetworkManager config.

## 7. Background / Reference

### Почему в исходном решении выбран iwd

- Быстрее переподключается к известным сетям (~1 сек vs ~5-10 сек у
  wpa_supplicant)
- Лучше работает с Enterprise-сетями (WPA2-Enterprise, 802.1X)
- Меньше потребление памяти
- Современная кодовая база (написан на C, использует kernel API напрямую)

### Уровни рандомизации MAC

| Уровень | Параметр | Когда меняется | Поведение |
|---------|----------|---------------|-----------|
| Сканирование | `wifi.scan-rand-mac-address` | Каждое сканирование | Защита от трекинга при поиске сетей |
| Подключение (stable) | `wifi.cloned-mac-address=stable` | При каждой загрузке для данной сети | Стабильный вариант для подключения |
| Подключение (random) | `wifi.cloned-mac-address=random` | Каждое подключение | Новый MAC при каждом подключении |
| Подключение (stable-ssid) | `wifi.cloned-mac-address=stable-ssid` | Зависит от SSID | Отдельное значение в зависимости от SSID |
| Подключение (preserve) | `wifi.cloned-mac-address=preserve` | Никогда | Сохраняет вручную заданный MAC |

### Порядок загрузки конфигов NetworkManager

1. `/etc/NetworkManager/NetworkManager.conf`
2. `/usr/lib/NetworkManager/conf.d/*.conf`
3. `/etc/NetworkManager/conf.d/*.conf` (последний wins внутри группы)
4. `/run/NetworkManager/conf.d/*.conf` (временные, highest priority)

В исходном объяснении `/usr/lib/NetworkManager/conf.d/` сканируется **после**
`/etc/NetworkManager/conf.d/`, поэтому `31-*` перезаписывает `99-*`.
Предложенное решение — создать файл с тем же именем в `/etc/`, чтобы он
заменил системный.

### Устаревшие параметры

| Устаревший | Современный | Примечание |
|------------|-------------|------------|
| `wifi.mac-address-randomization=0\|1\|2` | `wifi.cloned-mac-address` | 0=default, 1=never, 2=always |
| `wifi.mac-address-randomization` в `[device]` | `wifi.scan-rand-mac-address` | Разделение сканирования и подключения |

## 8. Additional troubleshooting

### `Failed to read configuration: Not a regular file`

**Причина:** Использован symlink на `/dev/null`.

**Решение:**

```bash
doas rm /etc/NetworkManager/conf.d/31-mac-addr-change.conf
doas touch /etc/NetworkManager/conf.d/31-mac-addr-change.conf
```

### Wi-Fi не подключается после смены MAC

**Причина:** Captive portal или MAC-фильтрация на роутере.

**Решение:** Использовать `stable` вместо `random`:

```ini
wifi.cloned-mac-address=stable
```

### iwd не запускается

**Проверка:**

```bash
# Должен быть установлен
emerge -qv net-wireless/iwd

# Не должен быть включен как сервис (NM управляет им)
doas systemctl disable iwd  # если был включен
```

### Конфликт с systemd-networkd

**Симптом:** Соединения в `/run/NetworkManager/system-connections/`.

**Решение:** Отключить systemd-networkd для Wi-Fi:

```bash
doas systemctl disable systemd-networkd
# или
doas systemctl mask systemd-networkd-wait-online.service
```

## 9. Example configuration from the original incident

Этот блок показывает исторический вариант конфигурации исходного инцидента.
Он не является текущим source of truth для ASUS B5402.

### Файлы

```text
/etc/NetworkManager/
├── NetworkManager.conf          # [main] plugins=keyfile
├── conf.d/
│   ├── 31-mac-addr-change.conf  # ПУСТОЙ (маскирует системный)
│   ├── wifi-backend.conf        # iwd + scan rand MAC
│   └── 99-mac-privacy.conf      # stable MAC для подключений
```

### Содержимое файлов

Файл: `/etc/NetworkManager/NetworkManager.conf`

```ini
[main]
plugins=keyfile
```

Файл: `/etc/NetworkManager/conf.d/wifi-backend.conf`

```ini
[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
```

Файл: `/etc/NetworkManager/conf.d/99-mac-privacy.conf`

```ini
[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
connection.stable-id=${CONNECTION}/${BOOT}
```

Файл: `/etc/NetworkManager/conf.d/31-mac-addr-change.conf`

```ini
# Masked: iwlwifi driver supports MAC randomization
# Original file: /usr/lib/NetworkManager/conf.d/31-mac-addr-change.conf
```

## 10. Полезные команды

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
doas ip link set wlan0 down
doas ip link set wlan0 address 92:4a:00:00:00:01
doas ip link set wlan0 up
```

## 11. Historical incident context

- **Дата:** 2026-03-03
- **Окружение:** Gentoo Linux
- **NetworkManager:** 1.4x+
- **iwd:** 2.x

Это историческое окружение исходного инцидента. Текущее подтверждённое
состояние ASUS B5402 находится в
[системном документе](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

## Related docs

- [NetworkManager + iwd](../../networking/networkmanager-iwd/) — общая
  конфигурация NetworkManager с backend iwd.
- [Сеть ASUS B5402](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — текущее подтверждённое состояние эталонной системы.
