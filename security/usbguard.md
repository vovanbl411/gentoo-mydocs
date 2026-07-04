# USBGuard в Gentoo Linux

USBGuard — система контроля и защиты от атаки через USB-устройства. Позволяет разрешать или блокировать подключение устройств на основе политик.

## Установка

```bash
emerge -av sys-apps/usbguard
```

## Настройка

### 1. Включение сервиса

```bash
doas systemctl enable --now usbguard
```

### 2. Основной конфигурационный файл

Файл: `/etc/usbguard/usbguard-daemon.conf`

```conf
# Файл с правилами
RuleFile=/etc/usbguard/rules.conf

# Реакция на уже подключённые и вновь подключаемые устройства
ImplicitPolicyTarget=block
PresentDevicePolicy=apply-policy
PresentControllerPolicy=keep
InsertedDevicePolicy=apply-policy
RestoreControllerDeviceState=false

# Backend уведомлений от ядра
DeviceManagerBackend=uevent

# Кто может общаться с демоном по IPC (Unix domain socket)
IPCAllowedUsers=root
IPCAllowedGroups=wheel
IPCAccessControlFiles=/etc/usbguard/IPCAccessControl.d/

# Аудит
AuditBackend=FileAudit
AuditFilePath=/var/log/usbguard/usbguard-audit.log
```

> **Важно:** у `usbguard-daemon.conf` нет опций `IpAddress` / `Port`. IPC — это Unix domain socket, а не TCP. При наличии таких строк демон стартовать не будет. См. [usbguard.github.io: Configuration](https://usbguard.github.io/documentation/configuration) и [RHEL 8 Security hardening: USBGuard](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/security_hardening/protecting-systems-against-intrusive-usb-devices_security-hardening).

### 3. Создание начальных правил

```bash
# Сгенерировать базовые правила на основе текущих устройств
doas usbguard generate-policy > /etc/usbguard/rules.conf
```

### 4. Пример файла правил

```
# Разрешить клавиатуру и мышь
allow id 046d:c52b serial="*" name="Logitech Unifying Device" parent-id=1:1
allow id 046d:c534 serial="*" name="Logitech USB Receiver"

# Разрешить Android-устройства в режиме PTP
allow id 0fce:71b2 serial="*" name="MTP Device"

# Блокировать все неизвестные устройства
block
```

## Управление

### Основные команды

| Команда | Описание |
|---------|----------|
| `usbguard list-devices` | Показать все USB-устройства |
| `usbguard allow-device <id>` | Разрешить устройство |
| `usbguard block-device <id>` | Заблокировать устройство |
| `usbguard reject-device <id>` | Отклонить устройство (удалить) |
| `usbguard get-policy` | Показать текущую политику |
| `usbguard append-rule "allow ..."` | Добавить правило |
| `usbguard remove-rule <id>` | Удалить правило |

### Примеры работы

```bash
# Просмотр подключённых устройств
usbguard list-devices

# Разрешить устройство временно (до перезагрузки)
usbguard allow-device 2

# Добавить постоянное правило
usbguard append-rule 'allow id 046d:c52b serial="*"'

# Заблокировать конкретное устройство
usbguard block-device 3
```

## Интеграция с PAM

Для аутентификации при изменении правил:

```bash
# Добавить в /etc/pam.d/usbguard
auth sufficient pam_rootok.so
auth sufficient pam_permit.so
account sufficient pam_permit.so
session sufficient pam_permit.so
```

## Интеграция с D-Bus

```bash
# Управление через D-Bus
dbus-send --system --dest=org.usbguard.Daemon1 /org/usbguard/Daemon1 org.usbguard.Daemon1.ListDevices
```

## Мониторинг и логи

```bash
# Просмотр логов
journalctl -u usbguard -f

# Просмотр аудита
cat /var/log/usbguard/usbguard-audit.log
```

## Безопасность

### Рекомендации

1. **DefaultPolicy=block** — блокировать все неизвестные устройства
2. **Регулярно обновлять правила** — добавлять только нужные устройства
3. **Использовать серийные номера** — для уникальной идентификации
4. **Аудит подключений** — логировать все события

### Пример угрозы

```
# Злоумышленник подключает Rubber Ducky
# USBGuard заблокирует и запишет в лог:
type=DEVICE_ADDED id=05ac:024f serial="..." name="USB Keyboard"
target=block policy_id=1
```
