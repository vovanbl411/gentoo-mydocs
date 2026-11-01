# CHECKPOINT.md — Текущее состояние и следующий шаг

## Current snapshot

| Параметр | Значение |
|----------|----------|
| Checkpoint updated | 2026-11-01 |
| Full-system audit baseline | 2026-09-22 — опорная сверка ядра, boot/UKI, graphics и polkit; полный аудит `/etc/portage` — 2026-09-14 |
| Recent partial verification | Kernel/runtime packages and patch paths, profile/toolchain, graphics binding, memory, Wayland session and LED ABI/service — 2026-11-01 |
| Builder/binhost production acceptance | CLOSED / PASS — 2026-10-10; automatic private binpkg consumption and source fallback entry accepted |
| Ветка | `main` |
| Система | Gentoo hardened/systemd; running kernel `7.2.13-bdsm`; установленная версия пакета указана ниже |
| Аппаратура | ASUS ExpertBook B5402CBA, Intel Core i7-1260P (Alder Lake) |
| Документация | Starlight RU/EN migration и documentation cleanup/reconciliation завершены; `check:i18n` входит в `npm run build` |

Это частичная сверка, а не новый полный аудит системы. Даты и границы
проверок остальных областей остаются в профильной документации.

## Current state summary

- **Профиль / toolchain**: `default/linux/amd64/23.0/no-multilib/hardened/systemd`;
  Clang и LLD `22.1.8`. В `/etc/portage/make.conf` заданы Alder Lake,
  `-O2` и ThinLTO. Userspace остаётся на LLVM 22; отдельное окружение сборки
  ядра использует LLVM 23. Принятые решения — в
  [сводке compiler optimization](src/content/docs/experiments/compiler-optimization/index.md)
  и [документе о загрузке и Portage](src/content/docs/systems/asus-b5402/system/boot-and-portage.md).
- **Ядро**: запущено `7.2.13-bdsm`; установлены
  `sys-kernel/gentoo-kernel` `7.2.13` и `7.2.14`, а также
  `virtual/dist-kernel` `7.2.14`. Patch directories есть для `7.2.12` и
  `7.2.13`; каталога `7.2.14` нет. Различие runtime и установленного пакета
  зафиксировано; `7.2.14` не обозначается как запущенное или принятое ядро.
  Готовность его UKI этим snapshot не подтверждена. Подробности процедуры — в
  [документе о загрузке и Portage](src/content/docs/systems/asus-b5402/system/boot-and-portage.md).
- **Boot / security**: документированная схема — systemd-boot + UKI через
  Dracut, Secure Boot и TPM2/LUKS2. Это не новая проверка boot security.
  Влияние cmdline на PCR 7 остаётся гипотезой; см. [boot/UKI](src/content/docs/systems/asus-b5402/system/boot-and-portage.md)
  и [troubleshooting](src/content/docs/troubleshooting/luks-tpm2-unlock-after-uki-rebuild.md).
- **Graphics**: Intel Iris Xe привязан к `i915`; эксперимент с Xe завершён
  откатом, миграция на Xe не принята. [Состояние графики](src/content/docs/systems/asus-b5402/hardware/graphics.md).
- **Desktop**: наблюдались Wayland и `XDG_CURRENT_DESKTOP=umbriel`.
  Документированная основная архитектура — Umbriel + Noctalia; Niri остаётся
  fallback. [Рабочее окружение](src/content/docs/systems/asus-b5402/desktop/environment.md).
