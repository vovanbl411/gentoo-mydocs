# Ядро и загрузка: Unified Kernel Image (UKI)

Этот раздел описывает процесс создания единого образа ядра (UKI), который включает в себя микрокод, initramfs и параметры командной строки, а также подписывается ключами Secure Boot.

## 1. Сборка ядра (gentoo-kernel)

В системе используется sys-kernel/gentoo-kernel с поддержкой savedconfig. Это позволяет использовать преимущества дистрибутивного ядра (автоматизация через Portage), сохраняя при этом глубокую оптимизацию под железо Alder Lake (~7600 строк конфига).

- Флаги: Убедитесь, что для ядра включены dist-kernel и savedconfig.
- Путь к конфигу: `/etc/portage/savedconfig/sys-kernel/gentoo-kernel-<version>`.

При обновлении ядра Portage автоматически подхватит ваш оптимизированный конфиг и инициирует сборку.

## 2. Конфигурация Dracut (Initramfs и UKI)

Dracut используется для генерации образа и упаковки его в .efi файл (UKI). Конфигурация разделена на модули для удобства поддержки.

### Глобальные настройки (`/etc/dracut.conf.d/00-global.conf`)

Минимизируем размер образа и включаем микрокод Intel.

```conf
hostonly="yes"
hostonly_mode="strict"
compress="zstd"
early_microcode="yes"
```

### Драйверы и модули (10-drivers.conf, 20-modules.conf)

Включаем поддержку новой графики Intel Xe, NVMe и системных компонентов для работы с шифрованием.

```conf
force_drivers+=" xe "
add_drivers+=" nvme "

# systemd в initramfs необходим для интеграции с TPM2
add_dracutmodules+=" systemd tpm2-tss crypt btrfs "
omit_dracutmodules+=" network nfs "
```

### Настройка UKI и Secure Boot (90-uki.conf)

Этот файл отвечает за создание финального EFI-файла и его автоматическую подпись.

```conf
uefi="yes"

# Автоматическая подпись образа ключами sbctl
uefi_secureboot_cert="/var/lib/sbctl/keys/db/db.pem"
uefi_secureboot_key="/var/lib/sbctl/keys/db/db.key"
```

## 3. Параметры командной строки (CMDLINE)

Все параметры передаются ядру внутри UKI. Это исключает возможность их подмены злоумышленником.

Файл: `/etc/dracut.conf.d/90-uki.conf` (переменная kernel_cmdline)

| Параметр | Описание |
|----------|----------|
| `rd.luks.uuid` | UUID вашего зашифрованного раздела. |
| `rd.luks.options=tpm2-device=auto` | Ключевой момент: автоматический поиск TPM2 для разблокировки LUKS. |
| `root=UUID=...` | UUID файловой системы внутри LUKS контейнера. |
| `rootflags=subvol=@` | Монтирование конкретного subvolume Btrfs. |
| `security=apparmor` | Активация AppArmor как основного механизма безопасности. |
| `lsm=...` | Список активных модулей безопасности (Landlock, BPF, AppArmor). |

## 4. Автоматизация и загрузчик

Так как мы генерируем готовый .efi файл, systemd-boot настраивается элементарно. Ему не нужны сложные конфиги для каждого ядра — он автоматически находит UKI образы в директории EFI/Linux на вашем ESP-разделе.

Для применения изменений после обновления конфигов Dracut:

```bash
# Пересборка образа вручную (если нужно)
dracut --force --uefi
```
