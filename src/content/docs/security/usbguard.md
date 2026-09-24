---
title: USBGuard в Gentoo Linux
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

USBGuard применяет policy к подключаемым USB-устройствам и позволяет
разрешать, блокировать или отклонять их. Руководство охватывает конфигурацию
демона, начальную policy, управление устройствами, IPC, мониторинг и
аспекты безопасности.

Строгая policy может заблокировать необходимое устройство. Подготовь
конфигурацию и начальные правила до включения сервиса и применения строгого
режима.

## 1. Перед включением

До запуска сервиса:

- определи, какие USB-устройства подключены сейчас и какие из них должны
  остаться разрешёнными;
- проверь путь к policy — в примере это `/etc/usbguard/rules.conf`;
- учти, что `PresentDevicePolicy=apply-policy` может повторно применить policy
  к уже подключённым устройствам;
- подготовь восстановление на случай, если неправильный ruleset заблокирует
  клавиатуру, мышь, USB-накопитель или другое необходимое устройство.

## 2. Установка

```bash
emerge -av sys-apps/usbguard
```

## 3. Конфигурация демона

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

### IPC через Unix domain socket

> **Важно:** у `usbguard-daemon.conf` нет опций `IpAddress` / `Port`. IPC —
> это Unix domain socket, а не TCP. При наличии таких строк демон стартовать
> не будет. См. [usbguard.github.io: Configuration](https://usbguard.github.io/documentation/configuration)
> и [RHEL 8 Security hardening: USBGuard](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/security_hardening/protecting-systems-against-intrusive-usb-devices_security-hardening).

## 4. `.keep`-файлы в каталогах конфигурации

Пакет Gentoo может оставить пустые файлы-заглушки
`.keep_sys-apps_usbguard-0` для сохранения каталогов. Для USBGuard это не
конфигурация: имя файла в `IPCAccessControl.d` должно обозначать пользователя,
UID или группу, а файлы в `rules.d` следует начинать с двузначного номера.
`.keep` в `IPCAccessControl.d` вызывает предупреждение о некорректном имени.
Одноимённый файл в `rules.d` не является правилом и также не нужен.

Если в журнале есть это предупреждение, удали только файлы-заглушки:

```bash
doas rm -- \
  /etc/usbguard/IPCAccessControl.d/.keep_sys-apps_usbguard-0 \
  /etc/usbguard/rules.d/.keep_sys-apps_usbguard-0
```

> **Важно:** не удаляй реальные ACL-файлы в `IPCAccessControl.d`, правила в
> `rules.d` или `/etc/usbguard/rules.conf`.

Не перезапускай USBGuard только ради удаления предупреждений: при
`PresentDevicePolicy=apply-policy` это повторно применит политику к
подключённым устройствам. Проверь журнал после следующей обычной загрузки:

```bash
doas journalctl -b -u usbguard --no-pager
```

Если `.keep`-файлы вернутся после обновления `sys-apps/usbguard`, сообщи об
этом в Gentoo Bugzilla: пакет помещает файлы-заглушки в каталоги, которые
USBGuard обрабатывает как конфигурацию.

## 5. Создание начальной policy

Ниже сохранён существующий пример команды из документа. Семантика
перенаправления shell во время этой миграции не исправлялась.

```bash
# Сгенерировать базовые правила на основе текущих устройств
doas usbguard generate-policy > /etc/usbguard/rules.conf
```

## 6. Пример файла правил

Это пример policy, а не универсальный ruleset. Перед применением сопоставь
правила со своими устройствами.

```text
# Разрешить клавиатуру и мышь
allow id 046d:c52b serial="*" name="Logitech Unifying Device" parent-id=1:1
allow id 046d:c534 serial="*" name="Logitech USB Receiver"

# Разрешить Android-устройства в режиме PTP
allow id 0fce:71b2 serial="*" name="MTP Device"

# Блокировать все неизвестные устройства
block
```

## 7. Включение сервиса

Включай сервис после подготовки конфигурации и начальной policy:

```bash
doas systemctl enable --now usbguard
```

## 8. Управление

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

Семантика временных и постоянных правил в этих существующих примерах во время
структурной миграции не проверялась.

## 9. Интеграция с PAM

Ниже сохранён существующий пример PAM. Он требует отдельной проверки под
конкретную PAM policy и не является универсально безопасной конфигурацией.

```bash
# Добавить в /etc/pam.d/usbguard
auth sufficient pam_rootok.so
auth sufficient pam_permit.so
account sufficient pam_permit.so
session sufficient pam_permit.so
```

## 10. Интеграция с D-Bus

```bash
# Управление через D-Bus
dbus-send --system --dest=org.usbguard.Daemon1 /org/usbguard/Daemon1 org.usbguard.Daemon1.ListDevices
```

## 11. Проверка и мониторинг

Проверь состояние и журнал демона, текущую policy, список устройств и журнал
аудита. Эти команды не означают, что проверка уже выполнялась на ASUS B5402.

```bash
# Состояние демона
systemctl status usbguard

# Текущая политика и список устройств
usbguard get-policy
usbguard list-devices

# Просмотр логов
journalctl -u usbguard -f

# Просмотр аудита
cat /var/log/usbguard/usbguard-audit.log
```

## 12. Security recommendations

Ниже сохранены существующие рекомендации. Формулировка
`DefaultPolicy=block` не унифицирована с `ImplicitPolicyTarget=block` из
основной конфигурации и требует будущего content-audit.

1. **DefaultPolicy=block** — блокировать все неизвестные устройства
2. **Регулярно обновлять правила** — добавлять только нужные устройства
3. **Использовать серийные номера** — для уникальной идентификации
4. **Аудит подключений** — логировать все события

### Пример угрозы

```text
# Злоумышленник подключает Rubber Ducky
# USBGuard заблокирует и запишет в лог:
type=DEVICE_ADDED id=05ac:024f serial="..." name="USB Keyboard"
target=block policy_id=1
```

## 13. Rollback и восстановление

До изменения сохрани предыдущие конфигурацию и правила. Если новая policy
блокирует нужные устройства, верни прежние файлы и повторно проверь policy и
список устройств. Не перезапускай USBGuard без необходимости: при
`PresentDevicePolicy=apply-policy` перезапуск может повторно применить policy к
уже подключённым устройствам.
