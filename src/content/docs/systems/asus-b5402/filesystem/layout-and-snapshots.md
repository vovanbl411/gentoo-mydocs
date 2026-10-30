---
title: Btrfs и Snapper на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

## Текущее состояние

- Корневая файловая система — Btrfs с плоской схемой субволюмов. Сжатие —
  `compress=zstd:3`; также используются `noatime` и `discard=async`.
- `/var/tmp/portage` смонтирован как tmpfs размером 16 GiB.
- Кэши, дерево Portage и данные Docker/libvirt вынесены в отдельные субволюмы.
- Snapper создаёт почасовые снимки и снимки при загрузке; таймер очистки
  удаляет старые снимки по заданным лимитам. Квоты Btrfs выключены.
- Автоматические снимки до и после `emerge` не настроены.

## Субволюмы Btrfs

| Субволюм | Точка монтирования | Назначение |
|---|---|---|
| `@` | `/` | корневая система |
| `@home` | `/home` | домашние каталоги |
| `@snapshots` | `/.snapshots` | снимки Snapper |
| `@var_log` | `/var/log` | системные журналы |
| `@var_cache` | `/var/cache` | системные кэши |
| `@distfiles` | `/var/cache/distfiles` | архивы исходников Portage |
| `@ccache` | `/var/tmp/ccache` | кэш ccache |
| `@sccache` | `/var/tmp/sccache` | кэш sccache |
| `@portage_tree` | `/var/db/repos/gentoo` | дерево Gentoo |
| `@docker` | `/var/lib/docker` | данные Docker |
| `@libvirt` | `/var/lib/libvirt` | данные libvirt и образы виртуальных машин |
| `@portage_tmp` | `/var/tmp/portage-disk` | временные файлы тяжёлых сборок на диске |

## Сборка и кэши

`/var/tmp/portage` — tmpfs размером 16 GiB с параметрами `uid=portage`,
`gid=portage`, `mode=775`, `nosuid`, `nodev` и `noatime`. Он отделяет рабочие
файлы сборки от Btrfs-снимков.

В `/etc/portage/make.conf` заданы каталоги и лимиты кэшей:

- ccache: `/var/tmp/ccache`, `CCACHE_SIZE="20G"`;
- sccache: `/var/tmp/sccache`, `SCCACHE_CACHE_SIZE="20G"`.

Атрибут `+C` установлен на каталогах `/var/tmp/ccache`, `/var/tmp/sccache`,
`/var/tmp/portage-disk`, `/var/lib/docker` и `/var/lib/libvirt`. Подробнее о
наследовании NoCoW — в [общем руководстве по
Btrfs](../../../../filesystem/btrfs-setup/).

## Snapper

Конфигурация `root` в `/etc/snapper/configs/root` относится к `/`. Доступ к
снимкам предоставлен группе `wheel` (`ALLOW_GROUPS="wheel"`,
`SYNC_ACL="yes"`).

Включены `snapper-timeline.timer` для почасовых снимков,
`snapper-cleanup.timer` для очистки старых снимков и `snapper-boot.timer` для
снимков при загрузке. Политика хранения:

- 2 почасовых и 3 ежедневных снимка; недельный, месячный, квартальный и
  годовой лимиты равны 0;
- очистка по количеству: `NUMBER_LIMIT="10"`,
  `NUMBER_LIMIT_IMPORTANT="5"`.

`SPACE_LIMIT="0.8"` и `FREE_LIMIT="0.2"` заданы в конфигурации. Квоты Btrfs
выключены, поэтому эти параметры не участвуют в очистке с учётом занятого и
свободного места. Фактическое удержание снимков определяется числовыми
лимитами выше.

В `/etc/portage/bashrc` нет pre/post-хука Snapper: файл только вызывает
`PORTAGE_SCHEDULING_COMMAND`.

## Связанные документы

- [Структура Btrfs](../../../../filesystem/btrfs-setup/)
- [Snapper](../../../../filesystem/snapper-backups/)
