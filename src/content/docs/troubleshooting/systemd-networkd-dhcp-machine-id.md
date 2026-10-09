---
title: "systemd-networkd: DHCPv4 не запускается при невалидном machine-id"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-10-09"
verified_on: [gentoo-builder-01]
---

Если интерфейс имеет carrier и подходящий `.network`, но DHCPv4 не
запускается с `Failed to start DHCPv4 client: No such file or directory`,
проверь `/etc/machine-id`. В подтверждённой установке
[gentoo-builder-01](../../systems/gentoo-builder-01/) инициализация валидного
machine-id и restart networkd сразу восстановили DHCP lease, default route
и DNS. Это решение для совпадающего состояния machine-id, а не объяснение
любого networkd `ENOENT`.

## Симптом и проверенное состояние

После first boot интерфейс `ens18` имел carrier, но не получил IPv4
и default route. Networkd сопоставил его с
`/etc/systemd/network/20-wired.network`, затем записал:

```text
Failed to start DHCPv4 client: No such file or directory
```

В примерах `ens18` — имя интерфейса проверенной VM; замени его на своё.

```bash
networkctl status ens18
ip -4 address show dev ens18
ip -4 route
doas journalctl -b -u systemd-networkd --no-pager
```

Проверь carrier, выбранный Network File и DHCPv4 policy. Если `.network`
не совпадает или link не имеет carrier, сначала устрани эту причину.

## Причина в этой установке

У новой системы не было валидного `/etc/machine-id`. После его генерации
и restart networkd DHCP client заработал без изменения link/network policy.
Именно эта проверка связывает сбой данной установки с machine-id.
По одной строке `ENOENT` такой вывод делать нельзя.

Проверка формата без вывода идентификатора:

```bash
test -f /etc/machine-id &&
    test "$(wc -c < /etc/machine-id)" -eq 33 &&
    LC_ALL=C grep -Eq '^[0-9a-f]{32}$' /etc/machine-id &&
    ! grep -Eq '^0{32}$' /etc/machine-id
```

Успешный exit status означает 32 lowercase hex digits, newline и ненулевое
значение. Это не проверка уникальности. Не копируй machine-id из LiveCD
или другой машины и не публикуй его содержимое.

## Исправление

Применяй только к новой установке с отсутствующим, пустым или невалидным
machine-id. Валидный ID работающей системы не заменяй: это меняет её identity.
Если файл невалиден и непуст, сохрани его локально для диагностики, проверь,
что он не является отдельным mountpoint, и освободи файл для инициализации.
Эти действия не нужны для отсутствующего или пустого файла.

```bash
doas systemd-machine-id-setup
doas systemctl restart systemd-networkd
```

Повтори проверку формата выше. Restart networkd может кратковременно
прервать сеть: выполняй исправление из локальной/VM console, сохрани
доступ к ней до проверки SSH. При отсутствии эффекта разбирай оставшиеся
сообщения journal, не повторяй генерацию валидного ID.

## Проверка результата

```bash
networkctl status ens18
ip -4 route
resolvectl status ens18
getent ahostsv4 gentoo.org
ping -4 -c 3 1.1.1.1
```

На builder networkd показал `routable (configured)` / `online`, появился
DHCP default route, external IPv4 и DNS через systemd-resolved — PASS.
DHCP-адрес, MAC и machine-id в этот документ не включены.

Прямой ICMP ping gateway может блокироваться его policy. Если routing
через gateway, external IPv4 и DNS работают, такой ping не доказывает
неисправность builder network.

Чтобы предупредить этот сбой, инициализируй и проверь machine-id ещё до
first boot по [руководству установки](../../installation/gentoo-installation/#11-hostname-timezone-locale-и-machine-id).
Назначение команды описано в
[systemd-machine-id-setup(1)](https://www.freedesktop.org/software/systemd/man/latest/systemd-machine-id-setup.html).
