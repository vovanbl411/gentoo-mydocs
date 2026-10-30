# CHECKPOINT.md — Текущее состояние и следующий шаг

## Current snapshot

| Параметр | Значение |
|----------|----------|
| Checkpoint updated | 2026-10-30 |
| Full-system audit baseline | 2026-09-22 — опорная сверка ядра, boot/UKI, graphics и polkit; полный аудит `/etc/portage` — 2026-09-14 |
| Recent partial verification | Ядро и version-specific patches, User-status LED service/session, toolchain и headset topology — 2026-10-30; pin topology headset mic через kernel log не подтверждена |
| Builder/binhost production acceptance | CLOSED / PASS — 2026-10-10; automatic private binpkg consumption и OFF source fallback приняты |
| Ветка | `main` |
| Система | Gentoo hardened/systemd, ядро `7.2.13-bdsm`, BIOS `B5402CBA.314` |
| Аппаратура | ASUS ExpertBook B5402CBA, Intel Core i7-1260P (Alder Lake) |
| Документация | Миграция Starlight RU/EN завершена; `check:i18n` входит в `npm run build` |

Обновление checkpoint не является новым полным аудитом системы.
Даты и границы отдельных проверок остаются в профильных документах.

## Current verified state

- **Профиль / toolchain**:
  `default/linux/amd64/23.0/no-multilib/hardened/systemd`;
  основной Clang/LLD 22, глобально `-O2` + ThinLTO.
  Отдельное окружение `workstation-kernel` на builder использует LLVM 23;
  `-O3` допустим только после package-specific benchmark;
  selective-правила не созданы. Подробности — в
  [сравнении `-O2` и `-O3`](src/content/docs/experiments/compiler-optimization/o2-vs-o3.md).
  BOLT отключён.
  [Загрузка и Portage](src/content/docs/systems/asus-b5402/system/boot-and-portage.md).
- **Boot / security**: systemd-boot + UKI, генератор — Dracut;
  Secure Boot + TPM2, LUKS2 TPM unlock на PCR 7 (sha256).
  AppArmor присутствует в активном наборе LSM; Audit и doas — по
  записанной конфигурации. Переход на ukify/PCR-подпись не выбран.
  [Boot/UKI](src/content/docs/systems/asus-b5402/system/boot-and-portage.md),
  [doas](src/content/docs/systems/asus-b5402/security/doas.md).
