---
title: Noctalia v5 на ASUS ExpertBook B5402
kind: system
scope: system
status: current
last_verified: "2026-10-07"
verified_on: [asus-b5402]
---

Файл фиксирует состояние Noctalia на эталонной системе. Установка, обновление
и общая модель конфигурации описаны в
[`desktop/noctalia-shell.md`](../../../../desktop/noctalia-shell/).

## Current state

Noctalia — оболочка рабочего стола и обработчик уведомлений. Приложения могут
отправлять ей уведомления через библиотеку `x11-libs/libnotify`.
`gui-apps/noctalia` установлен из [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
с USE `jemalloc`.

Установленный виртуальный пакет `virtual/notification-daemon::noctalia-overlay`
сообщает Portage, что Noctalia может выполнять роль обработчика уведомлений;
сам виртуальный пакет ничего не запускает. Подробности и проверка доставки —
в [руководстве по уведомлениям](../../../../desktop/notifications/).

## Package source

Публичный [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
подключён к Portage. Структура, подключение и политика обновлений описаны в
README `noctalia-overlay`. Оверлей отслеживает только стабильные релизы.

## Configuration

На системе присутствуют `~/.config/noctalia/config.toml` и
`~/.local/state/noctalia/settings.toml`. Общая модель конфигурации описана в
руководстве по Noctalia; проверка 2026-09-23 подтвердила только наличие файлов,
но не их содержимое.

## Keyword-политика

Исторический файл на дату прежней проверки: `/etc/portage/package.accept_keywords/noctalia`

```text
gui-apps/noctalia                ~amd64
dev-cpp/sdbus-c++                ~amd64
```

Правила отражают план Portage на дату проверки. Перед удалением или
расширением списка нужно повторить `emerge --pretend` для текущей версии.

## Verification

```bash
noctalia --version
cat /var/db/pkg/gui-apps/noctalia-*/repository
```

Первая команда показывает версию Noctalia, вторая — репозиторий установленного
пакета (`noctalia-overlay`). Чтобы узнать, кто показывает уведомления в
текущей сессии, вызови:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

Если уведомления показывает Noctalia, в ответе имя сервера — `noctalia`.
Результат проверки в Niri:

```text
('noctalia', 'noctalia-dev', '5.2.1', '1.2')
```

Внешний вызов `Notify` показал визуальное уведомление — PASS. Это не
проверка содержимого пользовательских TOML; 2026-09-23 подтверждено только
наличие `config.toml` и `settings.toml`.

## History

Проверка 2026-09-30 подтверждала пакет 5.2.0 из `noctalia-overlay` и
`USE=jemalloc`; 2026-10-07 подтверждена версия работающего сервиса 5.2.1,
без новой сверки package metadata.

Версия `5.0.1` заменила Noctalia Shell `4.7.7`. После перехода на пакет из
GURU прежний локальный overlay `/var/db/repos/noctalia-local` и его запись в
`/etc/portage/repos.conf/` были удалены. Текущий `noctalia-overlay` — отдельный
публичный оверлей, созданный позднее: кандидат был проверен
`emerge --pretend` 2026-09-15, затем `gui-apps/noctalia-5.1.0::noctalia-overlay`
заменил `5.0.1::guru` с `USE="jemalloc"` 2026-09-22.

## Related docs

- [Noctalia v5 для Niri](../../../../desktop/noctalia-shell/) — установка,
  обновление, модель конфигурации.
