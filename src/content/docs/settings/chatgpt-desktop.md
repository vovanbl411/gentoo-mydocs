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

В upstream packaging repository новая версия manifest появляется через
Renovate. Затем updater сверяет RPM с подписанными metadata и обновляет URL,
SHA-256 и размер файла. Локально не подбирай эти значения вручную: если upstream
manifest ещё не обновился, дождись его обновления.

Обновление в текущей схеме проходит через временный user scope и локальный
bundle, после чего обновляется system installation:

```text
new upstream version
→ packaging repo updated
→ git pull
→ temporary user build
→ materialize extra-data
→ new bundle
→ system --or-update
→ verify
→ cleanup user scope
```

### Получить актуальный manifest

Перейди в checkout upstream packaging repository и fast-forward его до актуальной
версии:

```bash
cd ~/m/chatgpt-desktop-flatpak
git pull --ff-only
```

Проверь версию RPM, указанную в manifest:

```bash
grep -n 'chatgpt-.*\.rpm' \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml
```

### Собрать временную user-копию

После предыдущего cleanup user installation может быть пустой. Добавь Flathub
для user scope, если remote ещё не настроен:

```bash
flatpak remote-add --user --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

Из каталога checkout с manifest собери и установи новую версию во временный
user scope:

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

Убедись, что установлена ожидаемая версия:

```bash
flatpak info --user com.openai.ChatGPT
```

Временная установка нужна, чтобы Flatpak материализовал `extra-data` в user
repo. Создавай bundle именно из этого установленного repo, а не из
`flatpak-builder --repo=repo`.

### Создать bundle и обновить system installation

Удали предыдущий локальный bundle, если он остался, затем создай новый:

```bash
rm -f ChatGPT.flatpak

flatpak build-bundle \
  "$HOME/.local/share/flatpak/repo" \
  ChatGPT.flatpak \
  com.openai.ChatGPT \
  master \
  --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo
```

Так как приложение уже установлено в system scope, передай bundle Flatpak с
`--or-update`:

```bash
flatpak install \
  --system \
  --or-update \
  ./ChatGPT.flatpak
```

Это приложение обновляется из локально создаваемого bundle; собственного
application remote для него в этой схеме нет. Поэтому `flatpak update` не
является основным способом обновления ChatGPT Desktop.

### Проверить результат и выполнить cleanup

Проверь версию, branch, permissions и запуск system-копии:

```bash
flatpak info --system com.openai.ChatGPT
flatpak info --system --show-permissions com.openai.ChatGPT
flatpak run --system com.openai.ChatGPT
```

Убедись, что версия ожидаемая, branch — `master`, приложение запускается, а
effective permissions соответствуют текущему manifest. Per-user override
`sockets=!fallback-x11` привязан к app ID и обычно сохраняется при обновлении;
повторно создавать его не нужно. Всё равно проверяй permissions после каждого
обновления: upstream manifest может изменить набор разрешений.

Только после успешной проверки system installation удали временную user-копию
и неиспользуемые refs, затем проверь user apps и remotes:

```bash
flatpak uninstall --user com.openai.ChatGPT
flatpak uninstall --user --unused
flatpak list --user
flatpak remotes --user
```

Если `flathub --user` был добавлен только для этой сборки и больше ничем не
используется, его можно удалить:

```bash
flatpak remote-delete --user flathub
```

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
