---
title: Беспроводной regulatory domain
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Regulatory domain — набор правил для Wi-Fi: допустимые частоты, ширина каналов,
мощность передатчика и другие ограничения. Код страны — двухбуквенный ISO
3166-1 alpha-2. Используй `<CC>` для места, где устройство фактически работает.

Пакет `net-wireless/wireless-regdb` устанавливает `regulatory.db`, которую ядро
запрашивает через firmware API. Для обычной современной настройки отдельный
CRDA не нужен. Запрошенный country code не гарантирует, что все правила
применятся к каждому устройству: результат зависит также от базы, драйвера и
firmware.

## Посмотреть текущее состояние

```bash
iw reg get
```

Вывод может содержать блок `global` с общим domain и отдельные блоки `phy#N` с
состоянием устройств (wiphy). Список правил показывает состояние ядра, но сам
по себе не подтверждает, что country code юридически подходит для места
использования устройства. Для конкретного устройства запроси его состояние,
если установленный `iw` поддерживает эту команду:

```bash
iw phy <phy-name> reg get
```

Если рядом с PHY указано `self-managed`, его regulatory state контролирует
драйвер или firmware. Пользовательский запрос может не менять правила этого
устройства, даже если global domain изменился.

## Отправить country request

Для разового запроса ядру используй код фактического региона:

```bash
doas iw reg set <CC>
```

Команда сообщает ядру country code как regulatory request/hint; она не задаёт
безусловные аппаратные ограничения. После запроса проверь global domain и
состояние PHY командами выше.

## Задать country через iwd

Файл: `/etc/iwd/main.conf`

```ini
[General]
Country=<CC>
```

`Country=` запрашивает установку страны. Для обычного wiphy это regulatory
hint; userspace не может напрямую задать regulatory domain на
`self-managed wiphy`. Если NetworkManager использует iwd как Wi-Fi backend,
`Country=` остаётся настройкой iwd в `main.conf`, а NetworkManager управляет
подключениями. См. [настройку NetworkManager + iwd](../networkmanager-iwd/).

## Альтернатива: параметр cfg80211

Этот вариант уместен, если country hint должен задаваться при загрузке
`cfg80211`; обычно для повседневной настройки достаточно `Country=` в iwd.

Проверь конфигурацию используемого ядра:

```bash
zgrep '^CONFIG_CFG80211=' /proc/config.gz 2>/dev/null || \
  grep '^CONFIG_CFG80211=' "/boot/config-$(uname -r)" 2>/dev/null
```

Если `CONFIG_CFG80211=m`, параметр можно передать через `modprobe`.

Файл: `/etc/modprobe.d/cfg80211.conf`

```conf
options cfg80211 ieee80211_regdom=<CC>
```

Если `CONFIG_CFG80211=y`, модульная настройка из `/etc/modprobe.d` не действует:
параметр встроенного кода передают через командную строку ядра:

```text
cfg80211.ieee80211_regdom=<CC>
```

Параметр применяется при загрузке модуля или ядра. Не выгружай `cfg80211` на
работающей Wi-Fi системе: это затрагивает весь беспроводной стек. Проверь
результат после плановой перезагрузки.

## Проверить результат

После изменения проверь global и device-specific состояние:

```bash
iw reg get
iw phy <phy-name> reg get
iw phy <phy-name> info
```

Сверяй не только country code, но и regulatory rules: диапазоны частот,
ширину канала, мощность и флаги. `iw phy <phy-name> info` показывает каналы и
ограничения самого устройства. Совпадение country code не гарантирует, что
каждый канал доступен конкретному адаптеру. Эти команды только читают состояние.

## Источники

- [Linux kernel: wireless regulatory](https://docs.kernel.org/networking/regulatory.html)
- [Linux Wireless: документация iw](https://wireless.docs.kernel.org/en/latest/en/users/documentation/iw.html)
- [iwd: upstream iwd.config](https://kernel.googlesource.com/pub/scm/network/wireless/iwd/+/refs/heads/master/src/iwd.config.rst)
- [Linux kernel: net/wireless/reg.c](https://github.com/torvalds/linux/blob/master/net/wireless/reg.c)
- [Linux kernel: параметры командной строки](https://docs.kernel.org/admin-guide/kernel-parameters.html)
