---
title: OBS Studio на Gentoo
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

В Wayland-сеансе OBS получает изображение экрана через ScreenCast portal и
PipeWire. Для этого OBS обращается к интерфейсу
`org.freedesktop.portal.ScreenCast`, который предоставляет
`xdg-desktop-portal`; тот направляет запрос backend'у текущей сессии.

```text
OBS
→ org.freedesktop.portal.ScreenCast
  (через org.freedesktop.portal.Desktop)
→ xdg-desktop-portal
→ ScreenCast backend текущей сессии
→ PipeWire stream
```

ScreenCast backend должен подходить текущей графической сессии. Его выбор и
маршрутизация описаны в руководстве [XDG Desktop Portals](../../desktop/wayland-portals/).

## Модели установки

Flatpak и native Gentoo OBS — самостоятельные варианты. Выбирай по требованиям
к sandbox, системным библиотекам и обслуживанию; универсального предпочтения
для всех систем нет.

### Flatpak OBS

Установи OBS из Flathub и проверь выданные приложению permissions:

```bash
flatpak install flathub com.obsproject.Studio
flatpak info com.obsproject.Studio
flatpak info --show-permissions com.obsproject.Studio
```

OBS использует portal frontend. Не добавляй Flatpak overrides до появления
конкретной проблемы и её диагностики.

### Native Gentoo OBS

Пакет `media-video/obs-studio` собирается с USE-флагами. Эти флаги относятся к
основным возможностям OBS, а не составляют полный список ebuild:

| USE-флаг | Что включает |
|----------|--------------|
| `wayland` | Поддержку Wayland platform. |
| `screencast` | PipeWire plugin для захвата экрана и зависимость на `media-video/pipewire`. |
| `qsv` | Intel Quick Sync Video; ebuild добавляет `media-libs/libvpl`. |
| `nvenc` | Поддержку аппаратного кодирования NVIDIA. |
| `browser` | Browser source. |
| `fdk` | Поддержку LibFDK AAC. |
| `alsa` | Audio capture через ALSA. |
| `pulseaudio` | Audio capture через PulseAudio-compatible API. |
| `v4l` | Поддержку Video4Linux. |
| `websocket` | WebSocket API. |

Проверь USE-флаги текущего ebuild перед установкой. В текущем Gentoo ebuild
`wayland` управляет Wayland platform support через
`-DENABLE_WAYLAND=$(usex wayland)`, а `screencast` — PipeWire screen/video
capture через `-DENABLE_PIPEWIRE=$(usex screencast)`. У пакета OBS нет
отдельного `pipewire` USE-флага для захвата экрана.

Файл: `/etc/portage/package.use/obs-studio`

```makefile
media-video/obs-studio wayland screencast
```

Затем установи пакет:

```bash
doas emerge --ask media-video/obs-studio
```

QSV и VA-API — разные механизмы. Для QSV ebuild использует `media-libs/libvpl`.
Для VA-API ebuild отдельно указывает дополнительную возможность через
`media-video/ffmpeg[vaapi]`; у `media-video/obs-studio` нет USE-флага `vaapi`.

## Захват экрана в Wayland

В OBS добавь источник `Screen Capture (PipeWire)`. OBS создаёт ScreenCast
portal session, chooser предлагает доступные источники, а после выбора OBS
подключается к полученному PipeWire stream. Набор источников и поведение
chooser зависят от реализации ScreenCast backend.

`Screen Capture (XSHM)` относится к X11 и не является native Wayland path для
захвата экрана.

## Проверка portal и PipeWire

Проверь переменные текущей сессии, portal frontend, запущенные backend-службы
и PipeWire:

```bash
echo "$XDG_SESSION_TYPE"
echo "$XDG_CURRENT_DESKTOP"

systemctl --user status xdg-desktop-portal.service
systemctl --user --type=service --state=running \
  | grep 'xdg-desktop-portal' || true
systemctl --user status pipewire.service
systemctl --user status wireplumber.service
wpctl status
```

Не включай user services по универсальному шаблону: способ активации зависит
от системы. `pipewire-pulse.service` проверяй отдельно, если audio runtime
использует PulseAudio-compatible interface. Для Wayland screen capture он не
требуется.

## Захват звука

Захват экрана и звука — разные возможности:

```text
Захват экрана Wayland → ScreenCast portal / PipeWire video stream
Сборка Gentoo OBS     → USE=screencast включает screen/video plugin
Захват звука          → OBS audio backend / optional PipeWire audio plugin
```

