---
title: "Docker 29 не запускается: iptables not found"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-09"
verified_on: [asus-b5402]
---

## 1. Symptom

После обновления Go и пересборки Docker системный сервис завершался с ошибкой
`start-limit-hit`:

```text
docker.service: Start request repeated too quickly.
docker.service: Failed with result 'start-limit-hit'.
```

Это сообщение systemd отражает несколько неудачных попыток запуска, но не
указывает исходную причину. Она находится выше в журнале:

```bash
journalctl -b -u docker.service --no-pager
```

```text
failed to find iptables: exec: "iptables": executable file not found in $PATH
failed to start daemon: Error initializing network controller:
failed to create NAT chain DOCKER: iptables not found
```

Ключевая ошибка для этого документа — `iptables not found`, а
`start-limit-hit` является вторичным symptom systemd.

## 2. Когда применять

Инструкция применима, если:

- Docker действительно завершается с ошибкой `iptables not found`;
- используется backend, которому нужна команда `iptables`;
- отсутствие `iptables` подтверждено проверкой.

Это не универсальная причина любого сбоя `docker.service`.

## 3. Cause

На момент диагностики были установлены Docker `29.8.0` и
`net-firewall/nftables-1.1.6`, но отсутствовали пакет
`net-firewall/iptables` и команда `iptables`:

```bash
command -v iptables
qlist -Iv net-firewall/iptables net-firewall/nftables
```

В ebuild Docker `28.4.0` была прямая зависимость от
`net-firewall/iptables`. Ebuild Docker `29.8.0` зависит от
`net-firewall/nftables`, однако Docker продолжает использовать iptables
backend по умолчанию. Пакет `net-firewall/nftables` предоставляет `nft` и
`libnftables`, но не команду `iptables`.

Обновление Go запустило пересборку Docker, но само по себе не было причиной
ошибки. Точный момент удаления `net-firewall/iptables` не подтверждён; пакет
мог стать ненужной зависимостью после обновления Docker и затем попасть под
`emerge --depclean`.

## 4. Fix

Сначала проверь план установки:

```bash
emerge -pv net-firewall/iptables
```

Для текущей конфигурации нужен USE-флаг `nftables`. В этом режиме Docker
вызывает команды `iptables`/`ip6tables`, а те работают через nftables backend
ядра:

```bash
doas emerge -av net-firewall/iptables
doas eselect iptables set xtables-nft-multi
iptables --version
```

> **Важно:** USE-флаг `nftables` добавляет nft-совместимую реализацию, но не
> гарантирует, что она выбрана как активная. После новой установки ebuild
> может назначить `xtables-legacy-multi`, поэтому переключение через `eselect`
> выполняется явно.

Ожидаемый результат:

```text
iptables v1.8.x (nf_tables)
```

После установки сбрось ограничение systemd и запусти сервисы:

```bash
doas systemctl reset-failed docker.service docker.socket
doas systemctl restart docker.socket
doas systemctl start docker.service
```

## 5. Verification

```bash
systemctl status docker.service --no-pager
docker info
docker ps
```

Ожидается состояние `active (running)`, а `docker info` должен завершиться без
ошибки подключения к демону Docker.

## 6. Rollback / recovery

Если реализация backend, выбранная через `eselect`, оказалась неправильной,
верни прежний выбор и повторно проверь запуск Docker. Удалять пакеты или
откатывать Docker для этого шага не требуется.

## 7. Alternative: нативный nftables backend

Docker 29 поддерживает нативный nftables backend, но он включается только явно:
через `"firewall-backend": "nftables"` в `/etc/docker/daemon.json`. Этот режим
пока считается экспериментальным. Переход требует включённого IP forwarding и
проверки всех пользовательских правил. На момент инцидента IPv4 и IPv6
forwarding были выключены, а действующая конфигурация Docker + Libvirt
рассчитана на `iptables-nft`.

Поэтому установка `net-firewall/iptables` с USE-флагом `nftables` — наименьшее
изменение, сохраняющее текущую сетевую схему. Активной реализацией должна быть
`xtables-nft-multi`.

## 8. Сопутствующие сообщения

Записи `not restoring image ... layer does not exist` появляются раньше
фатальной ошибки, но не останавливают запуск на этом этапе. После
восстановления Docker следует отдельно проверить список образов и контейнеров.
Не нужно удалять `/var/lib/docker` для исправления ошибки `iptables not found`.

## 9. Historical / Incident environment

Это окружение исходного инцидента, а не текущее состояние ASUS B5402:

- **Дата диагностики:** 2026-09-09
- **Docker:** 29.8.0
- **containerd:** 2.3.4
- **runc:** 1.4.3
- **Go:** 1.27.1
- **Firewall:** nftables 1.1.6
- **Init:** systemd

Текущее подтверждённое состояние эталонной системы находится в
[системном документе](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

## Related docs

- [Docker + Libvirt и nftables](../docker-libvirt-nftables/) — взаимодействие
  forwarded traffic Docker, Libvirt и nftables.
- [Сеть ASUS B5402](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — текущее подтверждённое состояние эталонной системы.

## References

- [Docker: Firewall with nftables](https://docs.docker.com/engine/network/firewall-nftables/)
