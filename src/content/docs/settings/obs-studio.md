---
title: OBS Studio на Gentoo и Niri
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

Цель — получить рабочий OBS Studio, захватывать экран Wayland через portals и
PipeWire и проверить, какие encoders действительно доступны. Есть две
независимые модели установки:

```text
Option A: Flatpak OBS
OBS runtime + bundled dependencies
→ Wayland
→ XDG Desktop Portal
→ PipeWire capture

Option B: native Gentoo OBS
Portage package + system FFmpeg/libraries
→ USE policy
→ Wayland / screencast support
```

На ASUS B5402 используется OBS Flatpak. Это состояние конкретной машины, а не
универсальная рекомендация; подробности записаны в
[системном разделе](../systems/asus-b5402/applications.md).

## Installation models

### Option A: Flatpak OBS

Установи OBS из Flathub и сначала посмотри permissions, уже выданные пакету:

```bash
flatpak install flathub com.obsproject.Studio
flatpak info com.obsproject.Studio
flatpak info --show-permissions com.obsproject.Studio
```

OBS работает с portal frontend. Не добавляй Flatpak overrides для внутренних
D-Bus-интерфейсов backend'а без конкретного диагностированного симптома.

### Option B: native Gentoo OBS

У `media-video/obs-studio-32.2.2` доступны следующие возможности:

| USE-флаг | Что добавляет |
|----------|---------------|
| `wayland` | Wayland support. |
| `screencast` | Screen/video capture через PipeWire. |
| `qsv` | Intel Quick Sync Video. |
| `nvenc` | NVIDIA hardware encoding. |
| `browser` | Browser source. |
| `fdk` | LibFDK AAC support. |
| `pulseaudio` | PulseAudio audio support. |
| `v4l` | Video4Linux support. |
| `websocket` | WebSocket API. |

У текущего ebuild нет USE-флага `pipewire`. Минимальный пример для захвата
Wayland:

Файл: `/etc/portage/package.use/obs-studio`

```makefile
media-video/obs-studio wayland screencast
```

`qsv`, `nvenc`, `browser`, `fdk`, `pulseaudio`, `v4l`, `websocket` и другие
возможности добавляй по потребности после проверки текущего ebuild.

QSV и VA-API — разные механизмы. Для аппаратного кодирования через VA-API
ebuild отдельно указывает optional dependency:

```text
media-video/ffmpeg[vaapi]
```

## Wayland capture on Niri

Для Niri рабочая цепочка захвата выглядит так:

```text
OBS
→ xdg-desktop-portal
→ GNOME ScreenCast backend
→ Niri ScreenCast API
→ PipeWire stream
```

- `xdg-desktop-portal` — frontend, к которому обращается OBS;
- GNOME backend обслуживает ScreenCast и Screenshot через совместимый API
  Niri;
- GTK backend обслуживает общие диалоги и настройки;
- WLR backend для этой конфигурации Niri не нужен.

Маршрутизация backend'ов описана в
[XDG Desktop Portals](../desktop/wayland-portals.md).

В OBS добавь источник:

```text
Screen Capture (PipeWire)
```

Portal chooser должен предложить monitor, window или другой доступный source.
Старый XScreenCapture не является решением для native Wayland capture.

## PipeWire services

Не включай user services по универсальному шаблону: способ активации зависит
от конфигурации системы. Для read-only проверки используй:

```bash
systemctl --user status pipewire.service
systemctl --user status wireplumber.service
wpctl status
```

`pipewire-pulse.service` проверяй отдельно, только если фактический audio
runtime использует PulseAudio-compatible interface. Захват экрана через
PipeWire и совместимость аудио с PulseAudio — разные функции.

## Encoders

| Encoder family | Что это |
|----------------|---------|
| x264 | Software H.264. |
| QSV | Intel hardware encoding. |
| VA-API | Linux hardware video API. |
| NVENC | NVIDIA hardware encoding. |
| HEVC / AV1 | Доступность зависит от GPU, driver, build и target platform. |

### Как выбирать

