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
IPCAccessControlFiles=/etc/usbguard/IPCAccessControl.d/

# Аудит
AuditBackend=FileAudit
AuditFilePath=/var/log/usbguard/usbguard-audit.log
```

`RuleFile` — основной путь правил. Актуальные версии USBGuard дополнительно
поддерживают `RuleFolder=/etc/usbguard/rules.d/`; `RuleFile` и `RuleFolder`
можно использовать одновременно. Руководство остаётся на `RuleFile` (про
файлы в `rules.d` — раздел 4).

### IPC через Unix domain socket

> **Важно:** у `usbguard-daemon.conf` нет опций `IpAddress` / `Port`. IPC —
> это Unix domain socket, а не TCP. При наличии таких строк демон стартовать
> не будет. См. [usbguard.github.io: Configuration](https://usbguard.github.io/documentation/configuration)
> и [RHEL 8 Security hardening: USBGuard](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/security_hardening/protecting-systems-against-intrusive-usb-devices_security-hardening).

### IPC access control

`IPCAllowedUsers` и `IPCAllowedGroups` — legacy-механизм: перечисленные в них
пользователи и группы получают полный IPC access. Поэтому baseline выше не
добавляет группу `wheel`: root с полным access достаточен для
администрирования, а полный modify-access для всей группы не является
нейтральным security baseline.

Non-root доступ лучше выдавать гранулярно — через ACL-файлы в
`/etc/usbguard/IPCAccessControl.d/` или командой `usbguard add-user`. ACL
может отдельно разрешать `Devices=list/modify/listen`,
`Policy=list/modify`, `Exceptions=listen` и отдельные `Parameters`.
ACL-файлы, созданные вручную, должны иметь mode `0600`.

Необязательный пример ограниченного доступа:

```bash
doas usbguard add-user <username> \
  --devices=list,modify,listen \
  --policy=list \
  --exceptions=listen
```

ACL, созданный через `usbguard add-user`, вступает в силу только после
перезапуска `usbguard-daemon`; перед restart учти эффект
`PresentDevicePolicy=apply-policy` (раздел 1). Это пример гранулярного
доступа, а не policy конкретной системы.

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

`usbguard generate-policy` разрешает устройства, подключённые в момент
генерации, поэтому сгенерированный список нужно просмотреть до применения.

Команда `doas usbguard generate-policy > /etc/usbguard/rules.conf` некорректна
по shell privilege semantics: перенаправление `>` выполняет shell текущего
пользователя до запуска `doas`, файл открывается с правами непривилегированного
пользователя, и запись в `/etc/usbguard/` завершится отказом в доступе.

Безопасный workflow:

```bash
# Сгенерировать базовые правила по текущим устройствам
doas usbguard generate-policy > rules.conf

# Просмотреть сгенерированные правила до применения
less rules.conf

# Установить файл с root ownership и restrictive mode
doas install -m 0600 -o root -g root \
  rules.conf /etc/usbguard/rules.conf
```

## 6. Пример файла правил

Это пример policy, а не универсальный ruleset. Перед применением сопоставь
правила со своими устройствами.

```text
# Разрешить клавиатуру и мышь
allow id 046d:c52b name "Logitech Unifying Device"
allow id 046d:c534 name "Logitech USB Receiver"

# Разрешить Android-устройства в режиме PTP
allow id 0fce:71b2 name "MTP Device"

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
| `usbguard allow-device <id>` | Разрешить устройство (runtime) |
| `usbguard block-device <id>` | Заблокировать устройство (runtime) |
| `usbguard reject-device <id>` | Отклонить устройство (runtime) |
| `usbguard list-rules` | Показать текущую политику |
| `usbguard append-rule "allow ..."` | Добавить правило в политику |
| `usbguard remove-rule <id>` | Удалить правило из политики |

### Временные и постоянные решения

