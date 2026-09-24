---
title: Btrfs и Snapper на ASUS ExpertBook B5402
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Current state

- Корневая файловая система — Btrfs, плоский (flat) набор субволюмов:
  `@`, `@home`, `@snapshots` и отдельные субвольмы под сборку и кэши.
- Сжатие — `zstd:3`.
- Рабочая директория Portage `/var/tmp/portage` — tmpfs 16 GiB.
- Snapper создаёт timeline/boot-снимки по systemd timers.
- Автоматических pre/post-снимков вокруг emerge сейчас нет.

## Btrfs layout

Субвольмы:

```text
@               — корень системы
@home
@snapshots
@var_log
@var_cache
@distfiles
@ccache
@portage_tree
@docker
@libvirt
@portage_tmp
```

Опции монтирования NVMe: `compress=zstd:3`, `noatime`, `discard=async`,
`space_cache=v2`.

## Build and cache storage

Сборочная цепочка Portage вынесена из снапшотируемого корня:

| Субволюм | Точка монтирования | Назначение |
|---|---|---|
| `@ccache` | `/var/tmp/ccache` | кэш компилятора; `nodatacow` на каталоге подтверждён |
| `@portage_tmp` | `/var/tmp/portage-disk` | временные файлы тяжёлых сборок |
| `@distfiles` | `/var/cache/distfiles` | исходные коды пакетов |
| `@var_cache` | `/var/cache` | прочий системный кэш |
| `@portage_tree` | `/var/db/repos/gentoo` | дерево Gentoo |

Рабочая директория `/var/tmp/portage` — tmpfs размером 16 GiB
(`uid=portage`, `nosuid`, `nodev`, `noatime`).

## Snapper

Snapper создаёт timeline/boot-снимки. Автоматических pre/post-снимков
вокруг emerge сейчас нет.

Конфигурация `root`:

```text
ALLOW_GROUPS="wheel"
SYNC_ACL="yes"
TIMELINE_LIMIT_HOURLY=5
TIMELINE_LIMIT_DAILY=7
TIMELINE_LIMIT_WEEKLY=1
TIMELINE_LIMIT_MONTHLY=0
NUMBER_LIMIT=10
NUMBER_LIMIT_IMPORTANT=5
SPACE_LIMIT=0.8
```

`TIMELINE_LIMIT_*` — сколько timeline-снимков хранить; `NUMBER_LIMIT` —
лимит number-cleanup, а не отдельный лимит снимков emerge.

Автоматизация — systemd timers (timeline, cleanup, boot).

Хук Portage в `/etc/portage/bashrc` отсутствует: bashrc содержит только
`PORTAGE_SCHEDULING_COMMAND` для p-cores, pre/post-снимков на emerge
не создаётся.

## Verification

- Btrfs перепроверен по живому выводу `findmnt` 2026-09-22; субволюмы
  подтверждены монтированием 2026-09-12.
- `/var/tmp/portage` (tmpfs 16 GiB) подтверждён 2026-09-12.
- Snapper проверен по конфигу `/etc/snapper/configs/root` 2026-09-22.
- Отсутствие Portage-хука проверено по `/etc/portage/bashrc` 2026-09-22.

## Related docs

- [Структура Btrfs](../../../filesystem/btrfs-setup.md)
- [Snapper](../../../filesystem/snapper-backups.md)
