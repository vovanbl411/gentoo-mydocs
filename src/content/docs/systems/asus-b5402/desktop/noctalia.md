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

- Работающая Noctalia сообщает версию `5.2.1` (2026-10-07).
- `GetServerInformation` возвращает `noctalia / noctalia-dev / 5.2.1 / 1.2`:
  Noctalia владеет `org.freedesktop.Notifications`.
- DND выключен; внешнее D-Bus уведомление отображается — PASS.
- Переход на `virtual/notification-daemon-0-r1::noctalia-overlay` — pending
  migration: финальный resolver PASS без temporary `package.provided`
  не предоставлен. Критерии — в [notification guide](../../../../desktop/notifications/).

Следующие сведения сохраняют прежние даты проверки; 2026-10-07 они повторно
не проверялись:

- USE включает `jemalloc` — осознанная runtime memory-allocation policy для
  long-running shell.
- Файл `~/.config/noctalia/config.toml` существует.
- Файл `~/.local/state/noctalia/settings.toml` существует.
- Содержимое обоих TOML-файлов в этом audit не проверялось.

## Package source

Публичный [noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay)
подключён к Portage. Структура, подключение и политика обновлений описаны в
README `noctalia-overlay`. Оверлей отслеживает только стабильные релизы.
Release automation проверяет новый релиз, готовит candidate ebuild и Manifest,
обновляет rotation версий и открывает Draft PR. Merge выполняется вручную
после review и runtime validation; автоматической установки пакета на
workstation нет.

Проверка 2026-09-30 подтверждала пакет 5.2.0 из `noctalia-overlay` и
`USE=jemalloc`; 2026-10-07 подтверждена версия работающего сервиса 5.2.1,
без новой сверки package metadata.

## Configuration

На системе присутствуют `~/.config/noctalia/config.toml` и
`~/.local/state/noctalia/settings.toml`. Общая модель конфигурации описана в
руководстве по Noctalia; проверка 2026-09-23 подтвердила только наличие файлов,
но не их содержимое.

## Keyword-политика

Файл: `/etc/portage/package.accept_keywords/noctalia`

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

Версия сервиса проверяется в текущей desktop-сессии:

```bash
gdbus call \
  --session \
  --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.GetServerInformation
```

Подтверждённый результат 2026-10-07:

```text
('noctalia', 'noctalia-dev', '5.2.1', '1.2')
```

Внешний вызов `Notify` показал визуальное уведомление — PASS. Это не
проверка содержимого пользовательских TOML; 2026-09-23 подтверждено только
наличие `config.toml` и `settings.toml`.

## History

Версия `5.0.1` заменила Noctalia Shell `4.7.7`. После перехода на пакет из
GURU прежний локальный overlay `/var/db/repos/noctalia-local` и его запись в
`/etc/portage/repos.conf/` были удалены. Текущий `noctalia-overlay` — отдельный
публичный оверлей, созданный позднее: кандидат был проверен
`emerge --pretend` 2026-09-15, затем `gui-apps/noctalia-5.1.0::noctalia-overlay`
заменил `5.0.1::guru` с `USE="jemalloc"` 2026-09-22.

## Related docs

- [Noctalia v5 для Niri](../../../../desktop/noctalia-shell/) — установка,
  обновление, модель конфигурации.