1. Посмотри, какие encoders показывает установленный OBS.
2. Учти требования streaming platform или player.
3. Сделай короткую test recording.
4. Проверь quality, dropped frames и нагрузку GPU/CPU в OBS Stats и log.

Универсального ranking или набора bitrate/CQ/CRF для всех GPU и сценариев нет.

### Encoder verification

Для native Portage OBS полезны проверки host stack:

```bash
vainfo
ffmpeg -encoders
```

`vainfo` показывает capabilities VA-API driver, а `ffmpeg -encoders` —
capabilities системного FFmpeg. Ни одна команда сама по себе не доказывает,
что encoder доступен в OBS Flatpak.

Для Flatpak основная проверка — список encoders внутри OBS, OBS log и короткая
test recording.

## Audio

OBS audio capture зависит от выбранной installation model и runtime. PipeWire
может предоставлять PulseAudio-compatible interface. Native Gentoo ebuild имеет
отдельные audio USE capabilities, а Flatpak приносит собственную runtime
integration. Выбирай доступный encoder по требованиям output platform и
проверяй его тестовой записью; `libfdk_aac` не следует выбирать без учёта
доступного runtime и требований к output.

## Backup and restore

Сначала определи тип установки, затем копируй соответствующий каталог
конфигурации:

```text
Native OBS:  ~/.config/obs-studio/
Flatpak OBS: ~/.var/app/com.obsproject.Studio/config/obs-studio/
```

Пример резервной копии одного выбранного каталога:

```bash
cp -a <obs-config-directory> <backup-directory>/
```

Перед восстановлением закрой OBS и сохрани текущий каталог отдельно. Резервная
копия всего `/etc/portage/` не относится к этому руководству.

## Verification

### Flatpak

```bash
flatpak info com.obsproject.Studio
flatpak info --show-permissions com.obsproject.Studio
```

### Session

```bash
echo "$XDG_SESSION_TYPE"
echo "$XDG_CURRENT_DESKTOP"

systemctl --user status xdg-desktop-portal.service
systemctl --user status xdg-desktop-portal-gnome.service
systemctl --user status pipewire.service
systemctl --user status wireplumber.service
```

### Functional gate

1. OBS запускается.
2. `Screen Capture (PipeWire)` доступен.
3. Portal chooser открывается.
4. Выбранный screen или window появляется в preview.
5. Test recording создаётся и воспроизводится.
6. Encoder list соответствует фактическому hardware и runtime.

Это команды и проверки для пользователя; они не выполнялись автоматически при
редактировании документа.

## Troubleshooting

### Нет `Screen Capture (PipeWire)`

Проверь Wayland session, portal frontend, GNOME backend для Niri, PipeWire и
OBS log. Для native OBS дополнительно проверь `USE=screencast`.

### Portal chooser не появляется

Проверь routing и user services по инструкции
[XDG Desktop Portals](../desktop/wayland-portals.md). Не добавляй случайные
Flatpak D-Bus overrides до установления причины.

### Hardware encoder отсутствует

Проверяй уровни отдельно:

```text
hardware capability
→ driver/runtime
→ native package build flags или Flatpak runtime
→ OBS encoder support
```

`vainfo` — часть диагностики VA-API, но не единственное доказательство
доступности encoder в OBS.

### Recording fails or overloads

Открой OBS Stats и log, проверь dropped frames, encoder errors и загрузку
системы. Не переключайся на другой encoder только на основании универсальной
рекомендации: сначала сравни результат короткой тестовой записи.

## Related docs

- [Flatpak](flatpak.md) — модель permissions и overrides.
- [Niri](../desktop/niri.md) — запуск Wayland session.
- [XDG Desktop Portals](../desktop/wayland-portals.md) — portal routing для Niri.
- [Приложения ASUS B5402](../systems/asus-b5402/applications.md) — проверенное состояние машины.
- [OBS Studio в Gentoo Packages](https://packages.gentoo.org/packages/media-video/obs-studio) — актуальные версии и USE-флаги.
