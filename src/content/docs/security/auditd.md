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

# Формат времени
disp_format = raw
time_format = %Y-%m-%d %H:%M:%S
```

## 4. Правила аудита

Файл: `/etc/audit/rules.d/security.rules`

Ниже сохранён существующий пример политики. Не применяй его как универсальный
production ruleset без проверки и адаптации к своей системе и модели угроз.

```bash
# Мониторинг изменений в важных директориях
-w /etc/passwd -p wa -k passwd_changes
-w /etc/shadow -p wa -k shadow_changes
-w /etc/sudoers -p wa -k sudoers_changes
-w /etc/ssh/sshd_config -p wa -k sshd_config_changes

# Мониторинг выполнения программ
-a always,exit -F arch=b64 -S execve -F path=/usr/bin/sudo -F key=sudo_exec
-a always,exit -F arch=b64 -S execve -F path=/usr/bin/doas -F key=doas_exec

# Мониторинг сетевых соединений
-a always,exit -F arch=b64 -S connect -F key=network_connect

# Мониторинг загрузки модулей ядра
-w /usr/lib/modules/ -p wa -k modules
```

## 5. Применение правил

Загрузи правила из файла:

```bash
doas auditctl -R /etc/audit/rules.d/security.rules
```

## 6. Проверка и использование

### 6.1. Проверка сервиса и правил

| Команда | Описание |
|---------|----------|
| `auditctl -l` | Показать текущие правила |
| `auditctl -s` | Показать статус |
| `ausearch -k sudo_exec` | Поиск по ключу |
| `ausearch -ui 1000` | Поиск по UID пользователя |
| `aureport --summary` | Сводный отчёт |
| `aureport --failed` | Только неудачные попытки |

### 6.2. Просмотр и поиск событий

```bash
# Просмотр в реальном времени
tail -f /var/log/audit/audit.log

# Поиск событий
ausearch -ts today -k sudo_exec

# Отчёт за сегодня
aureport -ts today
```

### 6.3. Примеры анализа безопасности

```bash
# Несанкционированные попытки доступа
ausearch -i --msg type=AVC

# Удалённые подключения
ausearch -sc connect -i

# Подозрительные процессы
ausearch -sc execve -i | grep -v sudo
```

## 7. Интеграция с AppArmor

Auditd может работать вместе с AppArmor и записывать связанные события
безопасности. В руководстве уже использовался следующий пример правила:

```bash
# Добавить правило для отслеживания отклонённых AppArmor событий
-w /var/log/kern.log -p wa -k apparmor_denied
```

Это существующий пример из документа, а не подтверждённая настройка для любой
systemd-системы. Путь `/var/log/kern.log` нужно проверить с учётом конкретной
конфигурации журналирования; во время этой миграции он не исправлялся.
Для настройки и диагностики профилей см. [руководство по AppArmor](app-armor.md).

События AppArmor можно искать через сохранённый выше пример
`ausearch -i --msg type=AVC`.

## 8. Rollback и восстановление

Если новый ruleset создаёт проблемы, верни предыдущую версию файла
`/etc/audit/rules.d/security.rules`, повторно загрузи её командой
`doas auditctl -R /etc/audit/rules.d/security.rules` и проверь фактически
загруженные правила через `auditctl -l`.

## Related docs

- [AppArmor в Gentoo Linux](app-armor.md) — настройка профилей и диагностика
  нарушений.