- **Memory**: zram `11.5G`, `zstd`, priority `100`; `vm.swappiness=100`.
  Runtime-параметр zswap недоступен, `/sys/module/zswap` отсутствует; это
  согласуется с отключённым `CONFIG_ZSWAP` в savedconfig. [Память и кэши](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#память-и-кэши-сборки).
- **User-status LED**: ABI `/sys/class/leds/:status` доступен, brightness `0`;
  `user-status-led.service` включён и активен. [Реализация](src/content/docs/systems/asus-b5402/hardware/user-status-indicator.md).
- **Headset mic**: ALC294 использует version-specific quirk. Подтверждение
  `Headset Mic=0x19` через kernel log и запись с совместимой CTIA-гарнитурой
  остаются неподтверждёнными. [Состояние микрофона](src/content/docs/systems/asus-b5402/hardware/headset-microphone.md).
- **KeePassXC backup / sync**: backup pipeline и обычная двусторонняя
  Syncthing-синхронизация приняты. Реальное восстановление после одновременных
  изменений и KeePassXC merge остаётся PENDING. [Приложения системы](src/content/docs/systems/asus-b5402/applications.md),
  [backup](src/content/docs/settings/keepassxc-backup.md) и
  [phone sync](src/content/docs/settings/keepassxc-phone-sync.md).
- **Builder / private binrepo**: архитектура builder → unsigned private binrepo
  → workstation принята. E2E binary merge и автоматический выбор GPKG обычным
  `emerge` прошли; source fallback вошёл в ebuild build path, но полный merge
  не проверялся. Unsigned repo принят. Acceptance snapshot от 2026-10-10 не
  переаудировался; детали — в
  [документе builder](src/content/docs/systems/gentoo-builder-01/index.md) и
  [документе Portage workstation](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#private-binrepo-на-workstation).

## Open items

При этой сверке задачи ниже не выполнялись. Для неразрешённых пунктов статус
сохранён; перед началом действия проверь актуальные условия.

| Пункт | Текущий статус | Следующее действие / trigger |
|-------|----------------|-----------------------------|
| Builder SSH public-key / key-only access | PENDING; обычный SSH login — PASS | Проверить public-key login и key-only configuration отдельно от закрытого binhost scope |
| KeePassXC conflict/merge recovery | PENDING / NOT YET ACCEPTED | Проверить восстановление после двух одновременно изменённых копий и KeePassXC merge по [phone-sync guide](src/content/docs/settings/keepassxc-phone-sync.md) |
| Waydroid `=1.6.3` | Маска; снятие не подтверждено | При появлении исправленного релиза проверить его и решить вопрос снятия маски |
| LLVM 23 для остальных пакетов | Перевод не начат; ядро уже на LLVM 23 | Когда ebuild'ы потребителей объявят `llvm_slot_23`, проверить resolver и принять решение о переходе; [toolchain](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#toolchain) |
| `linux-firmware-20260916` savedconfig | Не применяется при выключенном USE `savedconfig`; судьба файла не решена | Перепроверить отсутствие применения и решить, нужен ли сохранённый список |
| `/etc/portage/profile/package.use.force` | Удаление пустого каталога не подтверждено | Проверить, что каталог всё ещё пуст и не нужен, перед удалением |
| ccache | По записи 2026-10-02 лимит снижен до 20G | Проверить `ccache -s`; при hit rate заметно ниже ~15% поднять лимит до 30G; [решение](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#toolchain) |
| TPM2 / PCR 7 | Влияние cmdline на PCR 7 остаётся гипотезой | При следующей смене cmdline снять `tpm2_pcrread sha256:7` до/после; при сбое unlock использовать [troubleshooting](src/content/docs/troubleshooting/luks-tpm2-unlock-after-uki-rebuild.md) |
| Bluetooth HID / uinput | Проверка живым BT-устройством не подтверждена | При доступном устройстве проверить работу; старую успешную сборку не считать runtime acceptance |
| Второй NVMe backup/data | PLAN — NOT APPLIED | Перед применением плана заново проверить устройства, разметку и данные; [план](src/content/docs/systems/asus-b5402/hardware/second-disk.md) |

## Active work / Next step

**Kernel upstream:** v1 submitted / awaiting maintainer/reviewer feedback;
accepted или merged не подтверждены. v2 готовить только по конкретному review
feedback или при обнаружении новой проблемы. Подробности — в
[исследовании LED](src/content/docs/experiments/asus-user-status-indicator/index.md#upstream-v1).

Следующий шаг остаётся trigger-based; обязательная новая техническая работа
после documentation cleanup не назначена.

## Sources of truth

- [AGENTS.md](AGENTS.md) — правила работы с репозиторием.
- [DOCUMENTATION_POLICY.md](DOCUMENTATION_POLICY.md) и
  [CONTRIBUTING.md](CONTRIBUTING.md) — контракты и подготовка изменений.
- [Системные документы ASUS B5402](src/content/docs/systems/asus-b5402/index.md)
  — текущее состояние, даты verification и границы проверок.
- Профильные guides и troubleshooting — процедуры и ограничения; общие
  примеры не подтверждают live-состояние машины.
- Git history и history/verification в профильных документах — история
  изменений; checkpoint не дублирует её.
