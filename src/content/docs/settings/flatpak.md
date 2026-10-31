---
title: "Flatpak: приложения, permissions и обслуживание"
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: []
---

Flatpak устанавливает и запускает sandboxed applications из настроенных remotes,
локальных sources или bundles. Для публичных desktop applications часто
используют Flathub. Доступ приложения к ресурсам зависит от permissions в
установленном metadata, локальных overrides и portals, если приложение умеет
ими пользоваться.

## Установки и remotes

Flatpak поддерживает system installation, user installation и дополнительные
именованные system installations. System installation доступна всем
пользователям машины; user installation — только текущему пользователю. В
руководстве подробно рассматриваются первые два варианта.

Большинство команд управления без scope работает с default system installation;
`--user` выбирает user installation. Но `flatpak info` и `flatpak list` без
scope опрашивают обе стандартные установки, `flatpak update` обновляет обе, а
`flatpak uninstall` ищет ref в обеих. Указывай scope, когда важно выбрать одну
установку. Для именованной system installation используй `--installation=<name>`.

Remote — источник приложений и runtimes. Flathub часто используют для публичных
desktop applications, но Flatpak также устанавливает refs из других
настроенных remotes и локальных sources или bundles. Добавляй remote в тот
scope, где будут приложения; в обеих установках он нужен только тогда, когда
приложения будут устанавливаться в обе.

User remote:

```bash
flatpak remote-add --user --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

System remote:

```bash
flatpak remote-add --system --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

Устанавливай и проверяй приложение в том же scope, где находится его remote:

```bash
# User installation
flatpak install --user flathub <app-id>
flatpak info --user <app-id>

# System installation
flatpak install --system flathub <app-id>
flatpak info --system <app-id>
```

Не удаляй remote только потому, что сейчас не видишь установленных из него
приложений. Перед удалением проверь refs и подтверди, что remote больше не
нужен.

## Permissions и portals

Эффективный доступ приложения складывается из нескольких частей:

| Источник | Что задаёт |
|----------|------------|
| Manifest и metadata установленного ref | Постоянные sandbox permissions приложения. |
| Local overrides | Изменения permissions в per-user или system-wide слое overrides. |
| Portals | Доступ к отдельным host resources через запрос приложения и desktop-mediated API. |

Portal может, например, открыть выбор файла или источника для screen capture.
Он не всегда заменяет постоянный filesystem permission: это зависит от того,
поддерживает ли приложение нужный portal.

Не настраивай compositor или portal backend здесь. Маршрутизация и backend
описаны в [руководстве по Wayland portals](../../desktop/wayland-portals/).

## Проверка permissions и overrides

`flatpak info --show-permissions` показывает permissions установленного ref.
`flatpak override --show` показывает overrides; это отдельный слой. Параметр
scope у `info` выбирает installation приложения, а у `override` — per-user или
system-wide слой overrides. Per-user override может менять доступ приложения,
установленного в system scope. Для диагностики проверь оба слоя overrides.

Проверка metadata приложения:

```bash
flatpak info --user --show-permissions <app-id>
flatpak info --system --show-permissions <app-id>
```

Проверка per-user и system-wide overrides:

```bash
flatpak override --user --show <app-id>
flatpak override --system --show <app-id>
```

Добавляй override только для подтверждённой потребности конкретного приложения:

```bash
flatpak override --user <specific-option> <app-id>
```

`--user` сохраняет per-user override; `--system` сохраняет system-wide
override. Параметр `--reset` удаляет все overrides этого приложения в выбранном
слое, а не только последнее изменение:

```bash
flatpak override --user --reset <app-id>
flatpak override --system --reset <app-id>
```

Flatseal — необязательный GUI для просмотра и изменения overrides. Это не
средство безопасности и не источник истины: сверяй установленное metadata и
overrides через Flatpak CLI.

## Локальные сборки и `extra-data`

`flatpak-builder` может экспортировать собранный ref в локальный OSTree
repository; из него при необходимости создают single-file bundle и затем
устанавливают его:

```bash
flatpak-builder --repo=repo build-dir manifest.yml
flatpak build-bundle repo app.flatpak <app-id>
flatpak install --user ./app.flatpak
```

Для system installation укажи `--system` в команде установки. Используй один и
тот же выбранный scope при установке, обновлении и проверке локально собранного
приложения.

Для source типа `extra-data` ref хранит metadata источника. При установке
Flatpak загружает внешний payload, проверяет его checksum и выполняет локальный
`apply_extra`; payload не обязан заранее находиться в build repository. Пример
такого workflow — [ChatGPT Desktop](../chatgpt-desktop/).

