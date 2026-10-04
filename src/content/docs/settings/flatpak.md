---
title: "Flatpak: GUI-приложения и permissions"
kind: guide
scope: general
status: current
last_verified: "2026-10-04"
verified_on: [asus-b5402]
---

Flatpak устанавливает приложения из Flathub в изолированном runtime. Доступ к
файлам и desktop-сервисам предоставляют sandbox permissions и portals; Flatseal
может быть необязательным GUI для их просмотра и изменения.

```text
Flatpak
→ Flathub
→ sandboxed application
→ portals
→ permissions
→ optional Flatseal GUI
```

Локальная политика ASUS B5402 записана в
[applications.md](../../systems/asus-b5402/applications/).

## Flathub

Установи `sys-apps/flatpak` способом, подходящим текущему ebuild и профилю
Gentoo. Не привязывай общую инструкцию к одному обязательному USE-флагу: они
зависят от версии ebuild и профиля. Затем добавь Flathub и проверь remote:

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

## Permissions model

Главный принцип — давать приложению только необходимые permissions. Portals
позволяют выбрать отдельный файл или каталог в диалоге приложения без
постоянного доступа ко всему `$HOME`.

| Категория | Когда нужна |
|-----------|-------------|
| Filesystem | Доступ к `$HOME` широк; предпочтительнее конкретная директория или portal. |
| Wayland / X11 sockets | Native Wayland-only приложение может использовать только Wayland. Приложению с X11 fallback могут понадобиться `wayland` и `fallback-x11`, а X11-only приложению — X11. |
| Devices | Разрешай только реальные нужные устройства, например GPU или контроллер, если этого требует приложение. |
| Environment | Не форсируй Wayland-переменные через override без конкретной причины и проверки результата. |

## Optional: Flatseal

Flatseal — GUI для просмотра и изменения overrides Flatpak-приложений. Он не
обязателен для работы Flatpak и не заменяет понимание того, какой доступ нужен
приложению.

## CLI overrides

CLI позволяет проверить и сбросить overrides без Flatseal:

```bash
flatpak info --show-permissions <app-id>
flatpak override --user ...
flatpak override --user --reset <app-id>
```

`--user` создаёт user override. Без него `flatpak override` по умолчанию
относится к default system-wide installation. Добавляй конкретный
`flatpak override --user` только для подтверждённой потребности конкретного
`<app-id>`.

## Example: Steam

Steam — отдельный пример, а не baseline для всех Flatpak-приложений:

```bash
flatpak install flathub com.valvesoftware.Steam
```

Steam Flatpak приносит необходимые userspace runtime libraries внутри Flatpak
runtime и тем самым уменьшает объём native multilib dependencies на host. Это
не определяет Gentoo profile или ABI всей системы.

Для Steam проверяй только реальные sandbox categories: доступ к GPU, игровым
контроллерам и требуемым каталогам. MangoHud можно подключить как optional
integration для мониторинга FPS; Flatseal не управляет компиляцией шейдеров.

## Verification

```bash
flatpak remotes
flatpak info --show-permissions <app-id>
```

Проверь, что приложение запускается, использует нужный display backend и
имеет только необходимые filesystem, device и socket permissions.

## Обслуживание EOL runtimes и pins

`flatpak update` может сообщить, что branch runtime или extension достигла
end-of-life (EOL). Пометка `(pinned)` означает защиту от автоматического
удаления; она сама по себе не доказывает, что runtime ещё нужен приложению.
`flatpak uninstall --unused` недостаточно для такого случая: pin может
препятствовать cleanup.

Перед удалением проверь pins, runtime branches приложений и установленные
runtimes:

```bash
flatpak pin
flatpak list --app \
    --columns=application,runtime
flatpak list --runtime --all \
    --columns=application,branch,installation
```

Для extension учитывай также manifest/runtime зависимости приложения:
список основных runtimes не перечисляет все нужные extensions. Не устанавливай
branch N+1 автоматически только потому, что прежняя EOL: нужную branch
определяют зависимости приложения.

Если подтверждено, что EOL runtime больше не используется, сними именно его
pin, затем удали именно эту branch из нужной installation. Пример для default
system installation; замени `<runtime-id>` и `<branch>` целиком, без угловых
скобок, а `x86_64` — на нужную архитектуру:

```bash
flatpak pin --remove \
  runtime/<runtime-id>/x86_64/<branch>

flatpak uninstall --system \
  <runtime-id>//<branch>
```

Для user installation используй `--user` при просмотре/изменении pins и
вместо `--system` при удалении; scope должен совпадать с диагностикой.
Если Flatpak предлагает удалить зависящие приложения, остановись и повторно
проверь зависимости.

### Проверенный пример: ffmpeg-full 24.08

Это пример maintenance на ASUS B5402, а не универсальные команды для копирования.
До cleanup предупреждение было таким:

```text
Info: (pinned) runtime org.freedesktop.Platform.ffmpeg-full branch 24.08 is end-of-life
```

Pin: `runtime/org.freedesktop.Platform.ffmpeg-full/x86_64/24.08`.
Приложения использовали Freedesktop 25.08/26.08 и GNOME 50;
приложений на Freedesktop 24.08 не было. После подтверждения, что старый
extension больше не используется, выполнены:

```bash
flatpak pin --remove \
  runtime/org.freedesktop.Platform.ffmpeg-full/x86_64/24.08

flatpak uninstall --system \
  org.freedesktop.Platform.ffmpeg-full//24.08
```

После cleanup повторно проверь runtime inventory и запусти:

```bash
flatpak update
```

Краткий результат проверенного примера:

```text
12 applications
ffmpeg-full 24.08 absent
flatpak update → Nothing to update
```

2026-10-04 на `asus-b5402` проверен только runtime maintenance path;
permissions и остальные части guide в эту дату заново не проверялись
(предыдущая проверка — 2026-09-22). Текущее состояние записано в
[системном документе](../../systems/asus-b5402/applications/).

## Reset / rollback

Чтобы удалить локальные overrides приложения:

```bash
flatpak override --user --reset <app-id>
```

## Related docs

- [Flatpak на ASUS B5402](../../systems/asus-b5402/applications/) — фактическое состояние машины.
- [Приложения по умолчанию](../../desktop/default-applications/) — MIME-ассоциации GUI-приложений.
