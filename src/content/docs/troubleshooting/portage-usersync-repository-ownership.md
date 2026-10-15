---
title: "Portage usersync: Permission denied и несогласованный ownership repository"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-10-15"
verified_on: [gentoo-builder-01]
---

Если rsync-синхронизация Gentoo tree при `FEATURES=usersync` не может
удалить `.tmp-unverified-download-quarantine` или завершается с
`RepoStorageException` и `rsync` status `23`, проверь владельцев всего
repository. На [gentoo-builder-01](../../systems/gentoo-builder-01/)
верхний каталог принадлежал `portage:portage`, а десятки тысяч вложенных
каталогов — `root:root`. После подтверждения этого расхождения восстановление
ownership всего дерева вернуло успешный sync. Сам по себе status `23`
не доказывает проблему ownership: сначала нужны проверки ниже.

## Что произошло простыми словами

При rsync sync в проверенной конфигурации Portage сначала готовит отдельное
временное дерево `.tmp-unverified-download-quarantine`. Туда скачивается
обновление, затем выполняется проверка, и только после неё содержимое
переносится в рабочий repository. В конце временное дерево удаляется.

```text
Рабочий Gentoo repository
        ↓
Portage подготавливает quarantine
        ↓
Скачивает обновлённое дерево в quarantine
        ↓
Проверяет скачанное
        ↓
rsync quarantine → рабочий repository
        ↓
Удаляет quarantine
```

При `FEATURES=usersync` Portage понижает права до владельца repository.
Если это `portage:portage`, пользователь `portage` должен иметь возможность
изменять всё дерево. Запуск `emaint` через `doas` это требование не отменяет.

На builder права выглядели так:

```text
/var/db/repos/gentoo                         portage:portage 755
├── .tmp-unverified-download-quarantine      root:root       755
└── часть вложенного рабочего дерева         root:root       755
```

Режим `755` позволяет другим пользователям читать каталог и проходить через
него, но изменять его содержимое может только владелец. Поэтому `portage`
не мог очистить старый quarantine. После его удаления новый quarantine
создавался с правильным владельцем, но запись обновления в рабочее дерево
всё ещё упиралась в каталоги `root:root`: финальный `rsync -a --delete`
не мог заменить их содержимое.

Удаление quarantine устранило только первое препятствие. Согласованный
ownership всего repository устранил второе.

## Безопасная диагностика

Процедура применима к rsync repository с `usersync` и подтверждённым
расхождением владельцев. Примеры используют `/var/db/repos/gentoo` и
`portage:portage`; для другой конфигурации сначала установи фактический путь
и ожидаемого владельца. Проверяй дерево, когда sync не выполняется.

### 1. Подтверди режим sync, путь и владельца

```bash
portageq envvar FEATURES
portageq get_repo_path / gentoo
doas stat -c '%U:%G %a %n' \
    /var/db/repos/gentoo \
    /var/db/repos/gentoo/.tmp-unverified-download-quarantine
```

В effective `FEATURES` должен присутствовать `usersync`. В записи `[gentoo]`
в `/etc/portage/repos.conf` (файл или каталог конфигураций) проверь
`location`, `sync-type = rsync` и возможный явный `sync-user`.
Ожидаемого владельца определяй по принятой конфигурации repository;
`portage:portage` не является универсальным значением для всех установок.
Отсутствующий quarantine между синхронизациями — нормальное состояние:
`stat` тогда сообщит, что этого пути нет.

Для конкретного пути из ошибки проверь всю цепочку каталогов. Замени
`<path>` на относительный путь внутри quarantine; не вводи placeholder буквально:

```bash
doas namei -l \
    '/var/db/repos/gentoo/.tmp-unverified-download-quarantine/<path>'
```

### 2. Проверь вложенное рабочее дерево

Проверки одного `/var/db/repos/gentoo` недостаточно: правильный владелец
верхнего каталога не исправляет владельцев вложенных каталогов.

```bash
doas find /var/db/repos/gentoo \
    -xdev \
    ! -path '/var/db/repos/gentoo/.tmp-unverified-download-quarantine*' \
    -type d \
    \( ! -user portage -o ! -group portage \) \
    -printf '%u:%g %m %p\n' \
    | head -100
```

Для подсчёта всех таких каталогов, без ограничения первыми ста:

```bash
doas find /var/db/repos/gentoo \
    -xdev \
    ! -path '/var/db/repos/gentoo/.tmp-unverified-download-quarantine*' \
    -type d \
    \( ! -user portage -o ! -group portage \) \
    -printf '.\n' \
    | wc -l
```

На builder обнаружено **27 896 каталогов** с владельцем или группой,
отличными от `portage:portage`, в том числе:

```text
root:root 755 /var/db/repos/gentoo/games-arcade
root:root 755 /var/db/repos/gentoo/games-arcade/orthorobot
```

