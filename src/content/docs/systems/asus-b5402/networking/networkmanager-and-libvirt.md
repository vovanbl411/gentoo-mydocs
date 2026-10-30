---
title: Сеть ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- **Wi-Fi:** NetworkManager + iwd, Intel AX201 (`wlan0`); подключение
  управляется NetworkManager.
- **Firewall:** nftables активен; правила включают NAT/forwarding для сетей
  виртуальных машин и статический NAT для Tailscale.
- **Docker и Libvirt:** оба пакета установлены. `docker.service`, сервисы
  `libvirtd`/`virtqemud` и их сокеты отключены и неактивны.
- **Mesh VPN:** NetBird активен на `wt0`. Tailscale установлен,
  `tailscaled` отключён и неактивен.

## Wi-Fi

NetworkManager использует iwd как Wi-Fi backend. Intel AX201 (`wlan0`)
подключён через NetworkManager. Эффективная конфигурация включает MAC
randomization при сканировании и задаёт `stable` cloned MAC для Wi-Fi и
Ethernet-подключений.

Локальное переопределение `iwd.service` задаёт
`ProtectKernelTunables=no`. Причину и совместимые ограничения systemd для iwd
см. в [руководстве NetworkManager + iwd](../../../../networking/networkmanager-iwd/).

## Docker, Libvirt и nftables

`docker.service` отключён и неактивен. Пакет Libvirt установлен, но
`libvirtd.service`, `virtqemud.service`, `libvirtd.socket` и
`virtqemud.socket` отключены и неактивны.
Символическая ссылка в `/etc/systemd/system/multi-user.target.wants/` ведёт
на отсутствующий `libvirt-docker-forward-fix.service`; systemd сообщает
`LoadState=not-found`.

Основной файл nftables — `/etc/nftables/rules/main.nft`; он подключает
`libvirt_fix.nft` и `tailscale.nft`. Сейчас загружены таблицы `ip nat`,
`ip gentoo_bridge_libvirt` и `ip tailscale_nat`.

`libvirt_fix.nft` задаёт masquerade для сетей `192.168.122.0/24` и
`10.0.0.0/24`, а также цепочку `bypass_docker` таблицы
`ip gentoo_bridge_libvirt` на hook `forward` с priority `filter - 10`.
Правила цепочки принимают трафик с адресом источника или назначения из этих
сетей.

`tailscale.nft` задаёт masquerade для сети `100.64.0.0/10` при выходе через
`eno2`. Таблица `ip tailscale_nat` загружена, хотя служба `tailscaled`
неактивна.

Диагностика маршрутизации Docker и Libvirt описана в
[отдельном руководстве](../../../../troubleshooting/docker-libvirt-nftables/).

## Mesh VPN

Сейчас активен NetBird: служба `netbird@main.service` работает, интерфейс
`wt0` поднят. NetworkManager показывает `wt0` как внешнее WireGuard-
подключение. Служба Tailscale неактивна и отключена; её статические правила
nftables перечислены выше.

## Known observation

В журналах текущей и предыдущей загрузки при появлении Wi-Fi P2P-устройства
`/net/connman/iwd/0` NetworkManager сообщает `error setting IPv4 forwarding to
'0': Resource temporarily unavailable` и `IWD device named wlan0 is not a
Wifi device`. Сейчас Wi-Fi подключён через NetworkManager.

## Related docs

- [NetworkManager и iwd](../../../../networking/networkmanager-iwd/)
- [MAC-рандомизация](../../../../troubleshooting/networkmanager-iwd-mac-randomization/)
- [Docker, Libvirt и nftables](../../../../troubleshooting/docker-libvirt-nftables/)
