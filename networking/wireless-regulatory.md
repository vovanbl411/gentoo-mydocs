# Беспроводные домены (Regulatory Domain)

Чтобы Wi-Fi адаптер работал на правильных частотах и с разрешенной мощностью, необходимо установить код страны (ISO 3166-1 alpha-2).

В современных ядрах эту роль выполняет [wireless-regdb](https://wireless.wiki.kernel.org/en/developers/regulatory), а `crda` устарел. Для Gentoo достаточно установить пакет `net-wireless/wireless-regdb` — ядро автоматически подтянет `regulatory.db`.

## Проверка текущего региона

```bash
iw reg get
```

## Разовая установка домена

```bash
doas iw reg set BY
iw reg get   # проверка
```

Синтаксис: `iw reg set <ISO 3166-1 alpha-2>`. Команда `iwdctl` не существует — управление iwd идёт через `iwctl` (интерактивный клиент) и конфиг-файл, а не через отдельный CLI.

## Persistent-настройка

### Через iwd (`/etc/iwd/main.conf`)

```ini
[General]
Country=BY
```

См. [iwd.config(5)](https://manpages.ubuntu.com/manpages/noble/man5/iwd.config.5.html). Примечание из upstream: `Country` в iwd — это лишь **запрос** к ядру, окончательное решение принимает kernel/regdb, а для «self-managed wiphy» установка из userspace вообще игнорируется.

### Через параметр модуля `cfg80211` (`/etc/modprobe.d/cfg80211.conf`)

```
options cfg80211 ieee80211_regdom=BY
```

Применится при загрузке модуля (`modprobe -r cfg80211 && modprobe cfg80211` или после ребута).

## Что делать НЕ надо

- ❌ `iwdctl set-domain <CC>` — такой утилиты нет.
- ❌ `echo "BY" > /sys/devices/virtual/net/wlan0/phy80211/country_code` — этот sysfs-атрибут read-only, запись игнорируется.

## Ссылки

- [iwd.config(5) — секция [General].Country](https://manpages.ubuntu.com/manpages/noble/man5/iwd.config.5.html)
- [kernel.org: Regulatory](https://wireless.wiki.kernel.org/en/developers/regulatory)
