---
title: "Файрвол: nftables"
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

nftables — актуальная система фильтрации пакетов Linux и замена прежней модели
управления правилами iptables. Пример разрешает loopback, установленные и
связанные соединения, ICMPv4/ICMPv6 и весь исходящий трафик. Остальные входящие
пакеты и весь forwarding блокируются.

## Когда пример подходит

Применяй его на простом desktop host, где:

- Docker и Libvirt не используют forwarding;
- хост не маршрутизирует трафик и не выполняет NAT;
- VPN не управляет собственными nftables rules;
- нет входящих сервисов, кроме тех, для которых ты заранее добавил
  разрешающие правила.

Если используется Docker, Libvirt, маршрутизация или такой VPN, сначала
проверь полный текущий ruleset и не загружай этот пример напрямую. ASUS B5402 —
сложный случай, и этот минимальный ruleset не описывает его firewall: см.
[системную страницу](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

В Gentoo с systemd пакет `net-firewall/nftables` загружает сохранённые правила
из `/var/lib/nftables/rules-save`. Это путь хранения состояния, а не исходный
конфиг под `/etc`.
Если на конкретной системе source ruleset хранится под `/etc` и загружается
другим механизмом, это локальная схема, а не стандартная интеграция пакета.

## Минимальный ruleset

Перед заменой файла сохрани его и текущий runtime ruleset:

```bash
doas cp /var/lib/nftables/rules-save /var/lib/nftables/rules-save.backup
doas nft list ruleset > "$HOME/nftables-ruleset-backup.nft"
```

Файл: `/var/lib/nftables/rules-save`. После резервного копирования запиши в
него этот блок:

```text
table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;

        iifname "lo" accept
        ct state established,related accept

        meta l4proto icmp accept
        meta l4proto ipv6-icmp accept
    }

    chain forward {
        type filter hook forward priority filter; policy drop;
    }

    chain output {
        type filter hook output priority filter; policy accept;
    }
}
```

`nftables-load.service` сам очищает текущий ruleset перед загрузкой файла,
поэтому отдельный `flush ruleset` для этого способа загрузки не обязателен.
Файлы, созданные `nftables-store.service`, могут содержать собственный
`flush ruleset`.

`meta l4proto ipv6-icmp` находит ICMPv6 и за IPv6 extension headers. Выражение
`ip6 nexthdr icmpv6` проверяет только непосредственный Next Header и для этой
задачи не подходит.

Семейство `inet` позволяет обрабатывать IPv4 и IPv6 в одной таблице.

## Проверка и загрузка в Gentoo

После записи правил проверь их без применения:

```bash
doas nft -c -f /var/lib/nftables/rules-save
```

Проверка синтаксиса не подтверждает, что политика подходит твоей сети.

`nftables-load.service` — oneshot unit, который загружает этот файл перед
`network-pre.target`. Запусти его после успешной проверки:

> ⚠️ **Важный нюанс**: Загрузка ruleset немедленно меняет сетевую фильтрацию
> и может оборвать удалённый доступ. Если работаешь удалённо, заранее подготовь
> локальную консоль или другой способ восстановления доступа.

```bash
doas systemctl start nftables-load.service
```

Сервис сначала выполняет `flush ruleset`, затем загружает
`/var/lib/nftables/rules-save`. Он заменяет весь текущий ruleset, а не добавляет
правила поверх. Поэтому такой запуск может удалить правила, созданные Docker,
Libvirt или VPN.

`nftables-store.service` отдельно сохраняет текущий runtime ruleset в
`/var/lib/nftables/rules-save` при завершении работы. Включай его только если
нужен такой режим сохранения: при ручном ведении файла сервис может заменить
его текущим runtime-состоянием.

## Проверка

Проверь результат загрузки и список правил:

```bash
systemctl status nftables-load.service --no-pager
doas nft list ruleset
```

Это oneshot unit: не оценивай успех только по `is-active`. Проверь loopback,
обычный исходящий доступ, DNS, IPv4 и IPv6, если он используется, а также
необходимый доступ к управлению хостом. Включи загрузку при старте только
после этих проверок:

```bash
doas systemctl enable nftables-load.service
```

## Откат

Если после загрузки нарушилась связь, с локальной консоли верни сохранённый
файл, проверь его и снова запусти загрузку:

```bash
doas cp /var/lib/nftables/rules-save.backup /var/lib/nftables/rules-save
doas nft -c -f /var/lib/nftables/rules-save
doas systemctl start nftables-load.service
```

## Связанные материалы

- [Сеть ASUS B5402](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — локальная конфигурация firewall и сетевых сервисов.
- [Docker, Libvirt и nftables](../../troubleshooting/docker-libvirt-nftables/)
  — взаимодействие нескольких ruleset.
- [Исходники Gentoo net-firewall/nftables](https://gitweb.gentoo.org/repo/gentoo.git/tree/net-firewall/nftables/)
  — ebuild, units и helper.
- [Руководство nftables](https://netfilter.org/projects/nftables/manpage.html)
  — `meta l4proto`, IPv6 headers и base chain policies.