- **Ядро**: running `7.2.13-bdsm`; установлены
  `sys-kernel/gentoo-kernel-7.2.13` и `virtual/dist-kernel-7.2.13`.
  Workstation kernel собирается на `gentoo-builder-01` как version-specific
  GPKG и устанавливается с private binrepo; version-specific `savedconfig`
  и local patches. Подробности — в
  [загрузке и Portage](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#обновление-ядра-сборка-gpkg-на-builder).
  [Обзор системы](src/content/docs/systems/asus-b5402/index.md).
- **Graphics**: текущий live-драйвер — `i915`; тест Xe завершён откатом,
  активной миграции на Xe нет.
  [Графический стек](src/content/docs/systems/asus-b5402/hardware/graphics.md).
- **Headset mic**: ALC294, SSID `1043:1b2f`; local
  `20-asus-b5402-headset-mic.patch` применяет `ALC2XX_FIXUP_HEADSET_MIC`.
  На текущем kernel нет `hda_model` override, PipeWire показывает
  `Stereo Microphone`; `Headset Mic=0x19` через kernel log в этой сверке
  не подтверждён. Capture с совместимой CTIA TRRS-гарнитурой не подтверждён.
  [Конфигурация и проверка](src/content/docs/systems/asus-b5402/hardware/headset-microphone.md).
- **Desktop**: Umbriel + Noctalia, Niri — fallback; вход через greetd/tuigreet.
  PipeWire и один polkit-агент подтверждены ранее в сессии Niri.
  [Рабочее окружение](src/content/docs/systems/asus-b5402/desktop/environment.md).
- **Memory**: zram `RAM/2`, `zstd`, priority `100`;
  `vm.swappiness=100`, zswap отключён.
  [Управление памятью](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#управление-памятью).
- **User-status LED**: ABI `/sys/class/leds/:status` с бинарной яркостью
  `0/1`; local version-specific patch —
  `/etc/portage/patches/sys-kernel/gentoo-kernel-7.2.13/10-asus-wmi-user-status-led.patch`.
  Userspace поддерживает `auto/busy/off`; Umbriel Fn+1 переключает режимы.
  Service включён и активен, persisted mode читается; reboot/login lifecycle
  работает.
  [Реализация](src/content/docs/systems/asus-b5402/hardware/user-status-indicator.md).
- **Backups / sync**: KeePassXC backup automation и Google Drive delivery
  приняты; обычная Syncthing-синхронизация Gentoo ↔ Android принята.
  Реальный conflict/merge recovery остаётся PENDING.
  [Приложения системы](src/content/docs/systems/asus-b5402/applications.md),
  [backup](src/content/docs/settings/keepassxc-backup.md),
  [phone sync](src/content/docs/settings/keepassxc-phone-sync.md).

## Active work / Next step

**Kernel upstream:** v1 submitted / awaiting maintainer/reviewer feedback;
accepted или merged не подтверждены. v2 готовить только по конкретному review
feedback или при обнаружении новой проблемы. Подробности submission — в
[исследовании LED](src/content/docs/experiments/asus-user-status-indicator/index.md#upstream-v1).

**Gentoo Builder → private binrepo → workstation — CLOSED / PASS (2026-10-10):**
VM `5201` / `gentoo-builder-01` работает с целевого диска. No-multilib,
LLVM/Clang/LLD 22, portable `x86-64-v3`, repository/package-policy
синхронизация и full convergence — PASS с 2026-10-09; temporary bootstrap
exceptions удалены, userspace fallback для binutils/pango сохранён.
Stable `6.18.54-gentoo-dist-bin`, GRUB `2.14-r5`, BIOS/SeaBIOS + GPT,
Dracut, networking/DNS, SSH login и QEMU Guest Agent runtime — PASS.
Local GPKG production для zstd, OpenSSL и Mesa, индекс `Packages`, internal
HTTP backend `10.1.20.99:8080` и canonical HTTPS ingress через
`proxy-01` / Caddy — PASS:
`https://binhost.apps.home.9fans.uk/Packages` — HTTP/2 200, `via: 1.0 Caddy`.

Workstation: `FEATURES=getbinpkg` включён; единственный active remote binrepo
— private `gentoo-builder`. Official Gentoo binary repo inactive:
конфиг перенесён в `/etc/portage/gentoobinhost.conf.disabled`; Gentoo ebuild
repository остаётся source repository. ON E2E binary merge и automatic
consumption обычным `emerge` без `-g` — CLOSED / PASS.
OFF source fallback без cached GPKG — CLOSED / PASS: после HTTP 502 Portage
выбрал ebuild и вошёл в source build path. Тест остановлен Ctrl+C после
доказательства source path; полный fallback rebuild/merge не подтверждён.
Private repo принят unsigned (`verify-signature = false`); signing не blocker.

Routine userspace update — вручную, builder-first: sync/resolve/update `@world`
на builder (`buildpkg` создаёт GPKG) → только после PASS sync/update `@world`
на workstation. При failure builder routine update workstation не продолжается
до разбора причины. Workstation kernel отдельно собирается на builder как
version-specific GPKG; его намеренно исключают из routine `@world` flow и
обновляют отдельной kernel procedure. Workstation устанавливает его из private
binrepo. Scheduled update не используется; exact repository snapshot pinning
не реализован. Подходящие private V3 binpkgs используются автоматически,
остальное собирается локально с Alder Lake policy; срочное независимое
обновление workstation возможно через source.
Конфигурация, acceptance evidence и workflow — в
[workstation Portage](src/content/docs/systems/asus-b5402/system/boot-and-portage.md#private-binrepo-на-workstation).
Empirical comparison portable V3 vs Alder Lake завершён без практически
значимой регрессии в протестированных workload; результаты и ограничения — в
[CPU optimization](src/content/docs/experiments/compiler-optimization/alderlake-vs-x86-64-v3.md).
[Состояние builder](src/content/docs/systems/gentoo-builder-01/index.md).

## Open items

Эти задачи не выполнялись при cleanup. Для старых unresolved-пунктов без
нового подтверждения статус сохранён, а live-состояние нужно проверить
перед действием.

| Пункт | Текущий статус | Следующее действие / trigger |
|-------|----------------|-----------------------------|
| Builder SSH public-key / key-only access | PENDING; обычный SSH login — PASS | Проверить public-key login и key-only configuration отдельно от закрытого binhost scope |
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