`USE=screencast` включает захват экрана и видео, но не PipeWire-аудиозахват OBS.
Для встроенного захвата звука включи хотя бы один из флагов `alsa` или
`pulseaudio`; если оба выключены, текущий ebuild выводит сообщение после
установки. Для native PipeWire audio capture ebuild предлагает отдельно
установить `media-plugins/obs-pipewire-audio-capture`.
Для других способов захвата звука учитывай доступные в сборке OBS `alsa` и
`pulseaudio`. PipeWire может предоставлять интерфейс, совместимый с PulseAudio,
через `pipewire-pulse`; это отдельный путь аудиозахвата, не условие ScreenCast.

## Аппаратные encoders

Доступность encoder зависит от нескольких уровней:

```text
возможности hardware
→ driver и runtime
→ FFmpeg и необходимые библиотеки
→ сборка или runtime OBS
→ encoder отображается в OBS
```

Универсального рейтинга encoder'ов и общих настроек bitrate/CQ/CRF нет. В OBS
могут быть доступны программное кодирование через x264 и аппаратное кодирование
через QSV, VA-API или NVENC. Поддержка HEVC и AV1 зависит от оборудования,
драйвера, сборки и требований целевой платформы.
Для native OBS полезны две проверки host stack:

```bash
vainfo
ffmpeg -encoders
```

`vainfo` показывает возможности VA-API-драйвера, а `ffmpeg -encoders` — список
encoder'ов системного FFmpeg. Эти проверки не доказывают, что encoder доступен
внутри OBS, особенно в Flatpak с отдельным runtime. Итоговую доступность проверь
в списке encoder'ов OBS и журнале, затем сделай короткую тестовую запись.

## Резервная копия

Скопируй каталог настроек выбранной установки:

```text
Native OBS:  ~/.config/obs-studio/
Flatpak OBS: ~/.var/app/com.obsproject.Studio/config/obs-studio/
```

Перед копированием или восстановлением закрой OBS. Коллекции сцен могут
ссылаться на медиафайлы вне каталога конфигурации — их нужно сохранить отдельно.

Пример копирования выбранного каталога:

```bash
cp -a <obs-config-directory> <backup-directory>/
```

## Проверка результата

1. OBS запускается.
2. Сессия определяется как Wayland.
3. В списке источников есть `Screen Capture (PipeWire)`.
4. Открывается portal chooser.
5. Выбранный источник виден в preview.
6. Короткая test recording создаётся и воспроизводится.
7. В журнале OBS нет ошибок кодировщика, а OBS Stats не показывает неожиданных
   dropped frames.
8. Выбранный encoder присутствует в списке OBS.

## Устранение проблем

Если `Screen Capture (PipeWire)` отсутствует в native Gentoo OBS, сначала
проверь `USE=screencast`: этот флаг включает PipeWire source. `USE=wayland`
отдельно отвечает за native Wayland platform самого OBS. Для Flatpak проверь,
что source есть в установленной сборке.

Если chooser не открывается или источник не появляется, проверяй цепочку по
слоям:

```text
источник OBS
→ xdg-desktop-portal frontend
→ ScreenCast backend текущей session
→ переменные окружения и маршрутизация сессии
→ PipeWire
→ OBS log
```

Настройку конкретного backend ищи в руководстве
[XDG Desktop Portals](../../desktop/wayland-portals/). Не меняй desktop session
и не устанавливай другой backend до установления причины. Открой текущий
журнал OBS через интерфейс приложения; если нужен файл, используй фактический
путь для своей модели установки.

Если encoder отсутствует, отдельно проверь оборудование, драйвер и runtime,
FFmpeg, библиотеки, сборку и runtime OBS. При сбоях записи проверь в OBS Stats
и журнале ошибки кодировщика, dropped frames и нагрузку системы, затем сделай
короткую тестовую запись.

## Связанные материалы

- [Flatpak](../flatpak/) — permissions и overrides.
- [XDG Desktop Portals](../../desktop/wayland-portals/) — настройка portal routing для текущей session.
- [Приложения ASUS B5402](../../systems/asus-b5402/applications/) — фактическое состояние системы.
- [OBS Studio в Gentoo Packages](https://packages.gentoo.org/packages/media-video/obs-studio) — версии и USE-флаги ebuild.
- [Интерфейс XDG Desktop Portal ScreenCast](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html).
- [PipeWire ScreenCast implementation в OBS](https://github.com/obsproject/obs-studio/blob/master/plugins/linux-pipewire/screencast-portal.c).
