# Auditd в Gentoo Linux

Auditd — система аудита Linux, которая записывает события безопасности в журнал. Используется для мониторинга доступа к файлам, системным вызовам и действиям пользователей.

## Установка

```bash
emerge -av sys-process/audit
```

## Настройка

### 1. Включение сервиса

```bash
doas systemctl enable --now auditd
```

### 2. Основной конфигурационный файл

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

### 3. Правила аудита

Файл: `/etc/audit/rules.d/security.rules`

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

### 4. Применение правил

```bash
doas auditctl -R /etc/audit/rules.d/security.rules
```

## Основные команды

| Команда | Описание |
|---------|----------|
| `auditctl -l` | Показать текущие правила |
| `auditctl -s` | Показать статус |
| `ausearch -k sudo_exec` | Поиск по ключу |
| `ausearch -ui 1000` | Поиск по UID пользователя |
| `aureport --summary` | Сводный отчёт |
| `aureport --failed` | Только неудачные попытки |

## Просмотр логов

```bash
# Просмотр в реальном времени
tail -f /var/log/audit/audit.log

# Поиск событий
ausearch -ts today -k sudo_exec

# Отчёт за сегодня
aureport -ts today
```

## Интеграция с AppArmor

Auditd может работать вместе с AppArmor для комплексной безопасности:

```bash
# Добавить правило для отслеживания отклонённых AppArmor событий
-w /var/log/kern.log -p wa -k apparmor_denied
```

## Анализ безопасности

### Примеры поиска угроз

```bash
# Несанкционированные попытки доступа
ausearch -i --msg type=AVC

# Удалённые подключения
ausearch -sc connect -i

# Подозрительные процессы
ausearch -sc execve -i | grep -v sudo
```
