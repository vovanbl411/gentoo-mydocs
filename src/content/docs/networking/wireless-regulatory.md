---
title: Беспроводные домены (Regulatory Domain)
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

Regulatory domain задаёт допустимые частоты и мощность Wi-Fi в соответствии с
регионом. Для него используется двухбуквенный код страны ISO 3166-1 alpha-2.
Значение должно соответствовать реальному regulatory domain пользователя.

Пакет `net-wireless/wireless-regdb` предоставляет ядру regulatory database;
`crda` устарел. Ядро автоматически загружает `regulatory.db` из
`wireless-regdb`.

## 1. Перед изменением

Не копируй чужой country code без проверки: вместо него подставь свой `<CC>`,
где `<CC>` — код ISO 3166-1 alpha-2 для фактического региона.

До изменения проверь текущий regulatory domain:

```bash
iw reg get
```

Эта же команда используется для проверки результата. Например, для Belarus
код — `BY`; это только пример синтаксиса, а не универсально рекомендуемое
значение. Текущий регион ASUS B5402 здесь не определяется.

## 2. Временная настройка

Задай regulatory domain до следующей перезагрузки или повторной настройки:

```bash
doas iw reg set <CC>
iw reg get
```

## 3. Постоянная настройка

### Через iwd

Файл: `/etc/iwd/main.conf`

```ini
[General]
Country=<CC>
```

Параметр `Country` в iwd — только запрос к ядру. Окончательное решение
принимают kernel и regdb, а для `self-managed wiphy` настройка из userspace
вообще игнорируется.

### Через параметр модуля cfg80211

Файл: `/etc/modprobe.d/cfg80211.conf`

```conf
options cfg80211 ieee80211_regdom=<CC>
```

Настройка применяется при загрузке модуля. Её можно применить через
`modprobe -r cfg80211 && modprobe cfg80211` или после перезагрузки.

> ⚠️ **Важный нюанс**: выгрузка `cfg80211` затрагивает работающий Wi-Fi
> stack и может оборвать текущее беспроводное соединение. Если прерывать его
> нельзя, примени настройку при следующей перезагрузке.

## 4. Проверка

После применения снова проверь regulatory domain той же командой, что и до
изменения:

```bash
iw reg get
```

## 5. Что делать не нужно

- `iwdctl set-domain <CC>` — такой утилиты нет. iwd управляется через
  интерактивный клиент `iwctl` и конфигурационный файл, а не через отдельную
  команду для установки домена.
- `echo "<CC>" > /sys/devices/virtual/net/wlan0/phy80211/country_code` — этот
  sysfs-атрибут доступен только для чтения, запись игнорируется.

## Related docs

- [NetworkManager + iwd](../networkmanager-iwd/) — выбор `iwd` как Wi-Fi
  backend для NetworkManager.

## References

- [iwd.config(5) — секция [General].Country](https://manpages.ubuntu.com/manpages/noble/man5/iwd.config.5.html)
- [kernel.org: Regulatory](https://wireless.wiki.kernel.org/en/developers/regulatory)
