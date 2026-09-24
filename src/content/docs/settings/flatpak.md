---
title: "Flatpak: GUI-приложения и permissions"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
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
[applications.md](../systems/asus-b5402/applications.md).

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

## Reset / rollback

Чтобы удалить локальные overrides приложения:

```bash
flatpak override --user --reset <app-id>
```

## Related docs

- [Flatpak на ASUS B5402](../systems/asus-b5402/applications.md) — фактическое состояние машины.
- [Приложения по умолчанию](../desktop/default-applications.md) — MIME-ассоциации GUI-приложений.
