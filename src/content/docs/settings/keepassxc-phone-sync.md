---
title: Синхронизация KeePassXC с Android через Syncthing
kind: guide
scope: mixed
status: current
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

На ASUS ExpertBook B5402 обычная двусторонняя синхронизация live-базы
KeePassXC между Gentoo и Android принята 2026-09-30 (PASS). На Gentoo
используется Syncthing, на Android — Syncthing-Fork и KeePassDX. Синхронизация
не заменяет backup: Google Drive и local backups остаются отдельным слоем.

Реальное восстановление после конфликта двух одновременно изменённых копий и
последующего KeePassXC merge ещё не прошло acceptance. Этот статус остаётся
PENDING.

## Текущая схема

```text
KeePassXC (Gentoo)
~/Documents/KeePassSync/
          ↕
      Syncthing
          ↕
Documents/KeePassSync
KeePassDX (Android)

Независимый backup:
live KDBX → daily verified snapshot → ~/Backups/KeePassXC/
          → rclone copy → Google Drive → local rotation после успешной доставки
```

Syncthing переносит только live-базу в `~/Documents/KeePassSync/`. Каталог
`~/Backups/KeePassXC/` через Syncthing не синхронизируется. Google Drive —
только destination для backup-копий, не live filesystem.

## Что требуется

- Gentoo workstation с `net-p2p/syncthing-2.0.16`, systemd --user service и
  KeePassXC;
- Android с Syncthing-Fork и KeePassDX;
- выделенный каталог live-базы на каждой стороне;
- одинаковый Folder ID `keepassxc-live` на Gentoo и Android.

## Gentoo: Syncthing и live-каталог

На Gentoo Syncthing запущен как user service; `Linger=no`. GUI/API доступен
только локально на loopback, порт `8384`. Стороны используют штатные TCP/QUIC
listeners; защищённое соединение между Gentoo и Android и передача данных по
LAN проверены.

В GUI Syncthing создай папку live-базы и расшарь её с Android. Для неё задай
следующие параметры:

| Параметр | Значение |
|----------|----------|
| Folder Label | `KeePassXC Live` |
| Folder ID | `keepassxc-live` |
| Folder Path | `~/Documents/KeePassSync/` |
| Folder Type | `Send & Receive` |
| Watch for Changes | enabled |
| File Versioning | `No File Versioning` |
| Ignore Permissions | disabled |

В `~/Documents/KeePassSync/` находится ровно одна рабочая top-level KDBX;
mode файла на Gentoo — `0600`. Folder ID — общий идентификатор папки, а не её
отображаемое имя.

## Android: Syncthing-Fork и KeePassDX

В Syncthing-Fork прими папку, расшаренную с Gentoo, и укажи локальный путь
`Documents/KeePassSync`. Проверь Folder ID `keepassxc-live`, тип
`Send & Receive` и `No File Versioning`; `Ignore Permissions` должен быть
включён.

Folder Label на Android может отличаться от `KeePassXC Live`: совпадать должен
именно Folder ID. После синхронизации открой существующую live-базу в KeePassDX
из `Documents/KeePassSync/` и сохраняй изменения в этой базе. Не открывай
backup-копию из Google Drive как live-базу.

## Принятая двусторонняя проверка

2026-09-30 на ASUS B5402 проверены все три направления:

| Проверка | Результат |
|----------|-----------|
| Первичная передача Gentoo → Android; база появилась в `Documents/KeePassSync/` и открылась в KeePassDX | PASS |
| Изменение в KeePassXC на Gentoo появилось в KeePassDX после синхронизации | PASS |
| Последующее изменение в KeePassDX вернулось на Gentoo и отображалось в KeePassXC | PASS |
| Обычный двусторонний workflow | CLOSED / PASS |

Для этих проверок использовалась контролируемая тестовая запись. Её содержимое
и данные production-базы в документацию не включаются.

## Связь с backup pipeline

Live sync и backup — независимые слои:

- Syncthing синхронизирует только live-каталог `~/Documents/KeePassSync/`;
- backup wrapper независимо снимает verified snapshot текущей live KDBX,
  доставляет top-level `*.kdbx` из `~/Backups/KeePassXC/` через `rclone copy`
  в Google Drive и запускает локальную rotation только после успешной
  доставки;
- KeePassXC также сохраняет встроенную timestamped backup-копию при
  локальном save.

Android-изменение не обязано проходить через локальный KeePassXC save, поэтому
daily snapshot остаётся нужен независимо от того, каким редактором меняли
базу. 2026-09-30 проверено, что локальные backup-файлы по-прежнему сохраняются
после переноса live-базы и включения phone sync; в этой повторной проверке
число файлов, имена и hashes не фиксировались.

## Конфликты и восстановление

Архитектурная политика для дополнительного `*.kdbx` принята:

1. Не удаляй конфликтную копию наугад.
2. Объедини нужные записи из конфликтующих копий с помощью KeePassXC merge.
3. Проверь итоговую базу и только после этого удали конфликтную копию.

Backup wrapper требует ровно один top-level regular non-symlink `*.kdbx` в
live-каталоге. При нуле или нескольких файлах он останавливается до snapshot,
delivery и rotation. Это startup conflict gate, а не блокировка Syncthing во
время синхронизации.

Статус recovery — **PENDING / NOT YET ACCEPTED**: end-to-end конфликт двух
одновременно изменённых версий и последующий merge ещё не проверялись.

## Если синхронизация не передаёт базу

- Сверь Folder ID на обеих сторонах: он должен быть ровно `keepassxc-live`.
  Folder Label может отличаться.
- Если Android создал другой generated Folder ID, Syncthing считает папки
  разными и не передаёт KDBX. В принятой настройке после исправления Android
  Folder ID на `keepassxc-live` начальная синхронизация заработала.
- Отдельные NAT-PMP ошибки сами по себе не означают, что синхронизация
  сломана. В принятой схеме защищённое LAN-соединение и передача данных
  работали несмотря на такие сообщения.
- Если соединение установлено и файлы передаются, NAT-PMP warning не является
  blocker этой локальной схемы.

## Связанные документы

- [Резервные копии KeePassXC в Google Drive](../keepassxc-backup/) — отдельный
  backup pipeline и local rotation.
- [Приложения ASUS ExpertBook B5402](../../systems/asus-b5402/applications/) —
  текущее состояние workstation.
