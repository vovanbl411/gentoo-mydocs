---
title: Сеть ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Current state

- Wi-Fi: NetworkManager + iwd, адаптер Intel AX201 — работает штатно.
- Firewall: nftables.
- Docker: 29.8.0, storage driver `overlay2` (iptables-nft).
- Libvirt: 12.6.0, запускается по требованию.
- Mesh VPN: NetBird активен, интерфейс `wt0`.
- Tailscale: установлен, `tailscaled` неактивен.

## Wi-Fi

NetworkManager использует iwd как Wi-Fi backend. Wi-Fi работает штатно.

- Адаптер Intel AX201; включены случайный MAC при сканировании и
  стабильный MAC для подключений.
- Локальный `31-mac-addr-change.conf` маскирует одноимённый системный файл.
- Локальный drop-in `iwd.service.d/override.conf` заменяет
  `ProtectKernelTunables=yes` на `ProtectKernelTunables=no` (effective
  подтверждён `systemctl show iwd -p ProtectKernelTunables`). Причина:
  `yes` запрещал iwd запись в sysctl `arp_evict_nocarrier` и
  `ndisc_evict_nocarrier` (`journalctl -u iwd`: `Unable to write ...`),
  которыми iwd управляет для корректного Wi-Fi roaming. Остальной hardening
  drop-in'а сохранён (CapabilityBoundingSet, RestrictAddressFamilies,
  ProtectSystem/ProtectHome и др.).
- Первичные источники — [руководство NetworkManager + iwd](../../../../networking/networkmanager-iwd/).

## Docker and Libvirt

- Docker 29.8.0: storage driver `overlay2`, iptables-nft.
- Libvirt 12.6.0: юниты libvirtd/virtqemud системно неактивны —
  виртуализация запускается по мере надобности.
- Для обхода Docker `FORWARD policy drop` применена отдельная таблица
  `ip gentoo_bridge_libvirt` (priority −10) и NAT-маскарадинг:
  `/etc/nftables/rules/main.nft` подключает `libvirt_fix.nft` и
  `tailscale.nft`. В runtime загружены таблицы `ip nat`,
  `ip gentoo_bridge_libvirt`, `ip tailscale_nat`.

Разбор конфликта Docker/Libvirt в nftables и ход диагностики — в
[troubleshooting](../../../../troubleshooting/docker-libvirt-nftables/).

## Mesh VPN

NetBird — основной mesh-VPN. Tailscale установлен, но выключен.

- NetBird (`net-vpn/netbird`): интерфейс `wt0` (WireGuard, NM-профиль
  `wt0`, external); процесс поднимает шаблонный юнит
  `netbird@main.service` (активен с загрузки, сам юнит disabled).
- Tailscale (`net-vpn/tailscale`): `tailscaled` disabled+inactive; таблица
  `ip tailscale_nat` загружается include'ом из
  `/etc/nftables/rules/main.nft`.

## Known observations

### Startup race NetworkManager/iwd

На работу Wi-Fi не влияет и исправления не требует.

Подробности: при инициализации iwd на короткое время создаётся Wi-Fi P2P
device `/net/connman/iwd/0`. NetworkManager в этот момент логирует
`error setting IPv4 forwarding to '0': Resource temporarily unavailable`
и `IWD device named wlan0 is not a Wifi device`, после чего создаёт
обычный `wlan0`; iwd подключается, DHCP проходит, дальше ошибок нет.

## Verification

- Wi-Fi и drop-in iwd проверены 2026-09-21 (включая effective
  `ProtectKernelTunables`).
- Startup-гонка наблюдалась 2026-09-21: `wlan0` connected,
  `/net/connman/iwd/0` (wifi-p2p) disconnected, оба сервиса active.
- Docker, Libvirt и runtime-таблицы nftables (`nft list tables`) проверены
  2026-09-22.
- NetBird и Tailscale проверены 2026-09-22; `netbird@main.service` активен
  с загрузки 2026-09-21.

## Related docs

- [NetworkManager и iwd](../../../../networking/networkmanager-iwd/)
- [MAC-рандомизация](../../../../troubleshooting/networkmanager-iwd-mac-randomization/)
- [Docker, Libvirt и nftables](../../../../troubleshooting/docker-libvirt-nftables/)
