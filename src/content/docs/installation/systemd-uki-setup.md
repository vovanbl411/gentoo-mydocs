---
title: "Ядро и загрузка: Unified Kernel Image (UKI)"
kind: guide
scope: general
status: current
last_verified: "2026-09-13"
verified_on: [asus-b5402]
---

## Goal / Result

Руководство собирает UKI — единый подписанный EFI-образ, в который входят
ядро, микрокод, initramfs и командная строка ядра, — и подключает его к
systemd-boot.

Boot path после настройки:

```text
systemd-boot
→ signed UKI
→ kernel + microcode + initramfs + cmdline
→ LUKS/Btrfs root
```

Роли в основной цепочке:

- **Dracut = UKI generator** — собирает initramfs и упаковывает его вместе
  с ядром и cmdline в файл UKI, подписывает его;
- **systemd-boot = loader** — находит UKI (Type #2) в `EFI/Linux` на ESP и
  загружает его;
- **sbctl = signing/verification** — ключи Secure Boot и проверка подписи
  (создание ключей и enrollment — в [Secure Boot и TPM 2.0](../secure-boot-tpm/)).

`ukify` — альтернативный генератор UKI, а не этап основной цепочки; он
рассмотрен в разделе «Альтернативный путь: ukify».

## Applicability

- Gentoo с `sys-kernel/gentoo-kernel` (savedconfig) и systemd;
- initramfs и UKI собирает Dracut;
- пример cmdline рассчитан на корень в LUKS2 с Btrfs внутри;
- подпись — ключами sbctl.

Фактическое состояние эталонной ASUS B5402 записано в
[системном разделе](../../systems/asus-b5402/system/boot-and-portage/).

## Prerequisites / Recovery prerequisites

Изменение загрузочной цепочки может оставить систему без загрузки. До
начала убедитесь, что есть:

- рабочий способ разблокировки LUKS (пароль);
- recovery/live носитель;
- сохранённый рабочий UKI (fallback-образ) в ESP, к которому можно
  вернуться из меню systemd-boot;
- понимание ESP: какой это раздел и где в нём лежат systemd-boot и UKI
  (`EFI/Linux`).

## Основная процедура: Dracut генерирует UKI

```text
Recommended/example path in this guide: Dracut generates UKI
Alternative: ukify generates UKI — отдельный раздел ниже
```

Основная цепочка настраивается линейно: ядро → Dracut → cmdline →
installkernel → systemd-boot. Конфиги альтернативного пути
(`/etc/kernel/uki.conf`) в основную процедуру не входят.

### 1. Сборка ядра (gentoo-kernel)

В примере используется `sys-kernel/gentoo-kernel` с поддержкой `savedconfig`.

- Флаги: Убедитесь, что для ядра включены dist-kernel и savedconfig.
- Путь к конфигу: `/etc/portage/savedconfig/sys-kernel/gentoo-kernel-<version>`.

При обновлении ядра Portage автоматически подхватит ваш оптимизированный конфиг и инициирует сборку.

### 2. Конфигурация Dracut (initramfs и UKI)

Dracut собирает initramfs и может упаковать его вместе с ядром в файл UKI.
Конфигурация разделена на модули для удобства поддержки. Ниже описан путь с
Dracut как генератором UKI; альтернативный путь с `ukify` приведён отдельно.

> **Примечание**: необязательный USE-флаг `dracut-cpio` включает
> многопоточный генератор архива вместо конвейера `find | cpio` — initramfs
> собирается заметно быстрее. На содержимое образа не влияет.

#### Глобальные настройки (`/etc/dracut.conf.d/00-global.conf`)

Минимизируем размер образа и включаем микрокод Intel.

```conf
hostonly="yes"
hostonly_mode="strict"
compress="zstd"
early_microcode="yes"
```

#### Драйверы и модули (`10-drivers.conf`, `20-modules.conf`)

Пример включает `i915`, NVMe и компоненты для работы с шифрованием. Для `xe`
нужна отдельная проверка совместимости.

```conf
# Целевой драйвер Xe (отключён до перехода)
#force_drivers+=" xe "

# Текущий драйвер i915
add_drivers+=" i915 "

add_drivers+=" nvme "

# systemd в initramfs необходим для интеграции с TPM2
add_dracutmodules+=" systemd tpm2-tss crypt btrfs "
omit_dracutmodules+=" network nfs "
```

> **Совет**: пока `xe` не стабилен на вашем железе, оставьте `force_drivers` закомментированным и явно добавьте `i915` через `add_drivers`.

> **Важно**: `hostonly_mode="strict"` подходит для неизменяемой схемы
> загрузки, но после изменения контроллера, диска или нужного драйвера UKI
> необходимо пересобрать. Не отключайте сеть в initramfs, если корень или
> разблокировка LUKS требуют сети.

#### Настройка UKI и Secure Boot (90-uki.conf)

Этот файл отвечает за создание финального EFI-файла и его автоматическую подпись.

```conf
uefi="yes"

# Автоматическая подпись образа ключами sbctl
uefi_secureboot_cert="/var/lib/sbctl/keys/db/db.pem"
uefi_secureboot_key="/var/lib/sbctl/keys/db/db.key"
```

### 3. Параметры командной строки (CMDLINE)

Все параметры передаются ядру внутри UKI. При подписи UKI они входят в
проверяемый EFI-образ.

Файл: `/etc/dracut.conf.d/90-uki.conf` (переменная kernel_cmdline)

| Параметр | Описание |
|----------|----------|
| `rd.luks.uuid` | UUID вашего зашифрованного раздела. |
| `rd.luks.name=...=cryptroot` | Имя mapped-устройства для корневого LUKS. |
| `rd.luks.options=tpm2-device=auto,discard` | Автоматический поиск TPM2 + `discard` для TRIM. |
| `root=UUID=...` | UUID файловой системы внутри LUKS контейнера. |
| `rootflags=subvol=@` | Монтирование конкретного subvolume Btrfs. |
| `rootfstype=btrfs` | Тип корневой файловой системы. |
| `rw` | Подключение корня на запись. |
| `quiet` | Подавление лишнего вывода при загрузке. |
| `audit=1` | Включение аудита ядра. |
| `apparmor=1` | Явное включение AppArmor. |
| `lsm=landlock,lockdown,yama,integrity,apparmor,bpf` | Список активных модулей безопасности. |

`security=apparmor` здесь не нужен: при явном `lsm=` ядро использует порядок
из этого параметра. После изменения cmdline пересобери и проверь UKI, поскольку
строка входит в подписанный образ.

### 4. installkernel: генераторы и плагины

В Gentoo путь сборки выбирает `sys-kernel/installkernel` через
`/etc/kernel/install.conf`.

Для основного пути укажи один генератор UKI — Dracut:

```conf
# /etc/kernel/install.conf
layout=uki
initrd_generator=dracut
uki_generator=dracut
```

В systemd 261 плагин `52-dracut.install` при такой конфигурации запускает
`dracut --uefi --no-ukify` и создаёт `uki.efi` в staging-каталоге.
`90-uki-copy.install` переносит его в `EFI/Linux`, а `91-sbctl.install`
передаёт итоговый файл в `sbctl sign`. Dracut использует
`uefi_secureboot_cert` и `uefi_secureboot_key` из `90-uki.conf`.

Важно: при `uki_generator=dracut` файл `/etc/kernel/uki.conf` в generation
path не участвует — плагин `60-ukify.install` завершается, когда
`uki_generator` не равен `ukify`.

Чтобы ядро после сборки автоматически превращалось в UKI и попадало в ESP,
для `sys-kernel/installkernel` нужны USE-флаги `systemd-boot ukify dracut uki`:

```makefile
# /etc/portage/package.use/installkernel
sys-kernel/installkernel systemd-boot ukify dracut uki -grub -efistub -ugrd -refind
```

### 5. systemd-boot (loader)

Systemd-boot — загрузчик основной цепочки: он автоматически находит Type #2
UKI в `EFI/Linux` на ESP, куда образ уже скопирован плагином
`90-uki-copy.install`.

## Альтернативный путь: ukify генерирует UKI

```text
Alternative: ukify generates UKI
```

`ukify` — альтернатива, а не дополнительный этап к Dracut-генератору UKI.
Для него оставь Dracut генератором initramfs, но переключи генератор UKI:

```conf
# /etc/kernel/install.conf
layout=uki
initrd_generator=dracut
uki_generator=ukify
```

В этом режиме `52-dracut.install` создаёт только initramfs с `--no-uefi`.
Затем `60-ukify.install` читает `/etc/kernel/uki.conf`, объединяет ядро,
initramfs и cmdline в `uki.efi`, после чего тот же `90-uki-copy.install`
устанавливает образ в `EFI/Linux`. Параметры cmdline плагин берёт из
`/etc/kernel/cmdline`, а при отсутствии файла — из `/proc/cmdline`.

В режиме `ukify` за ключи подписи отвечает `/etc/kernel/uki.conf`:

```ini
# /etc/kernel/uki.conf
[UKI]
SecureBootPrivateKey=/var/lib/sbctl/keys/db/db.key
SecureBootCertificate=/var/lib/sbctl/keys/db/db.pem
```

Не переключай генератор без рабочего LUKS-пароля и загрузочного носителя.
Новый UKI меняет измеряемую загрузочную цепочку; после переключения проверь
Secure Boot и автоматическую TPM2-разблокировку до удаления fallback-образов.

## Обслуживание: пересборка UKI

После изменения конфигурации пересобирай UKI через `kernel-install`, чтобы
выполнились все плагины установки, включая копирование и проверку подписи:

```bash
KERNEL_VERSION="$(uname -r)"
doas kernel-install add "$KERNEL_VERSION" \
  "/usr/lib/modules/$KERNEL_VERSION/vmlinuz"
```

## Verification

До перезагрузки проверь выбранный образ:

```bash
doas bootctl list
UKI_PATH="/boot/EFI/Linux/<укажи-имя-из-bootctl-list>.efi"
doas sbctl verify "$UKI_PATH"
doas ukify inspect "$UKI_PATH"
```

После загрузки проверь фактическую строку cmdline и набор LSM:

```bash
cat /proc/cmdline
cat /sys/kernel/security/lsm
```

## Rollback / Fallback

Если новый UKI не загружается или TPM2 не разблокирует LUKS автоматически,
выбери в меню systemd-boot сохранённый подписанный fallback-UKI и восстанови
рабочую конфигурацию перед новой пересборкой. Fallback-образы не удаляй, пока
новая цепочка не проверена.

Диагностика сломавшейся TPM2-разблокировки (PCR-mismatch, перезачисление
токена) — в [troubleshooting: TPM2-анлок после пересборки
UKI](../../troubleshooting/luks-tpm2-unlock-after-uki-rebuild/).

## Источники

- [systemd kernel-install](https://www.freedesktop.org/software/systemd/man/latest/kernel-install.html)
- [systemd ukify](https://www.freedesktop.org/software/systemd/man/latest/ukify.html)
- [Dracut](https://man7.org/linux/man-pages/man8/dracut.8.html)
- [Параметры ядра Linux](https://www.kernel.org/doc/html/latest/admin-guide/kernel-parameters.html)
