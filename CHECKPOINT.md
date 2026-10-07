# CHECKPOINT.md — Текущее состояние и следующий шаг

## Current snapshot

| Параметр | Значение |
|----------|----------|
| Checkpoint updated | 2026-10-08 |
| Full-system audit baseline | 2026-09-22 — опорная сверка ядра, boot/UKI, graphics и polkit; полный аудит `/etc/portage` — 2026-09-14 |
| Recent partial verification | Ядро + User-status LED — 2026-10-07 |
| Ветка | `main` |
| Система | Gentoo hardened/systemd, ядро `7.2.9-bdsm`, BIOS `B5402CBA.314` |
| Аппаратура | ASUS ExpertBook B5402CBA, Intel Core i7-1260P (Alder Lake) |
| Документация | Миграция Starlight RU/EN завершена; `check:i18n` входит в `npm run build` |

Обновление checkpoint не является новым полным аудитом системы.
Даты и границы отдельных проверок остаются в профильных документах.

## Current verified state

- **Профиль / toolchain**:
  `default/linux/amd64/23.0/no-multilib/hardened/systemd`;
  основной Clang/LLD 22, глобально `-O2` + ThinLTO.
  LLVM 23.1.1 намеренно используется для ядра через `env/kernel-llvm`;
  `rust-bin-1.97.1`. `-O3` допустим только после package-specific benchmark;
  selective-правила не созданы. BOLT отключён.
  [Загрузка и Portage](src/content/docs/systems/asus-b5402/system/boot-and-portage.md).
- **Boot / security**: systemd-boot + UKI, генератор — Dracut;
  Secure Boot + TPM2, LUKS2 TPM unlock на PCR 7 (sha256).
  AppArmor присутствует в активном наборе LSM; Audit и doas — по
  записанной конфигурации. Переход на ukify/PCR-подпись не выбран.
  [Boot/UKI](src/content/docs/systems/asus-b5402/system/boot-and-portage.md),
  [doas](src/content/docs/systems/asus-b5402/security/doas.md).
- **Ядро**: `7.2.9-bdsm`; boot и User-status LED acceptance — PASS
  2026-10-04. Это не regression-тест всех подсистем.
  [Обзор системы](src/content/docs/systems/asus-b5402/index.md).
- **Graphics**: текущий live-драйвер — `i915`; тест Xe завершён откатом,
  активной миграции на Xe нет.
  [Графический стек](src/content/docs/systems/asus-b5402/hardware/graphics.md).
- **Desktop**: pure Wayland, Niri + Noctalia, PipeWire;
  вход через greetd/tuigreet, polkit-агент один.
  [Рабочее окружение](src/content/docs/systems/asus-b5402/desktop/environment.md).
