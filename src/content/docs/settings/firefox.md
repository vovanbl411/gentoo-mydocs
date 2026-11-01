---
title: "Firefox: native Gentoo/Wayland application"
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

USE-флаги задают возможности, включённые в сборку Firefox. Wayland, графику и
аудио проверяй отдельно в работающем браузере. `profile-sync-daemon` можно
подключить, если нужна рабочая копия профиля в памяти:

```text
текущий ebuild
→ выбранные USE-возможности
→ сборка
→ проверка runtime
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
| `clang` | Собирает Firefox с LLVM/Clang. |
| `pgo` | Включает Profile-Guided Optimization во время сборки, увеличивает её длительность и требует `jumbo-build`. |
| `jumbo-build` | Меняет ход сборки, объединяя исходные файлы для компиляции; сам по себе не обещает ускорения Firefox при работе. |
| `hwaccel` | Добавляет настройки Gentoo, которые принудительно включают аппаратный рендеринг. Фактическое состояние зависит от Firefox, Mesa и графического стека. |
| `wayland` | Добавляет native Wayland backend; текущий ebuild также требует `dbus`. |
| `pulseaudio` | Выбирает обычный аудиобэкенд Firefox через `libpulse` или `apulse`. PipeWire может предоставить `libpulse` совместимый интерфейс. |
| `system-pipewire` | Использует системную `media-video/pipewire` для WebRTC и screencast. Этот флаг не выбирает обычный вывод звука Firefox. |
| `system-*` | Набор и defaults зависят от текущего ebuild; смотри его перед выбором системных библиотек. |
| `wasm-sandbox` | Включает RLBox/WebAssembly sandbox для поддерживаемых сторонних библиотек. |
| `-telemetry` | Отключает Mozilla build/data-reporting options и устанавливает Gentoo prefs для telemetry. Это не гарантирует отсутствие любых сетевых запросов. |

Перед изменением USE проверь доступные флаги и план Portage для текущего дерева:

```bash
emerge --pretend --verbose www-client/firefox
```

В проверенном ebuild действуют условия `|| ( X wayland )`,
`pgo? ( jumbo-build )`, `wayland? ( dbus )` и `wifi? ( dbus )`. Они могут
меняться вместе с ebuild.

## Wayland and acceleration

`USE=wayland` добавляет native Wayland backend. Текущий ebuild требует хотя бы
один backend: `X` или `wayland`. `USE=-X` отключает X11 backend и подходит для
сборки Firefox без X11; используй его только при включённом `wayland`. Для
native Wayland этот флаг не обязателен.

При `USE=hwaccel` ebuild Gentoo устанавливает preferences, которые
принудительно включают аппаратный рендеринг. Это настройка сборки, а не
гарантия, что Firefox действительно использует GPU. Проверь результат в
Firefox: **Справка → Информация для решения проблем** (`about:support`).
Посмотри `Window Protocol`,
`Compositing`, состояние graphics/WebRender и, если нужно, audio/media.

Ассоциации Firefox для HTTP(S), HTML и PDF настраиваются через
[приложения по умолчанию (XDG MIME)](../../desktop/default-applications/).

## Optional: profile-sync-daemon

`profile-sync-daemon` — необязательный механизм для рабочей копии профиля:
постоянный профиль Firefox ↔ PSD ↔ tmpfs или overlayfs. Во время сессии рабочая
копия находится в памяти и может уменьшить число записей в постоянный профиль;
практическая польза зависит от нагрузки. SSD сам по себе не делает PSD
необходимым.

Перед первым запуском сделай резервную копию профиля. В текущем конфиге PSD
добавь Firefox в список браузеров. Overlayfs — отдельный режим, а
`USE_SUSPSYNC` задаёт синхронизацию при suspend. Проверь синтаксис и остальные
параметры в [документации upstream](https://github.com/graysky2/profile-sync-daemon).

## Verification

```bash
systemctl --user status psd.service --no-pager
```

Проверяй Firefox через **Справка → Информация для решения проблем**
(`about:support`): `Window Protocol`, `Compositing`, graphics/WebRender и при
необходимости audio/media. Команда `systemctl` нужна только если ты используешь
PSD; проверка build flags сама по себе не показывает runtime-состояние.

## Related docs

- [Firefox на ASUS B5402](../../systems/asus-b5402/applications/) — фактическая package policy и состояние машины.
- [Portage и загрузка на ASUS B5402](../../systems/asus-b5402/system/boot-and-portage/) — системные настройки сборки.
- [Приложения по умолчанию](../../desktop/default-applications/) — MIME-ассоциации.
