---
title: "Firefox: native Gentoo/Wayland application"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Firefox в Gentoo можно собрать Clang'ом, при необходимости с PGO, и запустить
как Wayland-приложение с аппаратным ускорением. `profile-sync-daemon` остаётся
необязательной оптимизацией профиля:

```text
Firefox from Gentoo
→ Clang
→ optional PGO
→ Wayland
→ hardware acceleration
→ optional profile-sync-daemon
```

Фактическая package policy ASUS B5402 остаётся в
[applications.md](../../systems/asus-b5402/applications/) и
[boot-and-portage.md](../../systems/asus-b5402/system/boot-and-portage/).

## Build policy

USE-флаги определяют возможности собранного пакета; они не описывают
фактический runtime браузера или всей системы.

| USE-флаг | Назначение |
|----------|------------|
| `clang` | Собирает Firefox LLVM/Clang toolchain. |
| `pgo` | Строит оптимизированный бинарный файл по результатам профилирования и заметно увеличивает время сборки. |
| `jumbo-build` | Относится к процессу сборки: объединяет исходные файлы для компиляции. Это не самостоятельное обещание ускорения Firefox при работе. |
| `hwaccel` | Добавляет поддержку аппаратного ускорения; её работа зависит также от драйвера, Mesa, VA-API и runtime. |
| `wayland` | Добавляет Wayland backend. |
| `pulseaudio` | Добавляет Firefox audio backend через libpulse/apulse. PipeWire может обслуживать его через PulseAudio-compatible runtime. |
| `system-pipewire` | Использует системную `media-video/pipewire` для WebRTC и screencast вместо bundled library. |
| `system-*` libraries | Используют системные библиотеки, когда это поддерживает ebuild: например, AV1, HarfBuzz, ICU, JPEG, libevent, libvpx, PNG и WebP. |
| `wasm-sandbox` | Включает RLBox/WebAssembly sandbox для поддерживаемых сторонних библиотек. |
| `wifi`, `jpegxl`, `telemetry` | Не являются универсальной политикой: включай или отключай их по требуемым возможностям и после проверки текущего ebuild. |

`USE=-telemetry` собирает Firefox с отключёнными Mozilla
data-reporting/telemetry build options. Это не следует трактовать как
абсолютную гарантию отсутствия любых сетевых служебных запросов браузера.

## Wayland and acceleration

Для native Wayland Firefox достаточно `USE=wayland`. `USE=-X` имеет смысл
только в сознательно выбранной pure Wayland-системе, где не нужен X11 backend;
это не обязательное условие Wayland Firefox.

`USE=hwaccel` лишь добавляет build support. Проверь отдельно runtime: драйвер
ядра, Mesa, VA-API и настройки Firefox. `USE=pulseaudio` описывает Firefox
audio backend через libpulse/apulse, а runtime PipeWire может предоставить ему
PulseAudio-compatible layer. `USE=system-pipewire` отдельно выбирает системную
`media-video/pipewire` для WebRTC и screencast вместо bundled library.

Ассоциации Firefox для HTTP(S), HTML и PDF настраиваются через
[приложения по умолчанию (XDG MIME)](../../desktop/default-applications/).

## Example package.use

Это пример набора возможностей, а не универсальная рекомендуемая policy.
Сверь флаги с текущим ebuild и выбери только необходимые:

Файл: `/etc/portage/package.use/40-multimedia`

```makefile
media-libs/libpng          apng
media-libs/libvpx          postproc
www-client/firefox         clang pgo jumbo-build hwaccel wayland pulseaudio openh264 system-pipewire wasm-sandbox system-av1 system-harfbuzz system-icu system-jpeg system-libevent system-libvpx system-webp system-png -telemetry -wifi -jpegxl
```

Если X11 backend действительно не нужен, добавь `-X` отдельным осознанным
решением после проверки зависимостей приложений.

## Optional: profile-sync-daemon

`profile-sync-daemon` временно размещает профиль браузера в tmpfs или overlay,
а persistent state синхронизирует обратно. Это уменьшает записи в постоянное
хранилище во время сессии, но требует понимать его расход памяти и поведение
синхронизации при завершении работы или уходе в сон.

Файл: `~/.config/psd/psd.conf`

```bash
# Использовать Overlayfs
USE_OVERLAYFS="yes"
# Синхронизация при уходе в сон
USE_SUSPSYNC="yes"
# Только необходимый браузер
BROWSERS=(firefox)
```

## Verification

```bash
systemctl --user status psd.service
```

Проверь в Firefox выбранный Wayland backend, доступность аппаратного ускорения
и работу аудио/WebRTC в используемом runtime. Для PSD проверь статус
пользовательского unit и ожидаемую точку монтирования его профиля.

## Related docs

- [Firefox на ASUS B5402](../../systems/asus-b5402/applications/) — фактическая package policy и состояние машины.
- [Portage и загрузка на ASUS B5402](../../systems/asus-b5402/system/boot-and-portage/) — системные настройки сборки.
- [Приложения по умолчанию](../../desktop/default-applications/) — MIME-ассоциации.