- **Memory**: zram `RAM/2`, `zstd`, priority `100`;
  `vm.swappiness=100`, zswap отключён.
  [Управление памятью](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#управление-памятью).
- **User-status LED — kernel**: live ABI `/sys/class/leds/:status`,
  `max_brightness=1`, successful state-read registration gate
  `asus_wmi_get_devstate_simple(...) >= 0`; физический ON/OFF — PASS.
  `orange:status` отсутствует. Локальный design совпадает с submitted
  upstream v1: без DMI whitelist и trigger. Upstream v1 submitted / awaiting
  review; accepted или merged не подтверждены. Локальный патч:
  `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.9/10-asus-wmi-user-status-led.patch`.
  [Реализация и acceptance](src/content/docs/systems/asus-b5402/hardware/user-status-indicator.md).
- **User-status LED — userspace**: `asus-user-status-led` функционально
  live-verified: Auto/Busy/Off, реальный PipeWire capture, Vesktop call,
  Noctalia Spectrum negative check, Fn+1 и исправление AUTO CPU feedback loop
  — PASS. Restart-flicker и reboot/login lifecycle остаются OPEN.
- **Backups / sync**: KeePassXC backup automation и Google Drive delivery
  приняты; обычная Syncthing-синхронизация Gentoo ↔ Android принята.
  Реальный conflict/merge recovery остаётся PENDING.
  [Приложения системы](src/content/docs/systems/asus-b5402/applications.md),
  [backup](src/content/docs/settings/keepassxc-backup.md),
  [phone sync](src/content/docs/settings/keepassxc-phone-sync.md).

## Active work / Next step

**Userspace/workstation acceptance:** следующие проверки — визуальная оценка
restart-flicker и reboot/login lifecycle: persisted mode, запуск user service,
udev permissions, нормальный старт AUTO, отсутствие CPU-loop regression и
работа Fn+1 после reboot.

**Kernel upstream:** v1 submitted / awaiting maintainer/reviewer feedback;
accepted или merged не подтверждены. v2 готовить только по конкретному review
feedback или при обнаружении новой проблемы. Подробности submission — в
[документе LED](src/content/docs/systems/asus-b5402/hardware/user-status-indicator.md#upstream-v1).

**Gentoo Builder VM — bootstrap in progress (проверено 2026-10-07):**
VM `5201` / `gentoo-builder-01` создана; CPU type `host` и capability
`x86-64-v3` подтверждены в госте. Диск 100 GiB подготовлен: GPT, 8 GiB swap
и ext4 root; hardened/systemd stage3 распакован, chroot и DNS работают.
Остановка — перед изменением `/etc/portage/make.conf`; final no-multilib
profile, `x86-64-v3` build target и package policy ещё pending, private binhost
не настроен, binpkg pilot не начат. Workstation Alder Lake policy не меняется,
kernel остаётся local-only.
Следующее действие — продолжить builder configuration по согласованному
Portage/profile/toolchain contract, начиная с review/apply `make.conf` и
profile policy. Обязательный gate будущего pilot — server ON / server OFF;
fallback при недоступном private binhost пока не подтверждён.
[Состояние builder](src/content/docs/systems/gentoo-builder-01/index.md).

## Open items

Эти задачи не выполнялись при cleanup. Для старых unresolved-пунктов без
нового подтверждения статус сохранён, а live-состояние нужно проверить
перед действием.

| Пункт | Текущий статус | Следующее действие / trigger |
|-------|----------------|-----------------------------|
| KeePassXC conflict/merge recovery | PENDING / NOT YET ACCEPTED | Проверить восстановление после двух одновременно изменённых копий и KeePassXC merge по [phone-sync guide](src/content/docs/settings/keepassxc-phone-sync.md) |
| Waydroid `=1.6.3` | Маска; снятие не подтверждено | При появлении исправленного релиза проверить его и решить вопрос снятия маски |
| LLVM 23 для остальных пакетов | Перевод не начат; ядро уже на LLVM 23 | Когда ebuild'ы потребителей объявят `llvm_slot_23`, проверить resolver и принять решение о переходе; [policy](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#package-policy) |
| `linux-firmware-20260916` savedconfig | Не применяется при выключенном USE `savedconfig`; судьба файла не решена | Перепроверить отсутствие применения и решить, нужен ли сохранённый список |
| `/etc/portage/profile/package.use.force` | Удаление пустого каталога не подтверждено | Проверить, что каталог всё ещё пуст и не нужен, перед удалением |
| ccache | По записи 2026-10-02 лимит снижен до 20G | Через 2–4 недели обычной работы проверить `ccache -s`; при hit rate заметно ниже ~15% поднять лимит до 30G; [решение](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#toolchain) |
| TPM2 / PCR 7 | Влияние cmdline на PCR 7 остаётся гипотезой | При следующей смене cmdline снять `tpm2_pcrread sha256:7` до/после; при сбое unlock использовать [troubleshooting](src/content/docs/troubleshooting/luks-tpm2-unlock-after-uki-rebuild.md) |
| Bluetooth HID / uinput | Проверка живым BT-устройством не подтверждена | При доступном устройстве проверить работу; старую успешную сборку не считать runtime acceptance |
| Второй NVMe backup/data | PLAN — NOT APPLIED | Перед применением плана заново проверить устройства, разметку и данные; [план](src/content/docs/systems/asus-b5402/hardware/second-disk.md) |
| OBS Studio guide | Техническая проверка не завершена; на системе используется Flatpak | Проверить [guide](src/content/docs/settings/obs-studio.md) с учётом [записанного состояния](src/content/docs/systems/asus-b5402/applications.md); native package policy остаётся планом |

## Sources of truth

- [AGENTS.md](AGENTS.md) — правила работы с репозиторием.
- [DOCUMENTATION_POLICY.md](DOCUMENTATION_POLICY.md) и
  [CONTRIBUTING.md](CONTRIBUTING.md) — контракты и подготовка изменений.
- [Системные документы ASUS B5402](src/content/docs/systems/asus-b5402/)
  — текущая конфигурация, даты verification и границы проверок.
- Профильные guides и troubleshooting по ссылкам выше — процедуры и
  ограничения; общие примеры не подтверждают live-состояние машины.
- Git history и history/verification в профильных документах — история
  изменений; checkpoint не дублирует её.