## Исправление после подтверждения причины

Перед изменениями убедись, что sync завершён, путь указывает именно на нужный
repository, а внутри нет посторонних mountpoints или локальных данных
с намеренно иным ownership. Диагностика с `-xdev` не проверяет другие
файловые системы, тогда как `chown -R` ниже может зайти в них.

### Очистка оставшегося quarantine

Если старый root-owned quarantine мешает начать новый sync, можно удалить
только это непроверенное временное дерево:

```bash
doas rm -rf /var/db/repos/gentoo/.tmp-unverified-download-quarantine
```

> **Важно:** команда безвозвратно удаляет содержимое указанного каталога.
> Проверь точный путь и отсутствие работающего sync. Следующая синхронизация
> заново подготовит и скачает временное дерево; удаление не исправляет
> ownership рабочего repository.

На builder после этой очистки новый quarantine стал `portage:portage 755`,
но финальное применение обновления по-прежнему завершалось:

```text
portage.repository.storage.interface.RepoStorageException:
command exited with status 23:
rsync -a --delete ...
```

### Восстановление ownership всего repository

Только если подтверждено, что **всё это дерево должно принадлежать
`portage:portage`**, а расхождение носит системный характер:

```bash
doas chown -R portage:portage /var/db/repos/gentoo
doas emaint sync -a
```

Рекурсивная смена владельца затрагивает все файлы и каталоги по этому пути.
Если нужен откат, до изменения сохрани snapshot или резервную копию дерева
с исходными владельцами и правами; восстановление выполняется из неё при
остановленном sync. Обратный `chown -R root:root` исходное распределение
владельцев не восстанавливает. После уже выполненного sync для возврата
к прежнему содержимому также нужна сохранённая копия.

Исправляй подтверждённое расхождение ownership всего дерева. `chmod 777`,
отключение `usersync` и поочерёдная правка category directories не являются
решением этого случая; менять схему работы Portage не потребовалось.

## Проверка результата

После успешного завершения `doas emaint sync -a` проверь всё дерево,
включая файлы:

```bash
doas find /var/db/repos/gentoo \
    -xdev \
    \( ! -user portage -o ! -group portage \) \
    -print
```

Ожидается пустой вывод без ошибок обхода. Затем проверь очистку quarantine
и состояние repository:

```bash
test ! -e /var/db/repos/gentoo/.tmp-unverified-download-quarantine \
    && echo 'quarantine cleanup: OK'

emerge --info | grep -E \
    'Timestamp of repository gentoo|Head commit of repository gentoo'
```

Ожидаются `quarantine cleanup: OK` и сведения о синхронизированном repository.
Timestamp и commit меняются с последующими обновлениями; они не заменяют
успешный exit status sync. Если ошибка остаётся при согласованных владельцах,
разбирай конкретные сообщения `rsync`: status `23` сам по себе не указывает
единственную причину.

## Как это проявилось на gentoo-builder-01

Проблема была воспроизведена и исправлена на `gentoo-builder-01` с
Portage `3.0.82.2` и rsync-репозиторием Gentoo.

Корень `/var/db/repos/gentoo` уже принадлежал `portage:portage`, поэтому
на первый взгляд конфигурация выглядела правильно. Проверка всего дерева
показала другое: значительная часть вложенных каталогов принадлежала
`root:root` — всего было найдено **27 896 каталогов** с владельцем или группой,
отличными от `portage:portage`.

При включённом `FEATURES=usersync` синхронизация выполнялась от имени
`portage`, который не мог изменять часть существующего repository.
Сначала это проявилось при очистке старого quarantine с владельцем
`root:root`. После его удаления новый quarantine создавался правильно,
с владельцем `portage:portage`, но финальный `rsync` в рабочее дерево
всё ещё завершался с status `23`.

После восстановления согласованного ownership:

```bash
doas chown -R portage:portage /var/db/repos/gentoo
```

повторный `doas emaint sync -a` завершился успешно, а временный quarantine
был штатно удалён.

Точная причина, по которой старое дерево оказалось `root:root`, не
установлена. Более ранний bootstrap или sync от root остаётся возможным
объяснением, но это не подтверждённый факт.

## Источники

- [Portage 3.0.82.2: `make.conf(5)`, FEATURES usersync](https://github.com/gentoo/portage/blob/portage-3.0.82.2/man/make.conf.5) — понижение прав до владельца repository и требование одинакового ownership вложенных каталогов.
- [Portage 3.0.82.2: реализация quarantine](https://github.com/gentoo/portage/blob/portage-3.0.82.2/lib/portage/repository/storage/hardlink_quarantine.py) — подготовка временного дерева, финальный `rsync -a --delete` и очистка. Подготовка может использовать hardlinks; это не независимая резервная копия рабочего дерева.
