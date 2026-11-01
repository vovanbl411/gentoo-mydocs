---
title: "Docker и Libvirt: диагностика forwarding через nftables"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## 1. Симптом

Виртуальная машина доступна с хоста, но не выходит во внешнюю сеть. Это само
по себе не доказывает, что трафик блокирует Docker: проверь путь маршрутизации,
kernel forwarding, фильтрацию и NAT отдельно.

## 2. Когда применять

Используй эту диагностику, если VM должна выходить через хост, где одновременно
работают Docker, Libvirt и firewall. Сначала подтверди маршрут и шлюз внутри VM,
затем проверь host ruleset. Не копируй правило из другого firewall без проверки
интерфейсов, адресов и направления трафика.

## 3. Определи Docker firewall backend

Если daemon запущен, `docker info` сообщает используемый firewall backend.
Если ответа сервера нет, проверь конфигурацию и параметры запуска:

```bash
doas docker info
doas cat /etc/docker/daemon.json
systemctl show docker.service -p ExecStart -p Environment --no-pager
iptables --version
ip6tables --version
```

Проверь явные значения `firewall-backend`, `iptables`, `ip6tables`,
`ip-forward`, `ip-forward-no-drop` и `bridge-accept-fwmark`. Docker по умолчанию
использует backend `iptables`; experimental native nftables backend появился в
Docker 29 и выбирается явно. Вывод `iptables --version` с `nf_tables` означает
iptables frontend поверх nftables, а не native Docker backend.

## 4. Причина

Разделяй этапы packet path:

- `net.ipv4.ip_forward` и `net.ipv6.conf.all.forwarding` определяют, пересылает
  ли ядро IPv4- и IPv6-трафик. Значение `0` означает, что forwarding выключен;
  это не ошибка firewall.
- `FORWARD` и base chains с hook `forward` фильтруют уже маршрутизируемые
  пакеты. Найди конкретную цепочку и правило, которые дают `drop`.
- NAT/masquerade меняет адрес источника для обратной маршрутизации; он не
  разрешает пакет, отброшенный фильтром.
- Настройки сети Libvirt задают виртуальный интерфейс и маршрут, а для NAT
  сети — правила NAT. Они не заменяют Docker rules и наоборот.

## 5. Исправление

Сначала установи backend и точку `drop`, затем выбирай решение для этого backend.

- При backend `iptables` Docker проводит пакет через `FORWARD`, сначала через
  `DOCKER-USER`, затем через Docker-managed forwarding chains. `DOCKER-USER` —
  место для пользовательского правила, которое должно выполняться до правил
  Docker. Подбирай правило только после проверки интерфейсов, адресов и
  направления проблемного пакета.
- При native backend `nftables` цепочки `DOCKER-USER` нет. `accept` в ранней
  отдельной base chain завершает только эту chain; более поздняя base chain
  всё ещё может отбросить пакет. Используй только механизм, который Docker
  документирует для подтверждённого native-backend случая; не переноси сюда
  iptables rule.

## 6. Проверка

На хосте сопоставь backend, kernel forwarding и реальные firewall chains:

```bash
sysctl net.ipv4.ip_forward
sysctl net.ipv6.conf.all.forwarding
doas iptables -S FORWARD
doas iptables -S DOCKER-USER
doas nft list ruleset
```

Для nftables найди все base chains с hook `forward`, их priorities, policies,
правила `drop` и counters, если они заданы. Имена Docker tables меняются между
версиями, поэтому определяй их по текущему ruleset, а не по старому имени
`table ip filter`.

После подтверждённого исправления проверь из VM маршрут до шлюза, DNS,
исходящий TCP/HTTPS и ожидаемый маршрут VM. Сравни counters до и после попытки,
если соответствующие правила их считают. Не считай конкретный HTTP status
внешнего сайта контрактом успешной проверки.

## 7. Откат

Диагностические команды выше не меняют систему. Если позднее будет применено
подтверждённое правило, откати только это правило тем же backend и восстанови
только изменённый source file из резервной копии.

## Связанные материалы

- [Сеть ASUS B5402](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — локальный ruleset и фактический unit загрузки.
- [Файрвол: nftables](../../networking/nftables-firewall/)
  — базовый пример и отличия Gentoo package units.
- [Docker with iptables](https://docs.docker.com/engine/network/firewall-iptables/)
- [Docker with nftables](https://docs.docker.com/engine/network/firewall-nftables/)
- [Packet filtering and firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
- [Docker Engine 29 release notes](https://docs.docker.com/engine/release-notes/29/)
- [nftables manual](https://netfilter.org/projects/nftables/manpage.html)
