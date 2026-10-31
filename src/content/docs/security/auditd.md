---
title: Auditd в Gentoo Linux
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Система Linux Audit передаёт события ядра и userspace демону `auditd`, который
записывает их в журнал. Здесь показаны установка Audit на Gentoo с systemd,
небольшой пример правил, их проверка и поиск событий. Пример не задаёт
политику для конкретной рабочей станции.

## Требования ядра

Для syscall-правил из этого руководства нужны `CONFIG_AUDIT=y` и
`CONFIG_AUDITSYSCALL=y` в конфигурации запущенного ядра. Проверить их можно
так:

```bash
zgrep -E '^CONFIG_AUDIT=|^CONFIG_AUDITSYSCALL=' /proc/config.gz 2>/dev/null || \
grep -E '^CONFIG_AUDIT=|^CONFIG_AUDITSYSCALL=' "/boot/config-$(uname -r)" 2>/dev/null
```

Если политика требует, чтобы процессы, запущенные до старта `auditd`, тоже
получали признак auditable, добавь `audit=1` в kernel command line. Для
базового журналирования после запуска демона `audit=1` не обязателен.

## Установка и сервисы

Установи пакет и включи запуск `auditd.service` при загрузке:

```bash
doas emerge -av sys-process/audit
doas systemctl enable auditd.service
```

Для первого запуска без перезагрузки:

```bash
doas systemctl start auditd.service
```

В штатной модели Audit 4.x `auditd.service` подтягивает `audit-rules.service`
через `Wants=`. Systemd запускает `auditd.service` перед загрузчиком правил.
`audit-rules.service` — unit типа `oneshot` с
`ExecStart=/sbin/augenrules --load`: после загрузки он завершается и может
отображаться как `inactive (dead)`. При включённом `auditd.service` отдельно
включать `audit-rules.service` не требуется. Это слабая зависимость: демон
может запуститься, даже если загрузка правил завершилась ошибкой, поэтому
проверяй активный набор через `auditctl -l`.

В `auditd.service` задано `RefuseManualStop=yes`: штатный unit запрещает
ручную остановку демона. Для изменения правил перезапуск `auditd` не нужен.

## Конфигурация `auditd`

Файл: `/etc/audit/auditd.conf`

Здесь задаются путь и формат журнала, ротация, а также поведение при нехватке
места или ошибке записи. Параметры `log_file`, `max_log_file` и
`max_log_file_action` помогают настроить хранение; конкретные значения
выбирай для своей системы. Если есть отдельные требования к сроку хранения
или обработке ошибок записи, также выбери `space_left_action`,
`disk_full_action` и `disk_error_action`. Значения по умолчанию не являются
универсальной политикой безопасности.

## Правила

Файл: `/etc/audit/rules.d/70-local.rules`

`augenrules` читает из `/etc/audit/rules.d/` только файлы `*.rules`,
объединяет их в natural sort order и создаёт `/etc/audit/audit.rules`.
Порядок fragments влияет на набор правил; `70-local.rules` подходит для
локальных правил.

```text
# Запись и изменение атрибутов файлов учётных записей
-a always,exit -F arch=b64 -F path=/etc/passwd -F perm=wa -F key=identity
-a always,exit -F arch=b64 -F path=/etc/shadow -F perm=wa -F key=identity

# Необязательно: укажи путь к установленной программе повышения привилегий и раскомментируй
# -a always,exit -F arch=b64 -F path=/usr/bin/doas -F perm=x -F key=privilege_tool

# Необязательно: системные вызовы загрузки и выгрузки модулей ядра
# -a always,exit -F arch=b64 -S init_module,finit_module,delete_module -F key=kernel_modules
```

Для файловых правил используется syscall-форма `-F path=...`; legacy watch
`-w` устарел. В примере `arch=b64` означает 64-битный syscall ABI. На amd64
добавь соответствующие правила `b32`, если 32-битный ABI используется и его
тоже нужно аудировать; на других архитектурах выбери подходящий ABI.
Правило для модулей отслеживает syscalls загрузки и выгрузки, а не изменения
файлов в `/usr/lib/modules`.

## Загрузка и проверка

Перед загрузкой можно проверить, изменился ли собранный набор:

```bash
doas augenrules --check
```

`--check` сообщает, отличаются ли правила от `/etc/audit/audit.rules`, и не
перезаписывает этот файл. Это не полноценная проверка синтаксиса или
runtime-эффекта правил. Чтобы собрать и загрузить набор:

```bash
doas augenrules --load
doas auditctl -s
doas auditctl -l
```

При старте `auditd.service` автоматически запускает `audit-rules.service`.
После изменения fragments загружай их через `augenrules --load`;
перезапуск `auditd` не нужен. `auditctl -s` показывает состояние Audit,
а `auditctl -l` — правила, загруженные в ядро.

## Поиск событий

```bash
doas ausearch -k identity
doas aureport --summary
```

До события, подходящего под правило, поиск по ключу может не вернуть записей.

## Если правила не срабатывают

- Выполни `doas auditctl -l` и проверь, что нужные правила действительно загружены.
- Если syscall-правила загружены, но не срабатывают, проверь список на
  `never,task`: это правило отключает обработку syscall-правил для новых
  процессов.
- В выводе `doas auditctl -s` значение `enabled 2` означает immutable mode:
  менять набор правил до перезагрузки нельзя.

AppArmor передаёт security events через подсистему Linux Audit. Если `auditd`
получает эти события, их можно искать через `ausearch`. Filesystem watch на
файл журнала не нужен: он отслеживал бы запись в журнал, а не само событие.
Настройка AppArmor описана в [руководстве по AppArmor](../app-armor/).

## Откат

1. Верни предыдущую версию `/etc/audit/rules.d/70-local.rules`.
2. Выполни `doas augenrules --check`, чтобы узнать, отличается ли собранный
   набор от `/etc/audit/audit.rules`.
3. Загрузи восстановленные правила: `doas augenrules --load`.
4. Проверь активный набор: `doas auditctl -l`.

Если `auditctl -s` показывает `enabled 2`, откат правил невозможен до
перезагрузки.

## Связанные материалы

- [AppArmor в Gentoo Linux](../app-armor/) — настройка профилей и диагностика.
- [Пакет Gentoo `sys-process/audit`](https://packages.gentoo.org/packages/sys-process/audit).
- [Документация Linux Audit](https://github.com/linux-audit/audit-userspace/tree/master/docs).
