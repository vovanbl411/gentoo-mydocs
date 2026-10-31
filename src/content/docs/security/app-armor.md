---
title: AppArmor в Gentoo Linux
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

AppArmor — LSM для Mandatory Access Control (MAC). Профиль описывает, к каким
файлам, возможностям и другим ресурсам может обращаться приложение. В режиме
Enforce нарушения блокируются; в режиме Complain они разрешаются и
записываются в журнал.

## Проверка поддержки ядра

Для AppArmor требуется `CONFIG_SECURITY_APPARMOR=y`. Эта опция сама включает
необходимые Audit hooks; `CONFIG_AUDIT` полезно проверять при диагностике,
но это не отдельная настройка AppArmor.

`CONFIG_SECURITY_APPARMOR=y` делает LSM доступным ядру. `CONFIG_LSM` задаёт
упорядоченный список выбираемых LSM. После загрузки проверь фактический список:

```bash
cat /sys/kernel/security/lsm
```

В списке должен быть `apparmor`. Если его нет, профили не обеспечат ожидаемое
ограничение процессов.

Параметр `lsm=` заменяет список из `CONFIG_LSM`, а не дополняет его. Если он
нужен, сначала проверь предусмотренный набор LSM и сохрани необходимые модули
и их порядок; универсального списка для `lsm=` нет.

`security=apparmor` остаётся поддерживаемым способом выбрать major LSM, но
обычную конфигурацию задают через `CONFIG_LSM`. Если задан `lsm=`, именно он
определяет итоговый список. Параметр `apparmor=1` может явно включить AppArmor,
если это допускает сборка ядра, но он не заменяет проверку активного списка и
не нужен, когда `apparmor` уже есть в `/sys/kernel/security/lsm`.

## Установка и загрузка профилей

Установи parser, init scripts и помощники для управления профилями:

```bash
doas emerge -av sys-apps/apparmor sys-apps/apparmor-utils
```

`sys-apps/apparmor` содержит parser и интеграцию запуска; пакет
`sys-apps/apparmor-utils` добавляет инструменты управления профилями.

После того как AppArmor появился в активном списке LSM, включи и запусти unit:

```bash
doas systemctl enable apparmor.service
doas systemctl start apparmor.service
```

Текущий upstream unit имеет тип `oneshot` и `RemainAfterExit=yes`: он загружает
профили при запуске, а ограничения остаются в ядре после завершения процесса
unit. `ExecStart` и `ExecReload` запускают загрузку профилей; `ConditionSecurity=apparmor`
не позволяет запустить unit, если AppArmor не активен. Состав unit зависит от
версии пакета, поэтому проверь установленный вариант командой:

```bash
systemctl cat apparmor.service
```

Для перечитывания всего набора профилей используй `reload`:

```bash
doas systemctl reload apparmor.service
```

Перед этим проверь, что установленный unit содержит `ExecReload`. Не
используй `stop` или `restart` для обычного перечитывания policy. Upstream
unit задаёт для `ExecStop` no-op, чтобы systemd не выгружал profiles при
остановке или перезапуске; полная выгрузка policy — отдельное действие.

Проверь состояние и число загруженных профилей:

```bash
doas aa-status
```

Команда показывает, включён ли AppArmor и сколько профилей загружено в режимах
Enforce и Complain.

## Enforce и Complain

- **Enforce** — нарушения профиля блокируются.
- **Complain** — нарушения разрешаются и записываются в журнал. Явные правила
  `deny` остаются блокирующими и в этом режиме.

Переключай режим только для нужного профиля:

```bash
doas aa-complain <profile>
doas aa-enforce <profile>
```

`doas aa-disable <profile>` — не третий режим: команда выгружает профиль из
ядра и отключает его автоматическую загрузку.

## Создание и изменение профиля

Для нового приложения запусти генератор:

```bash
doas aa-genprof /usr/bin/<application>
```

Если профиля ещё нет, `aa-genprof` создаёт его и переводит в Complain. Запусти
приложение в другом терминале, выполни реальные сценарии работы и разберись с
предложенными правилами. При выборе Finish генератор переводит созданные им
профили в Enforce, поэтому сначала проверь, что сценарии покрыты и правила
соответствуют нужному поведению.

Для существующего профиля:

```bash
doas aa-complain <profile>
# Выполни нужные сценарии приложения.
doas aa-logprof
```

`aa-logprof` разбирает события и сохраняет выбранные правила. Если AppArmor
работает, после завершения утилита сама перечитывает изменённые профили.
Проверь предложения `aa-logprof`: журнал показывает наблюдавшиеся обращения,
но не определяет, какие из них нужны приложению.

## Проверка и применение профиля

Для проверки синтаксиса без загрузки в ядро используй `apparmor_parser -d`:

```bash
apparmor_parser -d /etc/apparmor.d/<profile>
```

Один `-d` проверяет синтаксис. Два (`-dd`) дополнительно выводят интерпретацию
parser. Эта проверка не проверяет runtime-поведение приложения.

После ручной правки загрузи замену одного профиля:

```bash
doas apparmor_parser -r /etc/apparmor.d/<profile>
```

Для всего набора используй `doas systemctl reload apparmor.service`, если
установленный unit поддерживает `ExecReload`.

## Диагностика отказов

Если доступ приложения неожиданно блокируется, сначала проверь его режим и
найди события AppArmor:

```bash
doas aa-status
doas ausearch -m AVC,USER_AVC 2>/dev/null
doas journalctl -k -b | grep -i apparmor
```

Используй `ausearch`, если доступен userspace Audit. Без запущенного `auditd`
события ядра могут быть доступны в kernel journal. AppArmor применяет
ограничения как LSM; Auditd помогает сохранять и искать события безопасности,
но не является условием для enforcement. Подробнее — в [руководстве по
Auditd](../auditd/).

## Откат

Чтобы временно перестать блокировать действия одним профилем, оставив его
загруженным:

```bash
doas aa-complain <profile>
```

Воспроизведи проблему и изучи denial. Исправь профиль, проверь синтаксис,
перечитай только этот профиль, затем верни Enforce и проверь приложение:

```bash
apparmor_parser -d /etc/apparmor.d/<profile>
doas apparmor_parser -r /etc/apparmor.d/<profile>
doas aa-enforce <profile>
```

Если профиль нужно полностью отключить, используй `doas aa-disable <profile>`:
профиль будет выгружен из ядра и исключён из автоматической загрузки. Не
отключай остальные профили.

## Связанные материалы

- [Auditd в Gentoo Linux](../auditd/) — сохранение и поиск событий безопасности.

## Источники

- [AppArmor — документация ядра Linux](https://docs.kernel.org/admin-guide/LSM/apparmor.html)
- [Linux Security Modules — документация ядра](https://docs.kernel.org/admin-guide/LSM/index.html)
- [Kconfig AppArmor в Linux](https://github.com/torvalds/linux/blob/master/security/apparmor/Kconfig)
- [Параметры командной строки ядра Linux](https://docs.kernel.org/admin-guide/kernel-parameters.html)
- [Unit AppArmor в upstream](https://gitlab.com/apparmor/apparmor/-/raw/v5.0.2/init/apparmor.service)
- [`apparmor_parser(8)` в upstream](https://gitlab.com/apparmor/apparmor/-/raw/v5.0.2/parser/apparmor_parser.pod)
- [sys-apps/apparmor в Gentoo](https://packages.gentoo.org/packages/sys-apps/apparmor)
- [sys-apps/apparmor-utils в Gentoo](https://packages.gentoo.org/packages/sys-apps/apparmor-utils)