`allow-device`, `block-device` и `reject-device` без `-p` меняют
authorization state устройства только в runtime и **не** сохраняют
device-specific правило в persistent policy. Такое решение не живёт «до
reboot»: оно может потерять силу и раньше — при отключении и повторном
подключении устройства, рестарте демона или повторном применении policy.
Основная граница здесь — runtime-only против persisted policy.

Постоянная форма добавляет соответствующее device-specific правило в policy:

```bash
usbguard allow-device -p <id>
usbguard block-device -p <id>
usbguard reject-device -p <id>
```

У `append-rule` наоборот: обычный вызов изменяет persistent policy, а
`append-rule -t 'allow ...'` создаёт temporary rule и не обновляет файл
политики.

### Примеры работы

```bash
# Просмотр подключённых устройств
usbguard list-devices

# Разрешить устройство в runtime (правило в policy не добавляется)
usbguard allow-device 2

# Добавить постоянное правило
usbguard append-rule 'allow id 046d:c52b'

# Заблокировать устройство в runtime
usbguard block-device 3

# Показать текущую политику
usbguard list-rules
```

## 9. PAM

USBGuard не требует отдельного PAM-stack для обычного IPC- или
D-Bus-authorization path. Не создавай `/etc/pam.d/usbguard` только ради
доступа к USBGuard — используй IPC ACL USBGuard, а для optional D-Bus bridge
соответствующую модель авторизации D-Bus/Polkit.

## 10. Интеграция с D-Bus

D-Bus bridge — optional feature: в Gentoo `sys-apps/usbguard` собирается с
USE-флагом `dbus`, и наличие запущенного демона само по себе не означает, что
bridge доступен. Авторизация D-Bus-операций — отдельный вопрос
D-Bus/Polkit-конфигурации.

Read-only запрос списка устройств через bridge:

```bash
busctl --system call \
  org.usbguard1 \
  /org/usbguard1/Devices \
  org.usbguard.Devices1 \
  listDevices \
  s match
```

Здесь `org.usbguard1` — service name, `/org/usbguard1/Devices` — object path,
`org.usbguard.Devices1` — interface; метод `listDevices` принимает string
query.

## 11. Проверка и мониторинг

Проверь состояние и журнал демона, текущую policy, список устройств и журнал
аудита. Эти команды не означают, что проверка уже выполнялась на ASUS B5402.

```bash
# Состояние демона
systemctl status usbguard

# Текущая политика и список устройств
usbguard list-rules
usbguard list-devices

# Просмотр логов
journalctl -u usbguard -f

# Просмотр аудита
cat /var/log/usbguard/usbguard-audit.log
```

## 12. Security recommendations

1. **ImplicitPolicyTarget=block** — target для устройств, не совпавших ни с
   одним правилом policy. Допустимые значения — `allow`, `block`, `reject`;
   `block` — пример deny-by-default policy, а не обязательное значение для
   каждой системы.
2. **Регулярно обновлять правила** — добавлять только нужные устройства.
3. **Атрибуты идентификации устройства** — serial number при наличии и
   надёжности делает правило более специфичным, но он может отсутствовать,
   быть некорректным или совпадать у разных устройств. Комбинируй подходящие
   атрибуты (`id`, `serial`, `name`, `via-port`, `hash`, `parent-hash`,
   `with-interface`) и всегда просматривай сгенерированную policy до
   применения.
4. **Аудит подключений** — логировать события подключений.

### Пример угрозы

Неизвестное устройство при подключении сверяется с правилами policy. Если ни
одно правило не совпало и задан `ImplicitPolicyTarget=block`, устройство
блокируется. Точный вид audit-записи зависит от версии USBGuard, audit
backend и данных устройства — ориентируйся на фактический журнал аудита, а не
на конкретный формат сообщения.

## 13. Rollback и восстановление

До изменения сохрани предыдущие конфигурацию и правила. Если новая policy
блокирует нужные устройства, верни прежние файлы и повторно проверь policy и
список устройств. Не перезапускай USBGuard без необходимости: при
`PresentDevicePolicy=apply-policy` перезапуск может повторно применить policy к
уже подключённым устройствам.
