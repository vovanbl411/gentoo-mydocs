---
title: Сеть ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Текущее состояние

- **Wi-Fi:** NetworkManager использует iwd для Intel AX201 (`wlan0`).
- **Firewall:** активен nftables.
- **Docker и Libvirt:** установлены и используются по необходимости.
- **Mesh VPN:** NetBird — основной mesh VPN.

## Wi-Fi

NetworkManager использует iwd; Intel AX201 (`wlan0`) подключён через
NetworkManager. Эффективная конфигурация включает MAC randomization при
сканировании и задаёт `stable` cloned MAC для Wi-Fi и Ethernet-подключений.
Эффективное значение параметра iwd — `ProtectKernelTunables=no`. Подробнее — в
[руководстве NetworkManager и iwd](../../../../networking/networkmanager-iwd/).

## Docker, Libvirt и nftables

Основной файл nftables — `/etc/nftables/rules/main.nft`; он подключает
`libvirt_fix.nft` и `tailscale.nft`. Файл `libvirt_fix.nft` содержит
системные forwarding/NAT rules для сетей виртуальных машин. `tailscale.nft`
также входит в текущую конфигурацию nftables. Для диагностики Docker и
Libvirt см. [отдельное руководство](../../../../troubleshooting/docker-libvirt-nftables/).

## Mesh VPN

Интерфейс NetBird — `wt0`. Tailscale установлен, но не используется как
активный mesh VPN.

## Наблюдение

В журналах текущей и предыдущей загрузки есть кратковременные предупреждения
NetworkManager и iwd при создании Wi-Fi P2P device. После запуска интерфейс
Wi-Fi `wlan0` подключён через NetworkManager.

## Связанные документы

- [MAC-рандомизация NetworkManager и iwd](../../../../troubleshooting/networkmanager-iwd-mac-randomization/)
