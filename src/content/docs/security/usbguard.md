---
title: USBGuard в Gentoo Linux
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

USBGuard применяет policy к USB-устройствам: разрешает, блокирует или
отклоняет их. До первого запуска подготовь начальные правила и проверь, что
они сохраняют доступ к нужным устройствам.

> **Важно:** без подходящей policy USBGuard может заблокировать клавиатуру,
> мышь, телефон, накопитель или другое необходимое устройство. До первого
> запуска подготовь способ восстановления, не зависящий от USB-устройств, которые
> собираешься фильтровать.

## 1. Установка и начальная policy

```bash
doas emerge -av sys-apps/usbguard
```

До первого запуска `usbguard.service` создай и проверь
`/etc/usbguard/rules.conf`. Gentoo ebuild отдельно предупреждает: policy нужно
создать или сгенерировать до запуска, иначе можно потерять доступ к системе.

`usbguard generate-policy` печатает правила для подключённых сейчас устройств
в стандартный вывод. Просмотри список и удали из него устройства, которым не
нужно доверять:

```bash
doas usbguard generate-policy > rules.conf
less rules.conf

doas install -m 0600 -o root -g root \
  rules.conf /etc/usbguard/rules.conf
```

Перенаправление `>` создаёт `rules.conf` в текущем каталоге от имени обычного
пользователя; `install` копирует проверенный файл в `/etc/usbguard/` с нужными
правами. Не запускай сервис, пока policy и recovery-доступ не проверены.

## 2. Параметры демона

Файл: `/etc/usbguard/usbguard-daemon.conf`

Не заменяй весь файл шаблоном. Проверь текущие значения и меняй только те
параметры, чьё поведение нужно настроить:

| Параметр | Назначение |
|----------|------------|
| `RuleFile` | Основной файл policy; начальная policy выше записывается в `rules.conf`. |
| `RuleFolder` | Дополнительный каталог с фрагментами policy. В upstream-конфигурации по умолчанию с USBGuard 1.1.3 включены оба пути — `RuleFile` и `RuleFolder`; файлы в `rules.d/` читаются в алфавитно-цифровом порядке, поэтому используй понятные префиксы вроде `10-` и `20-`. |
| `ImplicitPolicyTarget` | Решение для устройства, которому не соответствует ни одно правило. Значение `block` задаёт запрет по умолчанию; отдельное безусловное `block` в конце базовой policy для этого не требуется. |
| `PresentDevicePolicy` | Решение для уже подключённых устройств при запуске демона. `apply-policy` повторно проверяет их по policy и может изменить состояние авторизации. |
| `InsertedDevicePolicy` | Решение для устройств, подключённых после запуска. `apply-policy` проверяет их по policy. |
| `AuditBackend` | Выбирает `FileAudit` или `LinuxAudit`. Зависимость Gentoo от `sys-process/audit` сама по себе не означает, что для применения USB policy обязательно должен работать `auditd`. |

`ImplicitPolicyTarget=block`, `PresentDevicePolicy=apply-policy` и
`InsertedDevicePolicy=apply-policy` часто выбирают для строгой policy, но это
не обязательные значения для каждой системы. Выбери поведение с учётом нужных
устройств и способа восстановления.

Если используешь `RuleFolder`, храни фрагменты в `/etc/usbguard/rules.d/` и
задавай им числовые префиксы. Не предполагай относительный порядок загрузки
`RuleFile` и `RuleFolder`, если это отдельно не определено документацией для
твоей версии USBGuard.

## 3. Порядок правил и решения для устройств

USBGuard проверяет правила последовательно. Первое совпавшее правило задаёт
решение; последующие правила не переопределяют его. Поэтому более
специфичные `allow`, `block` и `reject` должны стоять раньше общих правил.
Фрагменты в `RuleFolder` также учитываются в алфавитно-цифровом порядке
имён файлов.

Пример синтаксиса — замени placeholders атрибутами своих устройств:

```text
allow id <vendor-id>:<product-id>
```

При `ImplicitPolicyTarget=block` устройство без совпавшего правила уже будет
заблокировано. Не добавляй в базовую policy безусловное правило `block`: оно
может сделать добавленные позже постоянные `allow` недостижимыми.

`list-devices` показывает внутренние ID устройств, а не VID:PID:

| Действие | Runtime decision | Постоянное правило |
|----------|------------------|--------------------|
| Разрешить | `doas usbguard allow-device <id>` | `doas usbguard allow-device -p <id>` |
| Заблокировать | `doas usbguard block-device <id>` | `doas usbguard block-device -p <id>` |
| Отклонить и удалить из системы | `doas usbguard reject-device <id>` | `doas usbguard reject-device -p <id>` |

Команда без `-p` меняет текущее состояние авторизации устройства, но не
сохраняет device-specific правило. Такое решение может измениться при
отключении и повторном подключении устройства, рестарте демона или повторном
применении policy — раньше перезагрузки системы.