## Обновления

Обновляй установки отдельно, чтобы scope был явным:

```bash
flatpak update --user
flatpak update --system
```

Без `--user`, `--system` или `--installation` `flatpak update` обновляет refs
в обеих стандартных установках. Явный параметр выбирает одну установку.

`flatpak update` обновляет refs из настроенных источников. Локально собранное
приложение без application remote не получает новую upstream-версию из Git
repository автоматически: собери новый ref или bundle и установи его отдельно.
Особенности обновления ChatGPT Desktop описаны в
[его руководстве](../chatgpt-desktop/).

## EOL runtimes и pins

При обновлении Flatpak может предложить удалить неиспользуемые EOL runtimes.
Явно установленные runtimes и pinned refs могут остаться, даже если Flatpak
считает их неиспользуемыми; предупреждение об EOL не означает, что приложение
сломано. Перед удалением выбери installation, проверь pins и зависимости.

```bash
# System installation
flatpak pin
flatpak list --system --app --columns=application,runtime,installation
flatpak list --system --runtime --all \
  --columns=application,branch,installation

# User installation
flatpak pin --user
flatpak list --user --app --columns=application,runtime,installation
flatpak list --user --runtime --all \
  --columns=application,branch,installation
```

Колонка `runtime` показывает основной runtime, но не все extensions. Проверь их
по dependency metadata или manifest: `flatpak info --system --show-extensions <app-id>`
выводит matching extensions (для user installation используй `--user`).
Различие branch основного runtime не доказывает, что extension не используется.
Если зависимость установить не удалось, ref не удаляй.

После подтверждения сними только pin нужного ref и удали его branch из выбранной
installation. Если Flatpak предлагает удалить зависимое приложение, остановись
и проверь зависимости ещё раз. Подставь настоящий `<runtime-id>`, `<arch>` и
`<branch>`:

```bash
# System installation
flatpak pin --system --remove \
  runtime/<runtime-id>/<arch>/<branch>
flatpak uninstall --system \
  <runtime-id>//<branch>

# User installation
flatpak pin --user --remove \
  runtime/<runtime-id>/<arch>/<branch>
flatpak uninstall --user \
  <runtime-id>//<branch>
```

`flatpak uninstall --unused` удаляет refs, которые Flatpak считает
неиспользуемыми в выбранной installation. Pins могут помешать очистке; команда
не заменяет проверку конкретного EOL или pinned ref:

```bash
flatpak uninstall --system --unused
flatpak uninstall --user --unused
```

## Проверка и rollback

Общий inventory стандартных installations:

```bash
flatpak remotes --user
flatpak remotes --system

flatpak list --app \
  --columns=application,runtime,installation
flatpak list --runtime --all \
  --columns=application,branch,installation
```

Для конкретного приложения:

```bash
flatpak info <app-id>
flatpak info --show-permissions <app-id>
```

Если одинаковый app ID установлен в нескольких installations, укажи
`--user` или `--system` в `flatpak info` и `flatpak info --show-permissions`.
При оценке итогового доступа учитывай metadata приложения и оба слоя overrides;
portal grants хранятся отдельно. После изменения проверь, что приложение
запускается, нужные portal-запросы и доступ к ресурсам работают, а широкие
permissions не появились без причины.

Чтобы отменить локальные изменения:

- Удали все overrides приложения в нужном слое командой
  `flatpak override --user --reset <app-id>` или
  `flatpak override --system --reset <app-id>`.
- Используй `flatpak permission-reset <app-id>` только для сброса portal
  permission store. Эта команда не сбрасывает Flatpak overrides.
- Для ошибочно удалённого runtime нет универсальной rollback-команды. Runtime
  обычно устанавливается снова, когда приложение, которому он нужен,
  устанавливают или обновляют из настроенного remote.

## Связанные материалы

- [ChatGPT Desktop](../chatgpt-desktop/) — локальная сборка и `extra-data`.
- [Wayland portals](../../desktop/wayland-portals/) — настройка backends.
- [Flatpak на ASUS B5402](../../systems/asus-b5402/applications/) — состояние системы.
- [Using Flatpak](https://docs.flatpak.org/en/latest/using-flatpak.html) и
  [Sandbox permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html).
- [Flatpak Command Reference](https://docs.flatpak.org/en/latest/flatpak-command-reference.html),
  [Flatpak Builder](https://docs.flatpak.org/en/latest/flatpak-builder-command-reference.html),
  [`extra-data`](https://docs.flatpak.org/en/latest/module-sources.html#extra-data)
  и [single-file bundles](https://docs.flatpak.org/en/latest/single-file-bundles.html).
