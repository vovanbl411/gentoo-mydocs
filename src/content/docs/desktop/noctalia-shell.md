---
title: Noctalia v5 для Niri
kind: guide
scope: general
status: current
last_verified: "2026-09-15"
verified_on: [asus-b5402]
---

Noctalia — нативная Wayland-оболочка вокруг Niri: панель и dock, launcher,
Control Center, уведомления, обои, экран блокировки, OSD и clipboard history.
Серия v5 больше не использует Quickshell/QML: конфигурация хранится в TOML,
а IPC вызывается через `noctalia msg`.

```text
Noctalia       = shell for Niri
Package source = выбранный Gentoo-репозиторий
Config         = ~/.config/noctalia/*.toml
GUI overrides  = ~/.local/state/noctalia/settings.toml
```

Проверенная конфигурация эталонной системы ASUS B5402 описана отдельно в
[системном журнале](../systems/asus-b5402/desktop/noctalia.md).

## Package source

Noctalia распространяется через дополнительные репозитории Gentoo. Репозиторий
может быть любым — workflow один и тот же:

```text
choose repository → sync it → inspect emerge plan → install/update Noctalia
```

1. Выбери репозиторий с ebuild'ом `gui-apps/noctalia` (например, GURU или
   сторонний overlay) и подключи его через `/etc/portage/repos.conf/`.
2. Синхронизируй:

   ```bash
   doas emaint sync -r <имя-репозитория>
   ```

3. Посмотри план Portage до установки:

   ```bash
   emerge --pretend --verbose gui-apps/noctalia
   ```

4. Установи или обнови пакет:

   ```bash
   doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
   ```

`<имя-репозитория>` — имя из соответствующего файла в
`/etc/portage/repos.conf/`.

Если Portage сообщает, что пакет или его зависимость замаскированы по
keyword, добавь только запрошенные правила в отдельный файл внутри
`/etc/portage/package.accept_keywords/`. Не копируй список с другой системы
без проверки текущего плана Portage.

Для эталонной ASUS B5402 подготовлен публичный
[noctalia-overlay](https://github.com/vovanbl411/noctalia-overlay) —
проверенный пример такого репозитория. Его подключение и сопровождение
описаны в README оверлея, фактическое состояние машины — в
[системной записи](../systems/asus-b5402/desktop/noctalia.md).

## Configuration model

Конфигурация двухслойная:

1. Hand-written TOML в `~/.config/noctalia/`. Все `*.toml` в этом каталоге
   объединяются; `config.toml` подходит для базовой конфигурации, которую
   нужно хранить явно.
2. GUI-managed overrides в `~/.local/state/noctalia/settings.toml`. Файл
   загружается позже и перекрывает значения из hand-written TOML.

Если значение из `config.toml` не применяется — сначала проверь
`settings.toml`: скорее всего, его перекрывает GUI-настройка.

## Updating

Пользовательская TOML-конфигурация живёт в `$HOME` и при обновлении пакета не
затрагивается. Обновление — это те же шаги 2 и 4 из Package source:

```bash
doas emaint sync -r <имя-репозитория>
doas emerge --ask --verbose --update --oneshot gui-apps/noctalia
```

## Verification

```bash
noctalia --version
cat /var/db/pkg/gui-apps/noctalia-*/repository
noctalia config validate
```

Первая команда выводит установленную версию, вторая — имя репозитория, из
которого Portage установил пакет. `noctalia config validate` проверяет
TOML-конфигурацию: выводит предупреждения по файлам и итоговую строку
валидации (подтверждено на noctalia 5.1.0).

## Related docs

- [Noctalia v5 на ASUS B5402](../systems/asus-b5402/desktop/noctalia.md) —
  фактическое состояние эталонной системы.
- [Niri](niri.md) — композитор, вокруг которого построена оболочка.
- [Официальный релиз Noctalia v5.1.0](https://github.com/noctalia-dev/noctalia/releases/tag/v5.1.0)
- [Noctalia v5: установка для Gentoo](https://docs.noctalia.dev/noctalia/getting-started/installation/)
- [Noctalia v5: модель конфигурации и проверка TOML](https://docs.noctalia.dev/noctalia/configuration/)
- [Noctalia v5: palettes и перенос цветовой схемы v4](https://docs.noctalia.dev/noctalia/theming/palette/)
- [Noctalia v5: исходный код](https://github.com/noctalia-dev/noctalia)
