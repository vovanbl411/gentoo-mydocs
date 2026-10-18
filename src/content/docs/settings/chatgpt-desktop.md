---
title: ChatGPT Desktop через Flatpak
kind: guide
scope: general
status: current
last_verified: "2026-10-18"
verified_on: [asus-b5402]
---

ChatGPT Desktop установлен на ASUS B5402 в system Flatpak installation из bundle,
собранного по manifest проекта
[kk-daniel/chatgpt-desktop-flatpak](https://github.com/kk-daniel/chatgpt-desktop-flatpak).
Для этой proprietary Electron-программы выбран Flatpak: её runtime dependencies
остаются в Flatpak runtime и не переносятся в native Portage installation.

Проверенная последовательность разделяет непривилегированную сборку и итоговую
установку:

```text
flatpak-builder
→ временная user installation
→ материализация extra-data
→ bundle из user Flatpak repo
→ system installation
→ cleanup временного user scope
```

## Что используется

- Flatpak app ID: `com.openai.ChatGPT`.
- Версия: `26.1013.40934-1`, branch `master`.
- Итоговый scope: system installation.
- Установленные metadata разрешают `fallback-x11`; отдельный per-user override
  отключает его. Эффективные permissions включают Wayland socket без
  `fallback-x11`, а environment задаёт `ELECTRON_OZONE_PLATFORM_HINT=wayland`.

Приложение установлено в system scope. Per-user override применяется к нему,
но не означает, что есть отдельная user installation приложения. На этой
workstation происхождение effective permissions такое:

```text
installed metadata → per-user override → effective permissions
```

Installed metadata содержит `sockets=fallback-x11;pulseaudio;wayland;`.
System override отсутствует: команда ниже ничего не выводит.

```bash
flatpak override --system --show com.openai.ChatGPT
```

Per-user override показывает:

```bash
flatpak override --user --show com.openai.ChatGPT
```

```ini
[Context]
sockets=!fallback-x11
```

Effective permissions ниже получены командой
`flatpak info --system --show-permissions com.openai.ChatGPT`. Они показывают
итоговый sandbox access, а не только установленную metadata. Это подтверждает
Wayland без X11 fallback в effective permissions; сам по себе вывод не
подтверждает display backend каждого запуска.

## Почему Flatpak

Flatpak удерживает runtime dependencies приложения отдельно от native Gentoo
пакетов и задаёт доступ к устройствам, сокетам и пользовательским данным через
sandbox permissions. Эти свойства помогают ограничить влияние приложения на
host, но сами по себе не означают, что Flatpak безопаснее для любого сценария.

## Установка

Сборка и установка проверены на `asus-b5402` 2026-10-18. Команды предполагают,
что `flatpak` и `flatpak-builder` доступны, а пользовательский Flathub remote
настроен для получения build dependencies. Временный user Flatpak repo должен
содержать приложение до создания bundle.

Получи manifest upstream-проекта и перейди в его каталог:

```bash
git clone https://github.com/kk-daniel/chatgpt-desktop-flatpak.git
cd chatgpt-desktop-flatpak
```

Если Flathub ещё не добавлен для user installation, добавь его:

```bash
flatpak remote-add --user --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

### Сборка во временный user scope

Из каталога проекта с manifest выполни:

```bash
flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  --install \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml
```

User installation здесь промежуточная. Manifest использует `extra-data`; эта
установка материализует payload в user Flatpak repo. Не оставляй приложение в
user scope как итоговую установку.

### Создание bundle после materialize extra-data

Создай bundle из установленного user Flatpak repo:

```bash
flatpak build-bundle \
  "$HOME/.local/share/flatpak/repo" \
  ChatGPT.flatpak \
  com.openai.ChatGPT \
  master \
  --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo
```

Именно этот repo содержит материализованный `extra-data`. Repo, указанный
`flatpak-builder` через `--repo=repo`, сам по себе для этого bundle не подходит.

### Установка в system scope

Установи полученный bundle в system installation:

```bash
flatpak install --system ./ChatGPT.flatpak
```

Проверь установленную версию и permissions именно system-копии:

```bash
flatpak info --system com.openai.ChatGPT
flatpak info --system --show-permissions com.openai.ChatGPT
```

### Cleanup временного user scope

После проверки system installation удали временную копию приложения и больше
не нужные ей refs:

```bash
flatpak uninstall --user com.openai.ChatGPT
flatpak uninstall --user --unused
```

Перед удалением user remote проверь, что он больше не используется другими
приложениями или runtimes. Не удаляй `flathub --user` без такой проверки.

## Permissions и Wayland

Фактический вывод `flatpak info --system --show-permissions` на ASUS B5402,
проверенный 2026-10-18:

```text
[Context]
shared=ipc;network;
sockets=pulseaudio;wayland;
devices=dri;
persistent=.codex;

[Session Bus Policy]
org.kde.StatusNotifierWatcher=talk
org.freedesktop.Notifications=talk
com.canonical.AppMenu.Registrar=talk
com.canonical.indicator.application=talk
com.canonical.AppMenu.Registrar.*=talk
com.canonical.indicator.application.*=own

[Environment]
XCURSOR_PATH=/run/host/user-share/icons:/run/host/share/icons
ELECTRON_OZONE_PLATFORM_HINT=wayland
```

Здесь приведены permissions system installation; user-вариант из промежуточной
сборки не используй как их замену. При изменении manifest или overrides
перепроверь вывод команды выше.

## Обновление

Для обновления повтори сборку из актуального manifest во временном user scope,
создай новый bundle из `$HOME/.local/share/flatpak/repo` после материализации
`extra-data` и установи его в system scope. После проверки обновлённой system
версии снова удали временную user-копию и неиспользуемые refs.

## Troubleshooting

### `ConfigureRemote not allowed for user`

На этой workstation попытка `flatpak-builder --system --install ...` завершилась
ошибкой `Flatpak system operation ConfigureRemote not allowed for user`. Это
наблюдавшееся поведение данной машины, а не утверждение о поломке polkit или о
всех системах. Проверенный путь разделяет сборку и system installation:
собери с `--user`, затем установи готовый bundle через `flatpak install --system`.

### `Extra data missing in detached metadata`

Bundle, созданный напрямую из `flatpak-builder` output repo, не установился с
ошибкой `Extra data missing in detached metadata`. Сначала установи сборку во
временный user scope, чтобы Flatpak материализовал `extra-data`, затем создавай
bundle из `$HOME/.local/share/flatpak/repo`.

## Verification

Проверь, что приложение установлено в system scope, версия и branch ожидаемые,
permissions совпадают с актуальным выводом system installation, а временная
user-копия удалена:

```bash
flatpak list --system --app
flatpak info --system com.openai.ChatGPT
flatpak info --system --show-permissions com.openai.ChatGPT
flatpak list --user --app
```

## Related docs

- [Flatpak: GUI-приложения и permissions](../flatpak/) — общие принципы Flatpak.
- [Приложения ASUS ExpertBook B5402](../../systems/asus-b5402/applications/) — состояние системы.
