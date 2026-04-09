# AppArmor в Gentoo Linux

AppArmor — это система Mandatory Access Control (MAC), которая ограничивает программы набором разрешений доступа к файлам, возможностям и другим ресурсам.

## Установка и настройка

### 1. Ядро

Убедитесь, что в конфигурации ядра включены следующие опции:

```bash
CONFIG_SECURITY_APPARMOR=y
CONFIG_SECURITY_APPARMOR_BOOTPARAM_VALUE=1
CONFIG_AUDIT=y
```

Добавьте в параметры загрузки (CMDLINE):

```
security=apparmor lsm=landlock,bpf,apparmor
```

### 2. Установка пакетов

```bash
emerge -av sys-apps/apparmor sys-apps/apparmor-utils
```

### 3. Включение сервисов

```bash
doas systemctl enable apparmor
doas systemctl start apparmor
```

## Управление профилями

### Основные команды

| Команда | Описание |
|---------|----------|
| `apparmor_status` | Показать статус AppArmor |
| `aa-status` | Краткий статус профилей |
| `aa-complain <profile>` | Перевести профиль в режим complain |
| `aa-enforce <profile>` | Перевести профиль в режим enforce |
| `apparmor_parser -r /path/to/profile` | Перезагрузить профиль |

### Режимы работы

- **Enforce** — активная защита, блокирует нарушения
- **Complain** — только логирует нарушения, не блокирует
- **Disable** — профиль отключен

## Создание профиля

### 1. Переход в режим complain

```bash
doas aa-complain /usr/bin/application
```

### 2. Использование приложения

Запустите приложение и совершите типичные операции.

### 3. Генерация профиля

```bash
doas aa-genprof /usr/bin/application
```

Следуйте интерактивному wizard для настройки правил.

## Пример профиля

```apparmor
#include <tunables/global>
/usr/bin/example {
  #include <abstractions/base>
  
  # Файлы
  /etc/example/** r,
  /var/lib/example/ rw,
  /home/*/.config/example/** rw,
  
  # Возможности
  capability net_bind_service,
  
  # Сеть
  network inet stream,
  
  # Окружение
  environment /etc/example/env,
}
```

## Утилиты

- **aa-notify** — уведомления о нарушениях
- **logprof** — анализ логов и обновление профилей
- **genprof** — генерация профиля на основе использования

## Отладка

```bash
# Просмотр логов нарушений
dmesg | grep -i apparmor

# Или через journalctl
journalctl -b | grep -i apparmor

# Детальный анализ
apparmor_parser -d /etc/apparmor.d/profile.name
```

## Интеграция с systemd

Многие сервисы уже имеют профили в `/etc/apparmor.d/`. Проверьте:

```bash
ls -la /etc/apparmor.d/
```

Для сервисов используйте:

```bash
systemctl reload apparmor
```
