---
title: Auditd в Gentoo Linux
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

Auditd записывает в журнал значимые для безопасности события и позволяет
отслеживать доступ к файлам, системные вызовы, а также действия процессов и
пользователей. Это руководство показывает базовую конфигурацию демона, пример
набора правил и способы поиска и анализа событий.

Приведённый набор правил — пример политики (example policy), а не
универсальная рекомендация для production. Его нужно адаптировать под
конкретную систему и модель угроз.

## 1. Перед включением

Правила аудита могут создавать значительный объём логов, влиять на
производительность и требовать адаптации под конкретную систему и модель
угроз. До применения оцени, какие файлы, системные вызовы и действия
действительно нужно отслеживать в этом окружении.

## 2. Установка и сервис

Установи пакет:

```bash
emerge -av sys-process/audit
```

Включи и запусти сервис:

```bash
doas systemctl enable --now auditd
```

## 3. Основная конфигурация

Файл: `/etc/audit/auditd.conf`

```conf
# Файл логов
log_file = /var/log/audit/audit.log

# Максимальный размер файла
max_log_file = 100

# Действие при переполнении
max_log_file_action = rotate

# Формат записей на диске
log_format = RAW
```

Допустимые значения `log_format` — `RAW` и `ENRICHED`. Формат timestamp в
audit records не конфигурируется через `auditd.conf`.

## 4. Правила аудита

Файл: `/etc/audit/rules.d/security.rules`

Каталог `/etc/audit/rules.d/` содержит fragment-файлы `*.rules`, которые
обрабатывает `augenrules` (раздел 5). Ниже — пример политики, не
универсальная рекомендация: адаптируй набор под конкретную систему и модель
угроз.

```bash
# Изменения критичных файлов
-a always,exit -F arch=b64 -F path=/etc/passwd -F perm=wa -F key=passwd_changes
-a always,exit -F arch=b64 -F path=/etc/shadow -F perm=wa -F key=shadow_changes
-a always,exit -F arch=b64 -F path=/etc/doas.conf -F perm=wa -F key=doas_conf_changes
# Опционально, только если используется sudo:
# -a always,exit -F arch=b64 -F path=/etc/sudoers -F perm=wa -F key=sudoers_changes
# Опционально, только если используется OpenSSH server и файл существует:
# -a always,exit -F arch=b64 -F path=/etc/ssh/sshd_config -F perm=wa -F key=sshd_config_changes

# Выполнение инструментов повышения привилегий
-a always,exit -F arch=b64 -F path=/usr/bin/doas -F perm=x -F key=doas_exec
# Опционально, только если используется sudo:
# -a always,exit -F arch=b64 -F path=/usr/bin/sudo -F perm=x -F key=sudo_exec

# Загрузка и выгрузка модулей ядра
-a always,exit -F arch=b64 -S init_module,finit_module,delete_module -F key=kernel_modules

# Опциональный широкий пример: все вызовы connect()
-a always,exit -F arch=b64 -S connect -F key=network_connect
```

Оставляй в правилах только реально существующие и нужные пути:

- `/etc/doas.conf` — relevant example для reference-системы этого проекта,
  а не универсальное требование;
- `/etc/sudoers` — имеет смысл только при использовании sudo;
- `/etc/ssh/sshd_config` — только если используется OpenSSH server и этот
  путь существует.

> **Примечание**: примеры используют `arch=b64` — правила для 64-bit syscall
> ABI. На bi-arch системах syscall rules могут требовать соответствующие
> `b32` variants; нельзя механически считать `b64` универсальным для любой
> архитектуры.

Правило `kernel_modules` отслеживает именно загрузку и выгрузку модулей
ядра (системные вызовы `init_module`, `finit_module`, `delete_module`). Это
не то же самое, что изменение файлов в `/usr/lib/modules`: для последнего
нужен отдельный filesystem watch, и он не фиксирует факт загрузки модуля.

> **Важно**: правило с `-S connect` очень широкое: оно фиксирует все вызовы
> `connect()`, включая локальные сокеты, а не только удалённые подключения.
> Такой watch может создавать большой объём событий, поэтому он оставлен как
> optional broad example.

## 5. Применение правил

```bash
doas augenrules --load
doas auditctl -l
```

`augenrules` собирает все fragment-файлы `*.rules` из `/etc/audit/rules.d/`
в итоговый `/etc/audit/audit.rules` и загружает получившийся набор.
`auditctl -l` показывает фактически загруженные правила — проверяй их после
каждой загрузки.

Команда `auditctl -R <файл>` тоже умеет загрузить конкретный файл правил,
но при работе с `rules.d` она не должна быть основным способом: она обходит
остальные fragments каталога.

## 6. Проверка и использование

### 6.1. Проверка сервиса и правил

| Команда | Описание |
|---------|----------|
| `auditctl -l` | Показать текущие правила |
| `auditctl -s` | Показать статус |
| `ausearch -k doas_exec` | Поиск по ключу |
| `ausearch -ui 1000` | Поиск по UID пользователя |
| `aureport --summary` | Сводный отчёт |
| `aureport --failed` | Только неудачные попытки |

### 6.2. Просмотр и поиск событий

```bash
# Просмотр в реальном времени
tail -f /var/log/audit/audit.log

# Поиск событий по ключу
ausearch -ts today -k doas_exec

# Отчёт за сегодня
aureport -ts today
```

### 6.3. Примеры поиска

Команды ниже ищут конкретные типы наблюдаемых записей. Наличие записи в
журнале само по себе не является security-интерпретацией — оценивай события
в контексте системы.

```bash
# AVC records (например, kernel-enforced denials MAC-подсистем вроде AppArmor);
# userspace-опосредованные события AppArmor могут попадать в USER_AVC
ausearch -i -m AVC,USER_AVC

# Записи вызовов connect() — включая локальные сокеты
ausearch -i -sc connect

# Записи выполнения программ (execve)
ausearch -i -sc execve
```

## 7. Интеграция с AppArmor

AppArmor генерирует собственные audit/security события, и auditd может их
сохранять: kernel-enforced denials попадают в audit log как AVC records, а
userspace-опосредованные события AppArmor могут попадать в USER_AVC; и те,
и другие ищутся командой из раздела 6.3. Дополнительный filesystem watch
на файл системного журнала для этого не нужен — такой watch фиксировал бы
запись в файл журнала, а не само security event.

Настройка и диагностика профилей — в [руководстве по AppArmor](../app-armor/).

## 8. Rollback и восстановление

Если новый ruleset создаёт проблемы:

1. верни предыдущую версию fragment-файла
   `/etc/audit/rules.d/security.rules`;
2. перезагрузи правила: `doas augenrules --load`;
3. проверь фактически загруженные правила: `doas auditctl -l`.

## Related docs

- [AppArmor в Gentoo Linux](../app-armor/) — настройка профилей и диагностика
  нарушений.