Флаг `-p` добавляет постоянное device-specific правило в текущую policy.
После команды проверь `doas usbguard list-rules` и
`doas usbguard list-devices`. Если раньше уже стоит более общее совпавшее
`block` или `reject`, добавленный в конец `allow` не обязательно разрешит
устройство.

`append-rule` оставь для ручного редактирования policy:

```bash
doas usbguard append-rule 'allow id <vendor-id>:<product-id>'
doas usbguard append-rule --after <rule-id> 'allow id <vendor-id>:<product-id>'
doas usbguard list-rules
```

Команда добавляет правило в упорядоченный список. `--after <rule-id>` задаёт
позицию относительно существующего правила; после изменения проверь результат
через `list-rules`.

## 4. IPC access control

USBGuard CLI общается с демоном через IPC. Если управлять им будет только
администратор, достаточно полного доступа для root:

```text
IPCAllowedUsers=root
```

`IPCAllowedUsers` и `IPCAllowedGroups` дают перечисленным пользователям или
группам полный IPC-доступ. Не добавляй `wheel`, если такой доступ не нужен.
Для пользователей с ограниченными правами upstream рекомендует ACL с
точечно заданными правами в `/etc/usbguard/IPCAccessControl.d/` или команду
`usbguard add-user`:

```bash
doas usbguard add-user <username> \
  --devices=list,modify,listen \
  --policy=list \
  --exceptions=listen
```

Этот пример разрешает управлять устройствами и читать policy, но не менять
policy. ACL-файлы, созданные вручную, должны иметь права `0600`. Новая ACL,
созданная `add-user`, вступит в силу после перезапуска демона; учитывай, что
при `PresentDevicePolicy=apply-policy` перезапуск повторно проверит уже
подключённые устройства.

D-Bus bridge — необязательная Gentoo-функция (`USE=dbus`). Его авторизация
проходит через D-Bus/Polkit и не заменяет native USBGuard IPC ACL.

## 5. Первый запуск и безопасная проверка

Перед запуском ещё раз проверь policy, необходимые разрешённые устройства и
локальный recovery-доступ. Затем запусти сервис:

```bash
doas systemctl start usbguard.service
```

Не делай `restart` «на всякий случай». Если `PresentDevicePolicy=apply-policy`,
запуск или рестарт может немедленно изменить authorization state уже
подключённых устройств.

Следующие команды читают состояние демона и не меняют решения для устройств:

```bash
systemctl status usbguard.service --no-pager
doas usbguard get-parameter ImplicitPolicyTarget
doas usbguard list-rules
doas usbguard list-devices
doas journalctl -b -u usbguard.service --no-pager
```

`list-rules` показывает загруженную policy и её порядок, а `list-devices` —
текущие решения по устройствам.

Если все проверки прошли успешно, включи сервис в автозагрузку:

```bash
doas systemctl enable usbguard.service
```

Если проверка не прошла, не включай сервис в автозагрузку, пока не устранишь
причину и не проверишь policy повторно.

## 6. Gentoo: предупреждение о `.keep`

Если в журнале есть сообщение:

```text
Ignoring access control file because of malformed name: .keep_sys-apps_usbguard-0
```

проверь, что оно относится к заглушке Gentoo в
`/etc/usbguard/IPCAccessControl.d/`. Имя ACL-файла должно обозначать
пользователя или группу, поэтому daemon игнорирует `.keep`. Удали только эту
заглушку, если она существует:

```bash
doas rm -- /etc/usbguard/IPCAccessControl.d/.keep_sys-apps_usbguard-0
```

Не удаляй реальные ACL или policy-файлы. Перезапускать демон только ради
удаления заглушки не нужно.

## 7. Откат

Перед изменением сохрани `/etc/usbguard/usbguard-daemon.conf`,
`/etc/usbguard/rules.conf` и весь каталог `/etc/usbguard/rules.d/` в резервную
копию с правами `0700`, доступную только root:

```bash
backup_dir="/root/usbguard-backup-$(date +%F-%H%M%S)"
doas install -d -m 0700 "$backup_dir"
doas cp -a /etc/usbguard/. "$backup_dir/"
```

Если policy заблокировала нужное устройство:

1. Войди через локальный или другой способ восстановления, который не зависит от
   заблокированного USB-устройства.
2. Восстанови прежнюю конфигурацию демона и policy из резервной копии.
3. Проверь порядок правил и конфликтующие совпадения.
4. Только после этого применяй восстановленную policy или перезапускай демон.
   При `PresentDevicePolicy=apply-policy` рестарт повторно проверяет уже
   подключённые устройства.
5. Проверь `list-rules`, `list-devices`, статус сервиса и журнал.

## Источники

- [Gentoo: `sys-apps/usbguard`](https://packages.gentoo.org/packages/sys-apps/usbguard)
- [Upstream: `usbguard(1)`](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard.1.adoc)
- [Upstream: `usbguard-daemon.conf(5)`](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard-daemon.conf.5.adoc)
- [Upstream: `usbguard-rules.conf(5)`](https://github.com/USBGuard/usbguard/blob/main/doc/man/usbguard-rules.conf.5.adoc)
