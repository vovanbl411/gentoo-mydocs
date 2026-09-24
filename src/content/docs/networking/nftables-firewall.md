---
title: "Файрвол: nftables"
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

Документ показывает минимальный stateful firewall на nftables. Пример
разрешает весь исходящий трафик, входящие пакеты established/related,
loopback и ICMP. Остальной входящий трафик блокируется, а цепочка `forward`
закрыта политикой `drop`.

Это простой desktop example, а не универсальная политика для хоста с Docker,
Libvirt, VPN, маршрутизацией или серверными сервисами. Для такого окружения
ruleset нужно адаптировать отдельно.

nftables заменяет старый стек iptables, предлагая более простую логику правил
и меньшую нагрузку на процессор.

## 1. Перед применением

До изменения firewall:

- сохрани существующую рабочую конфигурацию и проверь, какие правила уже
  загружены;
- учти, что `flush ruleset` удаляет все загруженные nftables rules;
- подготовь способ восстановить доступ: ошибка в правилах может отрезать
  удалённую машину от сети;
- проверь, не добавляют ли Docker, Libvirt, VPN или другие сервисы собственные
  tables и chains.

Не применяй этот минимальный пример поверх сложного рабочего ruleset без
адаптации и доступного rollback.

## 2. Конфигурация

Файл: `/etc/nftables.conf`

```nftables
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Разрешить loopback (localhost)
        iif "lo" accept

        # Разрешить уже установленные соединения
        ct state established,related accept

        # Разрешить ICMP (пинг)
        ip protocol icmp accept
        ip6 nexthdr icmpv6 accept

        # Опционально: разрешить SSH (если нужно)
        # tcp dport 22 accept
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
```

## 3. Проверка до применения

Сначала проверь синтаксис без загрузки ruleset:

```bash
doas /usr/sbin/nft -c -f /etc/nftables.conf
```

Успешная проверка синтаксиса не подтверждает, что политика подходит текущему
сетевому окружению.

## 4. Применение

> ⚠️ **Важный нюанс**: применение firewall может немедленно изменить
> текущую сетевую доступность, включая удалённый доступ к машине.

После проверки конфигурации включи сервис:

```bash
doas systemctl enable --now nftables
```

## 5. Проверка после применения

Проверь состояние сервиса и фактически загруженный ruleset:

```bash
doas systemctl status nftables
doas nft list ruleset
```

Затем проверь ожидаемую сетевую доступность: исходящие соединения, loopback,
ICMP и необходимые способы управления хостом. Не считай конфигурацию рабочей
только по успешному запуску сервиса.

## 6. Rollback

Перед изменением сохрани предыдущую рабочую конфигурацию. Если новый ruleset
нарушил доступность, верни прежний файл, снова проверь его синтаксис и повторно
загрузи рабочий ruleset через `nftables.service`.

## Related docs

- [Docker, Libvirt и nftables](../../troubleshooting/docker-libvirt-nftables/)
  — отдельный разбор сложного взаимодействия forwarded traffic и нескольких
  tables/chains.
