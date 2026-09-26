---
title: "KeePassXC Quick Unlock: ошибка QMap при polkit-аутентификации"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-27"
verified_on: [asus-b5402]
---

## 1. Symptom

В KeePassXC `2.8.0-snapshot` Linux Quick Unlock завершался ошибкой:

```text
Failed to authenticate with Quick Unlock: Polkit returned an error:
Marshalling failed: Unregistered type QMap<QString,QString> passed in arguments
```

На проверенной системе были установлены
`app-admin/keepassxc-2.8.0_pre20260629-r1` и `sys-apps/keyutils-1.6.3-r1`.
Файл policy `/usr/share/polkit-1/actions/org.keepassxc.KeePassXC.policy`
присутствовал; `pkaction` показывал `implicit active: auth_self` для действия
`org.keepassxc.KeePassXC.unlockDatabase`. Сканер отпечатков и polkit уже
работали в других сценариях. Ошибка возникала до polkit/PAM-аутентификации.

## 2. Cause

Gentoo ebuild этой версии основан на upstream commit
[`ce28e2afb7a59ab5c4b64512b7119eec4a9f2008`](https://github.com/keepassxreboot/keepassxc/commit/ce28e2afb7a59ab5c4b64512b7119eec4a9f2008).
В его Linux Quick Unlock тип `QMap<QString, QString>` не зарегистрирован как
D-Bus metatype. Поэтому вызов polkit `CheckAuthorization` не может передать
аргумент `details`: сбой происходит внутри KeePassXC, раньше проверки отпечатка.

[Upstream PR #13089](https://github.com/keepassxreboot/keepassxc/pull/13089)
содержит отдельное исправление этой ошибки — регистрацию указанного типа.

## 3. Fix

Для **точно этой версии** пакета используй локальный патч Portage. Он
применяется при обычной сборке пакета и не затрагивает PAM и правила polkit.

Каталог: `/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1/`.

Файл: `/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1/01-fix-quick-unlock-qmap-dbus.patch`.

Создай файл в `bash`. Команда `sed` добавляет к пустой строке внутри diff
пробел — маркер неизменённой строки, необходимый для применения патча:

```bash
patch_dir=/etc/portage/patches/app-admin/keepassxc-2.8.0_pre20260629-r1
doas install -d "$patch_dir"
sed 's/^$/ /' <<'EOF' | doas tee "$patch_dir/01-fix-quick-unlock-qmap-dbus.patch" >/dev/null
--- a/src/quickunlock/Polkit.cpp
+++ b/src/quickunlock/Polkit.cpp
@@ -48,6 +48,7 @@ Polkit::Polkit()
 {
     PolkitSubject::registerMetaType();
     PolkitAuthorizationResults::registerMetaType();
+    qDBusRegisterMetaType<QMap<QString, QString>>();

     /* Note we explicitly use our own dbus path here, as the ::systemBus() method could be overridden
        through an environment variable to return an alternative bus path. This bus could have an application
EOF
```

Затем пересобери пакет через Portage:

```bash
doas emerge --ask --oneshot --rebuild =app-admin/keepassxc-2.8.0_pre20260629-r1
```

## 4. Verification

Повтори Quick Unlock в KeePassXC с отпечатком. На ASUS ExpertBook B5402 после
пересборки разблокировка прошла успешно. Запись auditd подтвердила, что
polkit helper аутентифицировал пользователя через `pam_fprintd`:

```text
op=PAM:authentication grantors=pam_fprintd acct="<user>" exe="/usr/lib/polkit-1/polkit-agent-helper-1" res=success
```

Polkit сообщил об успешной одноразовой авторизации действия, инициированной
процессом KeePassXC:

```text
successfully authenticated as unix-user:<user>
to gain ONE-SHOT authorization for action
org.keepassxc.KeePassXC.unlockDatabase
```

Здесь `<user>` заменяет локальное имя учётной записи. Успех Quick Unlock вместе
с этими записями подтверждает весь путь KeePassXC → polkit → PAM → отпечаток.

## 5. Rollback / maintenance

После обновления KeePassXC проверь, вошла ли регистрация
`qDBusRegisterMetaType<QMap<QString, QString>>()` в исходники новой версии.
Если исправление уже включено upstream, удали локальный патч и пересобери
пакет без него. Каталог патча привязан к версии и не применяется к другим
версиям KeePassXC; для новой версии не переноси патч без проверки.

Для отката на текущей версии удали указанный патч и пересобери тот же пакет.
Это вернёт исходное поведение Quick Unlock; fingerprint и polkit останутся
настроенными независимо от него.

## 6. References

- [KeePassXC upstream PR #13089](https://github.com/keepassxreboot/keepassxc/pull/13089)
- [Руководство по сканеру ELAN](../../hardware/elan-fingerprint-04f3-0c77/)
- [Состояние сканера на ASUS B5402](../../systems/asus-b5402/hardware/fingerprint/)
