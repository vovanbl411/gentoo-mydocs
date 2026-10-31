---
title: ChatGPT Desktop через Flatpak
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: []
---

Сторонняя упаковка в формате Flatpak позволяет запускать нативное Linux-
приложение ChatGPT Desktop в sandbox на Gentoo. OpenAI выпускает приложение,
а manifest и Flatpak-интеграцию поддерживает проект
[`kk-daniel/chatgpt-desktop-flatpak`](https://github.com/kk-daniel/chatgpt-desktop-flatpak).
Этот проект не является официальным Flatpak-пакетом OpenAI.

| Часть | Кто её поддерживает |
|-------|---------------------|
| ChatGPT Desktop | OpenAI |
| Flatpak manifest и интеграция | `kk-daniel/chatgpt-desktop-flatpak` |

В актуальной схеме manifest использует официальный Linux RPM OpenAI как
источник `extra-data`. В manifest закреплены URL, SHA-256 и размер RPM; при
установке Flatpak скачивает и проверяет файл, затем `apply_extra` извлекает
payload. Upstream обновляет эти значения по подписанным метаданным RPM-
репозитория OpenAI. Зависимости приложения идут из Flatpak runtime и
extensions, поэтому их не нужно устанавливать через Gentoo Portage.

## Установка

Основной путь из upstream README собирает приложение из packaging-репозитория
и устанавливает его в user scope. Для сборки нужны `flatpak`,
`flatpak-builder` и пользовательский Flathub remote, откуда берутся build
dependencies.

Если для пользователя ещё не добавлен Flathub remote:

```bash
flatpak remote-add --if-not-exists --user flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo
```

Склонируй packaging-репозиторий и собери приложение:

```bash
git clone https://github.com/kk-daniel/chatgpt-desktop-flatpak.git
cd chatgpt-desktop-flatpak

flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  --install \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml

flatpak run com.openai.ChatGPT
```

Сборка создаёт локальный repository `repo` и устанавливает приложение в user
scope. Во время установки Flatpak скачивает extra-data RPM непосредственно у
OpenAI.

## Необязательно: system installation из bundle

Upstream README описывает установку в user scope. Если приложение нужно для
всех пользователей, создай bundle из repository, который собрал
`flatpak-builder`, и установи его в system scope. Это отдельный вариант, а не
основной путь upstream.

```bash
flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml

flatpak build-bundle \
  repo \
  ChatGPT.flatpak \
  com.openai.ChatGPT \
  --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo

flatpak install --system ./ChatGPT.flatpak
flatpak info --system com.openai.ChatGPT
```

`repo` — выходной repository `flatpak-builder`, а не каталог установленной
Flatpak-копии. Для текущего manifest отдельная временная user installation не
нужна: Flatpak записывает metadata `extra-data` в ref, а RPM скачивается при
установке bundle. Команда не настраивает remote для обновления самого
приложения; для system installation см. раздел «Обновление».

Подробности о [sources типа `extra-data`](https://docs.flatpak.org/en/latest/module-sources.html#extra-data)
и [single-file bundles](https://docs.flatpak.org/en/latest/single-file-bundles.html)
есть в документации Flatpak.

## Проверка permissions

Manifest задаёт базовые разрешения через `finish-args`; локальные overrides
могут их изменить. Смотри effective permissions установленного приложения и
список overrides отдельно:

```bash
# Для user installation
flatpak info --user --show-permissions com.openai.ChatGPT
flatpak override --user --show com.openai.ChatGPT

# Для system installation
flatpak info --system --show-permissions com.openai.ChatGPT
flatpak override --system --show com.openai.ChatGPT
```

Текущий manifest разрешает сеть и IPC, Wayland с X11 fallback, PulseAudio,
доступ к GPU через `dri`, отдельные D-Bus names и private `.codex`. Проверяй
актуальный manifest и вывод своей installation после обновления: набор
разрешений может измениться.

### Необязательно: отключить X11 fallback

Если нужен Wayland без X11 fallback, добавь per-user override:

```bash
flatpak override --user \
  --nosocket=fallback-x11 \
  com.openai.ChatGPT

flatpak override --user --show com.openai.ChatGPT
flatpak info --show-permissions com.openai.ChatGPT
```

Чтобы убрать все per-user overrides этого приложения и вернуть настройки
manifest, выполни:

```bash
flatpak override --user --reset com.openai.ChatGPT
```

`--reset` удаляет все per-user overrides приложения, включая другие настройки,
если они есть. Наличие Wayland socket и отсутствие `fallback-x11` в effective
permissions не доказывает, какой display backend использовал конкретный запуск.

### Необязательно: доступ к login keyring

Upstream намеренно не выдаёт приложению доступ к
`org.freedesktop.secrets`: Secret Service не гарантирует изоляцию секретов по
приложениям. Без этого разрешения Chromium использует локальное хранилище
внутри private Flatpak data. Выдавай доступ только если принимаешь этот риск:

```bash
flatpak override --user \
  --talk-name=org.freedesktop.secrets \
  com.openai.ChatGPT
```

Если приложение не распознало backend автоматически, upstream также описывает
явный выбор password store. Например, для `gnome-libsecret`:

```bash
flatpak override --user \
  --env=ELECTRON_EXTRA_LAUNCH_ARGS=--password-store=gnome-libsecret \
  com.openai.ChatGPT
```

Для KDE upstream указывает `kwallet6`; выбери backend, установленный в твоём
рабочем окружении. Чтобы отозвать доступ и удалить эту переменную:

```bash
flatpak override --user \
  --no-talk-name=org.freedesktop.secrets \
  --unset-env=ELECTRON_EXTRA_LAUNCH_ARGS \
  com.openai.ChatGPT
```

После смены password store может потребоваться войти в приложение снова.

## Необязательно: Codex sandbox host broker

Обычная работа интерфейса ChatGPT не требует host broker. Codex использует
nested bubblewrap sandbox, которому Flatpak не разрешает создавать нужные
namespace. Packaging-проект предлагает отдельный host-side broker для этой
функции.

Перед установкой прочитай upstream
[`SANDBOXING.md`](https://github.com/kk-daniel/chatgpt-desktop-flatpak/blob/main/SANDBOXING.md)
и [`host/README.md`](https://github.com/kk-daniel/chatgpt-desktop-flatpak/blob/main/host/README.md).
Broker требует Linux 6.5 или новее, архитектуру `x86_64` и systemd user session;
upstream не поддерживает broker для `aarch64`. Broker расширяет syscall surface
и добавляет отдельный host-side service, который принимает запросы Codex,
входит в namespaces приложения и запускает bubblewrap. Это не обычное Flatpak
permission. Установочный скрипт без root размещает файлы в `$HOME` и включает
systemd user socket:

```bash
"$(flatpak info com.openai.ChatGPT -l)/files/extra/chatgpt/sandbox-host/install.sh"
```

Проверка:

```bash
systemctl --user status flatpak-bwrap-broker@com.openai.ChatGPT.socket
```

После каждого обновления Flatpak upstream требует повторно запустить
установочный скрипт: копия broker на host обновляется отдельно от приложения.

### Удаление broker

Broker установлен на host отдельно от Flatpak и останется после
`flatpak uninstall`. В конце `install.sh` upstream печатает команды удаления.
Для стандартных XDG-путей они выглядят так:

```bash
systemctl --user disable --now \
  flatpak-bwrap-broker@com.openai.ChatGPT.socket

rm -rf \
  "$HOME/.local/libexec/flatpak-bwrap-broker" \
  "$HOME/.config/systemd/user/flatpak-bwrap-broker@.socket" \
  "$HOME/.config/systemd/user/flatpak-bwrap-broker@.service"

systemctl --user daemon-reload
```

Если при установке использовался нестандартный `XDG_CONFIG_HOME`, удали unit
files из пути, который вывел `install.sh`.

## Обновление

Upstream обновляет manifest по подписанным метаданным RPM-репозитория OpenAI и
закрепляет URL, SHA-256 и размер нового RPM. Не меняй эти значения вручную.
Обнови packaging-репозиторий и повтори сборку:

```bash
cd chatgpt-desktop-flatpak
git pull --ff-only

flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  --install \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml
```

Для system bundle собери ref в `repo` без `--install`, создай новый bundle и
обнови установленный ref:

```bash
flatpak-builder \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo=repo \
  builddir \
  com.openai.ChatGPT/com.openai.ChatGPT.yaml

flatpak build-bundle \
  repo \
  ChatGPT.flatpak \
  com.openai.ChatGPT \
  --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo

flatpak install --system --or-update ./ChatGPT.flatpak
```

Локальная сборка не настраивает application remote. Если у приложения нет
remote, `flatpak update` не получает новый ChatGPT ref из packaging-репозитория.
Команда по-прежнему может обновить runtimes и extensions из настроенных remotes.
После обновления проверь версию и permissions.

## Troubleshooting

### Ошибка при загрузке `extra-data`

Flatpak скачивает RPM непосредственно из OpenAI RPM repository, а не из
Flathub. Проверь сетевой доступ и URL в актуальном upstream manifest. Если
проверочные данные изменились, обнови checkout и дождись обновления manifest;
не исправляй URL, SHA-256 или размер вручную.

## Удаление

Удаляй приложение из той installation, куда оно было установлено:

Если Codex broker был установлен, удали его отдельно по инструкции выше —
удаление Flatpak не удаляет host component.

```bash
# User installation
flatpak uninstall --user com.openai.ChatGPT

# System installation
flatpak uninstall --system com.openai.ChatGPT
```

Не запускай `flatpak uninstall --unused` не проверив зависимости: команда может
удалить runtimes, которыми больше не пользуются другие приложения. Не удаляй
Flathub remote автоматически; сначала проверь `flatpak remotes --user` и
`flatpak list --user`.

## Проверка после установки или обновления

Для upstream user installation:

```bash
flatpak info --user com.openai.ChatGPT
flatpak info --user --show-permissions com.openai.ChatGPT
flatpak override --user --show com.openai.ChatGPT
```

Для system installation добавь `--system` к командам `flatpak info`; user- и
system-overrides проверяй отдельно. Затем убедись, что:

- приложение запускается и вход в аккаунт работает;
- выбранный display backend и file chooser/portal работают;
- notifications работают, если они тебе нужны;
- Codex работает, если используется эта функция;
- после обновления набор permissions не изменился неожиданно.

`--persist=.codex` хранит отдельное состояние Codex в private Flatpak data по
пути `$HOME/.var/app/com.openai.ChatGPT/.codex`. Оно не совпадает с состоянием
Codex CLI, установленного на host.

## Связанные материалы

- [Общие принципы Flatpak](../flatpak/).
- [Приложения ASUS ExpertBook B5402](../../systems/asus-b5402/applications/) — состояние конкретной системы.
- [Upstream README](https://github.com/kk-daniel/chatgpt-desktop-flatpak) — установка и обновление Flatpak-пакета.
- [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).
