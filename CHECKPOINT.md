# CHECKPOINT.md — Текущее состояние проекта

> Файл состояния для ассистентов и автора: что сделано, что синхронизировано,
> что требует внимания.

---

## Метаданные

| Параметр | Значение |
|----------|----------|
| Дата последнего аудита | 2026-09-22 — live-system review (ядро, boot/UKI, graphics, polkit); `/etc/portage` целиком — 2026-09-14; baseline системы — 2026-09-10 |
| Ветка | `main` |
| Рабочее дерево | Starlight adaptation: Gates 1–5B.7 CLOSED; вся i18n-фаза CLOSED. Gate 5B.2 — commit `ab44d0be14fb36519d93412286767af885d898c7`, workflow run #6: `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success (15 EN / 37 fallback). Gate 5B.3 — commit `80ecddba621047594eeb0a9e4520e7589232ac3c`, workflow run #7: `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success (20 EN / 32 fallback). Gate 5B.4 CLOSED — commit `519bc6ef1501bbae48d67ae375c23654a9cfa48d`, workflow run #8: `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success (27 EN / 25 fallback). Gate 5B.5 CLOSED — commit `a19853f816e7019768e521ee3103dba15ec091b1`, workflow run #9: `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success (32 EN / 20 fallback). Gate 5B.6 CLOSED — commit `14324042a9dc23009439aaf4f5610ac1b2de1c6c`, workflow run #10: `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success (44 EN / 8 fallback; `systems/asus-b5402/` — 13/13 English). Gate 5B.7 CLOSED по локальному acceptance: 52 RU / 52 EN / 0 fallback; build generated 105 pages, Pagefind and sitemap succeeded. Deployment и workflow для Gate 5B.7 не выполнялись |
| Система | Gentoo, ядро `7.2.7-bdsm`, BIOS `B5402CBA.314`, systemd-boot + UKI, Secure Boot + TPM2 (авторазблокировка LUKS реально проверена 2026-09-14) |
| Аппаратура | ASUS ExpertBook B5402, i7-1260P (Alder Lake) |

---

## Состояние системы

- **Профиль**: `default/linux/amd64/23.0/no-multilib/hardened/systemd`.
- **Toolchain**: Clang/LLD 22 основной (`-O2` с 2026-09-20, ThinLTO, PGO);
  LLVM 23.1.1 — им намеренно собирается ядро (env `kernel-llvm`, пилот);
  слоты 21/24 удалены; `rust-bin-1.97.1`; BOLT отложен.
- **make.conf** (политика 2026-09-20): `-O2`/ThinLTO с исключениями
  `package.env`, явный `-mno-*`, `MAKEOPTS="-j14 -l10"`; глобальная
  compiler-cache policy: ccache для C/C++ и sccache для Rust.
  Замена `-O3` → `-O2` применена 2026-09-20 в `make.conf` и env-файлах
  (`kernel-llvm` уже был `-O2`);
  `portageq envvar CFLAGS CXXFLAGS` подтверждает `-O2 -flto=thin`, resolver
  рассчитывается. Полный rebuild установленного `@world` после смены
  optimization/LTO policy завершён 2026-09-21: post-rebuild boot/runtime
  проверены, связанных с policy регрессий не обнаружено.
- **CPU target review (2026-09-20)**: `-march=alderlake` сохранён;
  `-march=native` отклонён как production policy — явный таргет
  воспроизводим и проверяем, `native` зависит от CPU сборочной машины.
- **gcc-fallback cleanup (2026-09-20) COMPLETE**: остались `sys-devel/binutils`
  (реальная проблема Clang + PGO) и `x11-libs/pango` (временное исключение
  перед LLVM 23 rollout), оба через `env/gcc-fallback` с BFD (GCC LTO
  несовместим с глобальным `-fuse-ld=lld`). bash (включая `USE=pgo`), lxc,
  nano, highway, nmap,
  libjxl, modern OpenJDK собираются production Clang — больше не исключения.
- **no-LTO exception cleanup (2026-09-21) COMPLETE**: все 102 локальных
  `no-lto-llvm` overrides перепроверены и сняты контролируемыми batch'ами
  (`emerge --buildpkgonly -1`); `env/no-lto-llvm`, `env/no-ccache` (после
  исчезновения последнего потребителя) и `package.env/20-compatibility`
  удалены. Вывод: все 102 overrides оказались больше не нужны — для части
  пакетов ebuild сам управляет LTO (`filter-lto`), а часть Go/Rust-пакетов
  не использует эти C/C++ flags напрямую. Полный rebuild `@world` после
  изменения policy завершён 2026-09-21.
- **Java**: source `dev-java/openjdk:17` снят; system VM —
  `dev-java/openjdk-bin:25` (Temurin 25.0.4 LTS, проверено
  `java`/`javac -version`).
- **/etc/portage** — закрыт аудитами 2026-09-14: `package.use` — батчи
  1–9; `package.env` — 4 файла, 117 правил, `env/` — 8 файлов; keywords —
  10 доменных файлов, 104 правила; license и savedconfig почищены.
  После no-LTO cleanup 2026-09-21: `package.env` — 3 файла
  (`00-toolchain`, `10-performance`, `30-gcc-fallback`), `env/` — 4 файла
  (`gcc-fallback`, `kernel-llvm`, `p-cores`, `ssd`).
- **USE-policy review (2026-09-22) — COMPLETE**: gzip-алтернатива — `pigz`;
  `libpcre2 jit`; `openssl ktls`; `audit io-uring`; util-linux/pax-utils/
  coreutils `caps`; `gettext git`; глобально `verify-provenance` (дополняет
  `verify-sig`). Архитектурно: TPM — только LUKS2 (`tpm2-tss -fapi
  -policy`, `tpm2-tools -fapi`, `gnupg -tpm`, `libsecret -pam -tpm`);
  контейнеры — `lxc landlock`, `containerd -cri`, docker/podman `-btrfs`
  (storage `overlay2`/`overlay`); `htop caps -filecaps` + `smartmontools
  caps`; `chrony -phc -refclock -rtc`; `mesa -vaapi -lm-sensors`;
  clang-runtime — compiler-rt/sanitize без смены GNU runtime ABI;
  `openvpn -dco`; GStreamer ORC stack (base/good/bad); fwupd `uefi gnutls`;
  multimedia/image cleanup (ffmpeg `pulseaudio`, spice `opus`, imagemagick
  `lcms tiff`, libheif `-kvazaar`, poppler `cairo`, openjdk-bin `-source`);
  Qt `qtdeclarative jit`/`qtbase io-uring`; wireshark `http2 http3
  sshdump`; Firefox — stale `-jumbo-build` override снят (profile force,
  `pgo` требует jumbo-build); Noctalia 5.1.0 + `jemalloc` актуализирована.
  Полный аудит `/etc/portage` остаётся 2026-09-14. Подробности — в
  `src/content/docs/systems/asus-b5402/system/boot-and-portage.md`.
- **Resolver-эталон** (2026-09-14, утро): `emerge -pvuDN @world` — 0 пакетов.
  Вечером принято world-обновление (`libpcap-1.10.7`, `wayland-1.25.0` +
  выделенный `dev-util/wayland-scanner`, soft block решён автоматически) —
  эталон перепроверить.
- **Загрузка**: systemd-boot + UKI (генератор — Dracut, `dracut-cpio`); LSM
  через `lsm=` (без `security=apparmor`); cmdline дополнен
  `audit_backlog_limit=8192` (2026-09-14).
- **Ядро**: текущее — `7.2.7-bdsm` (обновлено 2026-09-22, загрузка успешная —
  это подтверждённая загрузка, а не regression-тест всех подсистем).
  Установлены `gentoo-kernel-7.2.7` и `-7.2.6`, `installkernel-68-r1`;
  UKI-генератор — Dracut (`/etc/kernel/install.conf`: `layout=uki`,
  `initrd_generator=dracut`, `uki_generator=dracut`). Savedconfig — rolling
  `gentoo-kernel` + версионные `7.2.6`/`7.2.7` + `linux-firmware-20260916`
  (проверено 2026-09-22).
- **Ядро 7.2.5 — пересборка 2026-09-14 (историческая запись)**:
  `RT_GROUP_SCHED_DEFAULT_DISABLED=y`
  (rtkit получил realtime, RR 99), `BT_HIDP=m`, `uinput` в
  `/etc/modules-load.d/uinput.conf`. Ошибки rtkit и kauditd-overflow в
  журнале — 0; hidp/uinput ждут проверки живым BT-устройством.
- **TPM2-разблокировка LUKS**: токен перезачислен на PCR 7 (sha256) 2026-09-14,
  проверена реальной загрузкой. Наблюдение: 2026-09-14 сбой анлока совпал со
  сменой cmdline, повторное зачисление восстановило работу; в марте/апреле
  были эпизоды сбоя анлока, причина не исследовалась. Связь cmdline → PCR 7 —
  гипотеза: точный measurement path прошивки не подтверждён, прямого
  before/after-замера PCR 7 не было. Решение 2026-09-14 — остаёмся
  на PCR 7, переход на ukify/PCR-подпись отклонён.
- **Рабочий стол**: Pure Wayland — Niri + Noctalia 5.1.0
  (`::noctalia-overlay`, `jemalloc`), PipeWire, `xwayland-satellite-0.8.2`.
- **iwd sandbox (2026-09-21)**: в локальном drop-in `iwd.service`
  `ProtectKernelTunables` переведён в `no` — `yes` блокировал запись
  `arp_evict_nocarrier`/`ndisc_evict_nocarrier` (iwd управляет ими для
  Wi-Fi roaming); остальной hardening сохранён.
- **Polkit agent**: дублирующий ручной запуск
  `polkit-gnome-authentication-agent-1` убран из Niri autostart (2026-09-21).
  Runtime-проверка 2026-09-22 закрыта в части «ровно один агент»: в текущей
  сессии работает один процесс; юнит
  `app-polkit-gnome-authentication-agent-1@autostart.service` в текущей
  user manager-сессии не существует, источник запуска процесса по имеющимся
  данным не установлен. Подробности —
  `src/content/docs/systems/asus-b5402/desktop/environment.md`.
- Firewall и AppArmor отложены отдельными решениями; живая система не
  изменяется без согласования.

---

## Хвосты и календарь

- Удалить пустой каталог `/etc/portage/profile/package.use.force`.
- Waydroid: маска `=1.6.3` (верхняя версия в `::guru`) — снять, когда
  выйдет исправленный релиз.
- cpptrace — prospective (Noctalia crash-handler): правила в
  `package.use/30-graphics-desktop` и `keywords/90-prospective`.
- `savedconfig/sys-kernel/linux-firmware-20260916` не применяется (USE
  `savedconfig` выключен); судьба файла не решена.
- ccache: лимит C/C++ cache — 50G; размер можно пересмотреть после периода
  обычных обновлений. sccache для Rust — 20G; размер менять только по
  накопленной production статистике.
- LLVM 23: перевод пакетов, когда ebuild'ы потребителей объявят
  `llvm_slot_23`.
- Optimization policy (решение 2026-09-20, Experiment B COMPLETE):
  global `-O2` + selective benchmark-proven `-O3`; selective rules не
  создаются. Политика применена к `/etc/portage` 2026-09-20; полный rebuild
  `@world` завершён 2026-09-21 (boot/runtime без связанных с policy
  проблем). Порядок далее: controlled LLVM 23 rollout `env/llvm-23`
  (`src/content/docs/experiments/llvm23-toolchain/`).
- ESP на 2026-09-22 (`bootctl list`): UKI `gentoo-7.2.7-bdsm.efi` (selected),
  `gentoo-7.2.6-bdsm.efi`, `gentoo-7.2.2-bdsm.efi` и Arch UKI
  (`arch-linux-cachyos.efi` — default, `arch-linux.efi`); UKI 7.2.5 и его
  backup-копия не наблюдаются — прежний пункт о судьбе backup-UKI снят.
- Версионированные savedconfig `gentoo-kernel-7.2.6` и `gentoo-kernel-7.2.7`
  существуют вместе с rolling-файлом `gentoo-kernel` (проверено 2026-09-22;
  приоритет PF > PN по правилу eclass).
- При следующем изменении cmdline: снять `tpm2_pcrread sha256:7` до/после и
  сравнить — проверит гипотезу, что cmdline меняет PCR 7 (quirk прошивки
  ASUS); до замера считать гипотезой, не установленным фактом.
- Если после пересборки UKI/cmdline снова запрошен пароль LUKS —
  перезачислить токен: `systemd-cryptenroll --tpm2-device=auto
  --tpm2-pcrs=7 --wipe-slot=tpm2 /dev/nvme1n1p2`.
- Косметика прошивки ASUS, принятая как есть: ACPI `WIST`/`CNVW`,
  `ucsi_acpi` «bogus connector», ddcutil-retries, sixaxis-строка bluetoothd.

---

## Методика аудита

- Список флагов/атомов — из сплошных прогонов VDB и конфигов, не из
  ручных списков (`equery uses` неполон).
- Перед выключением флага смотреть `REQUIRED_USE`; помнить про `use.force`
  профиля (сильнее `package.use`).
- Правки владелец применяет сам; команды — без переменных и heredoc
  (его shell — fish); проверять строгими счётчиками и resolver-эталоном.
- Команды перед отдачей проверять на существование действия/флага в
  установленной версии инструмента; агент никогда не запускает `doas` сам
  (audit-логирование попыток аутентификации).

---

## Источники правды

- Контракт документации: `DOCUMENTATION_POLICY.md`; правила изменений:
  `CONTRIBUTING.md`; классификация: `DOCUMENTATION_INVENTORY.md`.
- Состояние эталонной системы: `src/content/docs/systems/asus-b5402/`.
- Рабочие аудиты — `.history/systems/asus-b5402/audits/` (локально, вне
  Git; соглашение 2026-09-13: аудиты не публикуются).
- `.codex/` — локальный контекст, публичных утверждений не подтверждает.

---

## История изменений

| Дата | Событие |
|------|---------|
| 2026-09-25 | Завершён rollout sccache для Rust: `dev-util/sccache-0.16.0`, глобальный `RUSTC_WRAPPER=/usr/bin/sccache`, каталог `/var/tmp/sccache` на отдельном Btrfs subvolume `@sccache`, лимит 20G. Постоянный foreground daemon — enabled/active `sccache-portage.service` от `portage:portage`, transport — Unix domain socket `/var/tmp/sccache/sccache.sock` (TCP localhost не подходит для Portage с `FEATURES=network-sandbox`). Controlled production acceptance: cold/warm — 160.40s → 94.65s; 151 misses → 151 hits (147 Rust, 4 Assembler), около 41% меньше wall-clock; cacheable Rust compiler work ускоряется, non-cacheable crate types остаются. Решение: оставить sccache в production; лимит 20G пересматривать по накопленной production статистике. Remote storage и distributed compilation не используются; ccache для C/C++ остаётся независимой policy. |
| 2026-09-25 | Проверен production ccache после интенсивного периода сборок, включавшего смену optimization/toolchain policy, `--buildpkgonly`-проверки и полный rebuild `@world`: 234 108/328 009 cacheable calls (71,37%), 50 581 hits (21,61%: 23 474 direct, 27 107 preprocessed), 183 527 misses, 93 897 uncacheable calls, 4 errors. Каталог — 47G; локальное хранилище 50,0/50,0 GB (99,90%), 276 cleanups. Решение: оставить глобальный ccache включённым как практически полезный; лимит 50G и конфигурацию не менять. Размер можно пересмотреть после периода обычных обновлений. |
| 2026-09-25 | Исправлена запись Gate 5B.6 по фактическому workflow run #10: `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success; на тот момент было 52 RU, 44 EN и 8 fallback, включая 13/13 English-страниц `systems/asus-b5402/`. Все 8 оставшихся fallback-страниц находились в `experiments/`, а production artifact содержал стандартное untranslated notice. Предыдущий локальный вывод об отсутствии notice был ошибочным. Gate 5B.6 CLOSED на commit `14324042a9dc23009439aaf4f5610ac1b2de1c6c`. Gate 5B.7 CLOSED локально; вся i18n-фаза CLOSED. Deployment и workflow для Gate 5B.7 не выполнялись. |
| 2026-09-25 | Gate 5B.7 CLOSED; i18n-фаза CLOSED — созданы 8 EN-переводов для `experiments/`; metadata и структура пар совпадают, русские источники не менялись. Удалён устаревший статусный абзац на EN landing page о незавершённом переводе. Для таблиц и исторических данных подтверждена числовая и структурная parity; команды, output и identifiers сохранены. Cyrillic scan нашёл только literal verification output в `results.md`. `npm run check:i18n` — PASS: 52 RU / 52 EN / 0 fallback; build — 105 HTML pages; Pagefind — 52 RU + 52 EN fragments; sitemap — 104 уникальных locale URL. Все 52 EN routes имеют `lang="en"`; language picker ведёт к RU-counterpart; rendered fallback notice отсутствует. Проверены 5350 внутренних ссылок из EN-страниц: нет отсутствующих targets, locale escapes или broken fragments; Markdown-ссылки не содержат hardcoded `/en/` и `.md`. `git diff --check` — PASS. Изменения локальные: Gate 5B.7 CLOSED по локальному acceptance; deployment, commit/push и workflow для него не выполнялись. |
| 2026-09-25 | Локально добавлены 12 EN-переводов для `systems/asus-b5402/`. Metadata, заголовки, code fences, таблицы и цели ссылок совпадают с RU-источниками; семантика команд и конфигураций сохранена, Cyrillic scan пустой. `npm run check:i18n` — PASS: 52 RU / 44 EN / 8 fallback; все fallback-страницы находятся в `experiments/`. Сборка — PASS: 105 HTML-страниц; Pagefind сообщает 52 RU + 52 EN страницы, sitemap содержит 104 locale URL. Все 13 ASUS routes собраны с `lang="en"`, английскими заголовками и переключателем на соответствующую RU-страницу; 50 внутренних ссылок остаются в `/en/`, ASUS fallback-целей нет. Тогдашняя локальная диагностика двух fallback-страниц `experiments/` ошибочно заключила, что стандартного untranslated notice в artifact нет. Workflow run #10 подтвердил обратное: notice присутствовал, а Gate 5B.6 был CLOSED. RU-источники не менялись. |
| 2026-09-25 | Gate 5B.5 выполнен локально — переведены все 5 страниц `troubleshooting/` (`android-usb-mtp`, `docker-29-iptables-missing`, `docker-libvirt-nftables`, `luks-tpm2-unlock-after-uki-rebuild`, `networkmanager-iwd-mac-randomization`). Metadata parity подтверждён для `kind`, `scope`, `status`, `last_verified`, `verified_on`; переведены только titles и prose, даты проверки сохранены. Русские источники не менялись. Во всех парах совпадают число и уровни headings, code blocks и internal links; команды, конфиги, nftables rules, NetworkManager/iwd keys, PCR values, identifiers, paths и literal output сохранены; переведены reader-facing comments и conceptual labels. Cyrillic scan EN-файлов пустой. `npm run check:i18n` PASS: 52 RU / 32 EN / 20 fallback, changed Russian sources: 0; оставшийся fallback: `systems/` — 12, `experiments/` — 8. Build PASS: 105 HTML pages; Pagefind создал EN и RU индексы, все 5 troubleshooting routes найдены в EN index; sitemap — 104 locale URLs. Все 5 rendered EN routes имеют `lang="en"`, English H1, language picker на точную RU-страницу и не показывают fallback notice; internal links разрешаются внутри `/en/` с сохранением fragments. `/en/systems/asus-b5402/applications/` и `/en/experiments/llvm23-toolchain/` по-прежнему показывают RU fallback с notice. Gate 5B.5 CLOSED: commit `a19853f816e7019768e521ee3103dba15ec091b1`, workflow run #9 — `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success (32 EN / 20 fallback). |
| 2026-09-25 | Gate 5B.4 — переведены `managed/portage.md` и все 6 страниц `settings/` (7 новых EN-файлов). Metadata parity подтверждён для `kind`, `scope`, `status`, `last_verified`, `verified_on`; titles переведены, даты проверки сохранены. Команды, конфигурационные значения, пути, package atoms, USE flags, Flatpak IDs, desktop-entry keys, MIME identifiers и CSS semantics сохранены; переведены reader-facing comments и conceptual diagrams. Cyrillic scan новых файлов — пустой. `npm run check:i18n` PASS: 52 RU / 27 EN / 25 fallback, changed Russian sources: 0. Build PASS: 105 HTML pages; Pagefind создал EN и RU индексы (по 52 fragments); sitemap — 104 URL (52 RU + 52 EN). Rendered-проверка: все 7 EN routes имеют `lang="en"`, English title, RU/EN language picker и не показывают fallback notice; указанные cross-links остаются в `/en/` и цели существуют. `/en/troubleshooting/android-usb-mtp/` сохранил Russian fallback notice. Gate 5B.4 выполнен локально; commit/push/workflow deployment ещё не выполнялись. |
| 2026-09-25 | Gate 5B.3 CLOSED: commit `80ecddba621047594eeb0a9e4520e7589232ac3c`; workflow run #7 — `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success (20 EN / 32 fallback). |
| 2026-09-25 | Gate 5B.2 — полный English-перевод общих разделов Filesystem, Hardware и Networking: созданы 6 файлов `en/filesystem/btrfs-setup.md`, `en/filesystem/snapper-backups.md`, `en/hardware/intel-graphics.md`, `en/networking/networkmanager-iwd.md`, `en/networking/nftables-firewall.md`, `en/networking/wireless-regulatory.md`; итого 15 EN / 37 fallback. Translation parity: русские источники не изменялись; kind/scope/status/last_verified/verified_on скопированы без изменений (diff по всем 6 парам — metadata IDENTICAL), переведены только titles (рекомендованные) и prose. Code blocks: построчный diff с исходниками — отличия только в reader-facing `#`-комментариях (переведены: btrfs/snapper/intel-graphics/nftables; в networkmanager-iwd и wireless-regulatory блоки без комментариев, byte-identical); команды, конфиги, identifiers, nftables-правила, literal journal-строка iwd — без изменений. Ссылки: route-relative contract (без `/en/`, `.md`, base); все относительные ссылки 6 новых страниц проверены по rendered HTML — резолвятся внутри `/en/` (включая fallback-цели systems/troubleshooting). Cyrillic-scan новых 6 файлов: 0. Guard: `check:i18n` PASS — 52 RU / 15 EN / 37 fallback, changed RU sources: 0. Build: 105 pages, Pagefind 105 HTML (shard-фрагменты 52 EN + 52 RU — все EN-маршруты в English index), sitemap 104 `<loc>`-URL (52 RU + 52 EN, дубликатов нет). Rendered: все 6 EN-страниц `lang="en"`, English titles, fallback-notice отсутствует, language picker ведёт на соответствующий RU-маршрут; `/en/security/app-armor/` по-прежнему Russian fallback с notice — глобальный fallback цел. Sidebar/IA не менялись. Финальный editorial pass (humanize-docs) — 3 локальные правки prose, technical semantics не тронуты. Не делалось: перевод managed/security/settings/troubleshooting/systems/experiments, правка русских источников и существующих 9 EN-переводов, sidebar/route изменения, новые dependencies/tooling, технический аудит. Gate 5B.2 закрыт: commit `ab44d0be14fb36519d93412286767af885d898c7`; workflow run #6 — `check:i18n` PASS, build/deploy success, 105 pages, Pagefind/sitemap success. |
| 2026-09-25 | Gate 5B.1 — полный English-перевод разделов Installation и Desktop: 5 новых файлов `en/installation/systemd-uki-setup.md`, `en/installation/secure-boot-tpm.md`, `en/desktop/default-applications.md`, `en/desktop/noctalia-shell.md`, `en/desktop/wayland-portals.md`; вместе с пилотами base-system и niri оба раздела целиком English. Translation parity: русские исходники не изменялись; kind/scope/status/last_verified/verified_on скопированы без изменений; переведены только titles и prose. Code blocks: команды/конфиги/identifiers/пути byte-identical исходникам; reader-facing комментарии внутри блоков переведены (новое правило), literal output сохранён; плоты base-system/niri не трогались — их старые русские комментарии можно привести к новому правилу позже отдельной синхронизацией. Ссылки: route-relative contract сохранён (без `/en/`, `.md`, base); проверено по rendered HTML — все 13 относительных ссылок из 5 новых страниц резолвятся внутри `/en/` (включая fallback-цели settings/systems/troubleshooting); fragment-ссылки `../systemd-uki-setup/#rollback--fallback` работают — EN-заголовок «Rollback / Fallback» даёт тот же anchor `rollback--fallback` (паттерн рендера fragment-ссылок относительным href — pre-existing, идентичен RU-сайту). Cyrillic-scan новых 5 файлов: 0; остатки кириллицы в en/ — только старые комментарии пилотов (осознанно). Guard: `check:i18n` PASS — 52 RU / 9 EN / 43 fallback, changed RU sources: 0. Build: 105 pages (fallback routes получили реальный контент, новых маршрутов нет), Pagefind en+ru шарды, sitemap 104 URL (7 EN installation/desktop входят). Rendered: все 7 EN-страниц `lang="en"`, fallback-notice отсутствует, language picker ведёт на RU-маршрут; `/en/security/app-armor/` по-прежнему Russian fallback (notice на месте) — глобальный fallback цел. EN sidebar: Installation (Base system configuration; Kernel and boot: UKI; Security: Secure Boot and TPM 2.0) и Desktop (Niri; Noctalia; XDG Desktop Portals; Default applications) — titles из локализованных документов, структура sidebar не менялась. Policy: DOCUMENTATION_POLICY §10 + AGENTS §3 — уточнено правило перевода комментариев в code blocks. Не делалось: перевод остальных разделов, правка пилотов, Russian source edits, sidebar/route изменения. Впоследствии закоммичен как `3eacca0`; workflow run #5 (check:i18n=PASS, build=success, deploy=success, 105 pages, Pagefind/sitemap success) — Gate 5B.1 CLOSED. |
| 2026-09-25 | Gate 5A.1 — i18n sync guard (maintenance guard, не translation): создан `scripts/check-i18n-sync.mjs` (только Node.js stdlib + Git CLI, без новых зависимостей), npm-скрипт `check:i18n`, `build` = `npm run check:i18n && astro build`. Диапазон diff: приоритет `--base <ref>` → GitHub push payload `before` (читается самим checker'ом из `GITHUB_EVENT_PATH`; отсутствующий/all-zero/недоступный SHA → fallback без аварии) → dirty working tree vs HEAD (staged/unstaged/untracked внутри `src/content/docs`, untracked обрабатываются явно — `git diff HEAD` их не видит) → `HEAD^..HEAD`; без `HEAD^` (initial/shallow) — только структурные проверки. Structural invariant (всегда, без Git): EN-файл без RU-источника → FAIL orphan (в сообщении оба пути). Change-aware: changed RU + существующий unchanged EN → FAIL stale; changed RU + changed EN → PASS; changed RU без EN → PASS fallback (Starlight fallback, перевод не требуется); EN changed без RU — не ошибка. Checker намеренно conservative (любое изменение RU с существующим EN требует review), без waiver/manifest/frontmatter-hash — Git history остаётся change record. `deploy.yml`: checkout `fetch-depth: 0` — полный push-диапазон `before → HEAD` при multi-commit push (withastro/action запускает `npm run build`, guard исполняется в CI без отдельного шага). Сценарии проверены: A — текущий репо PASS (52 RU / 4 EN / 48 fallback, диапазон `HEAD^..HEAD`: в `292886a` добавлены только 4 EN); B — RU `desktop/niri.md` изменён, EN нет → FAIL stale (exit 1), восстановлено; C — RU+EN вместе → PASS (Synced); D — `security/auditd.md` (без EN) → PASS (Fallback); E — orphan `en/__i18n-orphan-test.md` → FAIL (exit 1), удалён; F — `--base HEAD^` → PASS, `--base no-such-ref` → понятная ошибка exit 2; untracked RU без EN и untracked RU+EN пары тоже учтены. Acceptance: `npm ci`, `npm run build` (checker внутри build — PASS, затем 105 pages, Pagefind found 105 HTML files, `sitemap-index.xml`). Документация: DOCUMENTATION_POLICY §10 (sync guard, conservative, fallback не ошибка, completeness не requirement), AGENTS §4 (запуск после правок документов; stale → синхронизировать или осознанно удалить EN-copy; не обходить), CONTRIBUTING §5 (`npm run check:i18n` в минимальной проверке). Не делалось: новые переводы, машинный перевод, waiver-система, отдельный workflow step. Здесь же закрыт factual drift Gate 5A: Gate 5A CLOSED — commit `292886a`, workflow run #3 (build=success, deploy=success), 105 pages, multilingual deployment live. Впоследствии закоммичен как `20c5d61`; workflow run #4 (check:i18n=PASS, build=success, deploy=success, 105 pages) — закрытие зафиксировано в записи Gate 5B.1 выше. |
| 2026-09-25 | Gate 4 CLOSED: коммит `25b5280` (sidebar IA, Actions majors, README live link), workflow run проверен владельцем — build=success, deploy=success, Node 24, 53 pages, Pagefind и sitemap success. Gate 5A — English i18n foundation + pilot (выполнен локально в этой сессии; впоследствии закоммичен как `292886a` и задеплоен — workflow run #3 build/deploy success; закрытие зафиксировано в записи Gate 5A.1 выше): `astro.config.mjs` — добавлена locale `en` (`label: 'English'`, `lang: 'en'`), русский остался root/default; русские ручные sidebar-labels получили per-item `translations: { en: ... }` (Главная→Home, Установка→Installation, Рабочий стол→Desktop, Файловая система→Filesystem, Оборудование→Hardware, Сеть→Networking, Безопасность→Security, Приложения и настройки→Applications & settings, Решение проблем→Troubleshooting, Исследования→Research, Обзор системы→System overview, Приложения→Applications, Система→System, Приложения по умолчанию→Default applications); top-level `labels`-опция в Starlight 0.42.4 не существует — переводы sidebar делаются полем `translations` у каждого item (проверено по schema/navigation.js: `pickLang(item.translations, lang)`). Созданы 4 пилотных перевода: `en/index.md` (полноценная English homepage), `en/installation/base-system.md`, `en/desktop/niri.md`, `en/systems/asus-b5402/index.md` — frontmatter-метаданные (kind/scope/status/last_verified/verified_on) сохранены из источников, code blocks оставлены байт-в-байт (включая русские комментарии в make.conf/doas.conf — политика «не переводить code blocks»), ссылки route-relative без `/en/` в Markdown. Остальные ~48 документов НЕ переведены — штатный Starlight fallback: `/en/...` маршруты существуют, показывают русский контент с уведомлением «This content is not available in your language yet.». Проверено по build+preview: 105 страниц (52 RU + 52 EN + 404); RU URL без `/ru/` и неизменны; hreflang-альтернаты появились на RU страницах; language picker переключает RU↔EN той же страницы (в т.ч. EN fallback ↔ RU source); internal links из EN-страниц резолвятся внутри `/en/` (включая непереведённые цели-fallback); сломанных внутренних ссылок нет (единственные несуществующие цели — самоссылки `/404/` и `/en/404/` на самой 404-странице: Starlight рендерит один 404 в default locale, `/en/404` не генерируется — известное поведение, не блокер; favicon.svg отсутствовал и до Gate 5A); Pagefind — 2 шарда en(52)+ru(52), EN-пилот в поисковом индексе; sitemap — 104 URL обеих локалей. Sidebar на fallback-страницах EN: группы английские, autogenerated titles непереведённых документов — русские (допустимо в pilot). Контракты: DOCUMENTATION_POLICY §10 (locale model, file mapping, translation lifecycle, links), AGENTS §3 (правила переводов), CONTRIBUTING §6 (синхронизация en/-перевода при semantic change). Предупреждения сборки без изменений: expressive-code `conf`/`nft`/`apparmor` (pre-existing), `collection "i18n" does not exist` (harmless, `src/content/i18n/` не создаётся), `Entry docs → 404 was not found` (pre-existing, Starlight fallback-запись 404). Не делалось: перевод остальных документов, `/ru/`-migration, custom components/i18n JSON, 404-страница. |
| 2026-09-25 | Gate 3 deployment подтверждён: workflow run для `67d378d` (build=success, deploy=success), Pages URL <https://vovanbl411.github.io/gentoo-mydocs/> — Gate 3 CLOSED. Gate 4 — sidebar IA: явный `sidebar` в `astro.config.mjs` заменяет filesystem-autogen верхний уровень. Иерархия: Главная; Установка (manual, порядок base-system → systemd-uki → secure-boot-tpm, labels из title); Portage (одиночный internal link); Рабочий стол / Файловая система / Сеть / Безопасность (manual с русскими labels и человеческим порядком); Оборудование (одиночный internal link на intel-graphics); Приложения и настройки (autogenerate settings, collapsed); Решение проблем (autogenerate troubleshooting, collapsed); ASUS ExpertBook B5402 (collapsed; Обзор системы + Приложения manual, затем русские подгруппы Рабочий стол/Файловая система/Оборудование/Сеть/Безопасность/Система с autogenerate); Исследования (collapsed; подгруппы LLVM 23 toolchain и ELAN fingerprint 04f3:0c77 с autogenerate). Проверено по rendered HTML: 52 sidebar-записи без дубликатов, все маршруты покрыты, русские labels групп (нет сырых `desktop`/`filesystem`/…), collapsed только у четырёх больших групп, core-разделы открыты; роуты/slug'и не менялись (53 страницы, включая 404). Actions majors актуализированы: `checkout@v7`, `withastro/action@v6` (`node-version: 24` — engines Astro 7.3.5 `>=22.12` допускает 24; явный major для воспроизводимости), `deploy-pages@v5`. README: заметная ссылка на live-сайт после вводного абзаца; GitHub-навигация сохранена. DOCUMENTATION_POLICY: sidebar IA задаётся в `astro.config.mjs`, directory structure не определяет пользовательские labels. Не делалось: CSS/badges/theme, скрытие страниц, code-fence languages (warnings expressive-code о `conf`/`nft`/`nftables`/`apparmor` остаются — presentation cleanup отдельным проходом). |
| 2026-09-25 | Starlight Gate 3 — deployment model + link contract. `astro.config.mjs`: `site: 'https://vovanbl411.github.io'`, `base: '/gentoo-mydocs'`; locale-конфиг переведён на канонический root-ключ (`defaultLocale: 'root'`, `locales.root` с `lang: 'ru'`) — прежний паттерн `defaultLocale: 'ru'` + `locales.ru` порождал битый href `/ru` у заголовка сайта (Starlight считал locale префиксным). Link contract: 237 внутренних ссылок в 46 документах конвертированы из `.md` source paths в route-relative маршруты (`../../installation/base-system/`, `../` для index раздела; якоря сохранены) — выбрано по эмпирической проверке POC-страниц: route-relative попадают в HTML как есть и резолвятся под base; root-relative без base и `.md`-цели дают 404. 3 сломанные ссылки `cpu-optimization.md` на repository-level материалы (`archive/bolt.md` ×2, `CHECKPOINT.md`) — после Gate 2 указывали на несуществующий `src/content/docs/archive/` — заменены явными GitHub URL. `.github/workflows/deploy.yml`: официальный паттерн Astro Pages (checkout@v4 + withastro/action@v3 c `node-version: 22` — engines Astro 7.3.5 требует Node ≥22.12 + deploy-pages@v4, environment `github-pages`, permissions contents:read/pages:write/id-token:write), push в `main` + `workflow_dispatch`. Проверено: `npm ci`, `npm run build` (sitemap warning исчез, Pagefind 53 файла), 3096 внутренних href в dist резолвятся без битых (включая якоря), preview `curl` 200 под `/gentoo-mydocs/`. Sidebar/UI не менялись; sidebar IA — следующий gate. Live deployment НЕ выполнялся: требует commit/push + успешного Actions run + Settings → Pages → Source: GitHub Actions. Link contract зафиксирован в DOCUMENTATION_POLICY.md §9. |
| 2026-09-25 | Starlight Gate 2 — migration: 11 пользовательских каталогов (installation, desktop, filesystem, hardware, networking, security, managed, settings, troubleshooting, systems, experiments; 51 `.md`) перенесены `git mv` в `src/content/docs/` с сохранением иерархии; folder `README.md` (systems/asus-b5402, experiments/llvm23-toolchain, experiments/elan-fingerprint-04f3-0c77) → `index.md`. Механически: H1 каждого документа перенесён в frontmatter `title` (H1 из body удалён; в двух заголовках снята Markdown-разметка `**`/backticks — текст сохранён), `status: draft` НЕ конвертировался в Starlight `draft: true`. Ссылки: цели README→index внутри tree, входящие ссылки корневого README (37), AGENTS, CHECKPOINT, CONTRIBUTING, policy обновлены на новые пути; внешние ссылки не трогались. DOCUMENTATION_POLICY/CONTRIBUTING адаптированы (src/content/docs как source of truth; `title` — заголовок Starlight-документа, H1 в body не используется для docs вне корня). `archive/` и repository-level корневые `.md` не перенесены. Сайт: filesystem-based autogen sidebar (ручной sidebar — следующий gate); deployment/CI отсутствуют; не production-ready. Известное ограничение: относительные `.md`-ссылки между документами Starlight не резолвятся в маршруты (в собранном HTML href остаётся с `.md`); конвертация в slug-ссылки отложена на следующий gate — сейчас она сломала бы GitHub-навигацию, единственный живой канал чтения. |
| 2026-09-25 | Начат переход документации на Astro Starlight. Gate 1 — infrastructure scaffold: `package.json`/`package-lock.json` (astro 7.3.5, @astrojs/starlight 0.42.4, npm), `astro.config.mjs` (русский root locale без `/ru/`-префикса, без i18n-структуры), `src/content.config.ts` (`docsSchema()` расширен нашей metadata: `kind`/`scope`/`status`/`last_verified`/`verified_on`), временная POC-страница `src/content/docs/index.md`. Проверено: `npm ci` и `npm run build` проходят; `dist/404.html` и `dist/index.html` — русский UI, `lang="ru"`. Существующие пользовательские Markdown не мигрированы и не дублируются; deployment и CI не настроены; сайт не production-ready до следующих gate. |
| 2026-09-22 | Ядро обновлено до `gentoo-kernel-7.2.7` (установлены 7.2.7 и 7.2.6; runtime `7.2.7-bdsm`; загрузка успешная — без заявлений о полном regression-тесте подсистем). Savedconfig: rolling `gentoo-kernel` + версионные 7.2.6/7.2.7, `linux-firmware-20260916`. Production UKI-генератор подтверждён — Dracut (`/etc/kernel/install.conf`: `layout=uki`, `uki_generator=dracut`); `ukify` не входит в generation path. Polkit: runtime-проверка закрыта в части «ровно один агент»; ожидавшийся autostart-юнит в текущей сессии не существует, источник запуска не установлен. Документационный аудит после live-system review: AGENTS/CHECKPOINT/`src/content/docs/systems/asus-b5402/` и корневой README синхронизированы с фактическим состоянием |
| 2026-09-22 | Частичный USE-policy review базовых/system packages (полный аудит `/etc/portage` остаётся 2026-09-14): применены `app-alternatives/gzip` → pigz, `libpcre2 jit`, `openssl ktls` (компилирует поддержку kTLS; фактическое использование — opt-in приложения), `audit io-uring` (поддержка io_uring-правил kernel Audit), `util-linux caps -cramfs`, `pax-utils caps`, `gettext git`, `coreutils caps gmp`, глобальный `verify-provenance` (дополняет `verify-sig`). Архитектурные решения: TPM только для LUKS2 (`tpm2-tss -fapi -policy`, `tpm2-tools -fapi`, `gnupg -tpm`), `lxc landlock` (при сохранении apparmor caps seccomp), `containerd -cri`, docker/podman `-btrfs` при проверенных storage `overlay2`/`overlay` (containerd `-btrfs` — после resolver-проверки), `htop caps -filecaps` (расширенный доступ через `doas htop`), `smartmontools caps`, `chrony -phc -refclock -rtc`, `mesa -vaapi -lm-sensors` (VA-API — отдельный Intel/libva stack), clang-runtime `compiler-rt openmp sanitize` без `-default-*` (GNU runtime ABI сохранён), `openvpn -dco`. Финализация review: GStreamer `orc` (base/good/bad), ffmpeg `pulseaudio`, spice `opus`, imagemagick `lcms tiff`, libheif `-kvazaar`, poppler `cairo`, openjdk-bin `-source`, fwupd `uefi gnutls`, libsecret `-pam -tpm` (по TPM policy), `qtdeclarative jit`, `qtbase io-uring`, `qimgv video exif`, wireshark `http2 http3 sshdump`, Firefox stale `-jumbo-build` override снят (profile форсирует jumbo-build, `pgo` его требует), Noctalia 5.1.0::noctalia-overlay + `jemalloc` установлена, `firefox.md`/`noctalia.md` синхронизированы. Review — COMPLETE; не заменяет полный аудит `/etc/portage` 2026-09-14. Зафиксировано в `src/content/docs/systems/asus-b5402/system/boot-and-portage.md` |
| 2026-09-21 | Полный rebuild установленного `@world` после применения `-O2` + ThinLTO policy завершён успешно; система загрузилась штатно, основные сервисы работают, post-rebuild анализ журналов регрессий, связанных с policy, не выявил (не каждый файл обязан содержать ThinLTO: ebuild'ы могут фильтровать LTO или не использовать C/C++ toolchain). Post-rebuild фиксы владельца: (1) iwd — `ProtectKernelTunables=yes` в drop-in заменён на `no`: блокировал запись `arp_evict_nocarrier`/`ndisc_evict_nocarrier` sysctl, которыми iwd управляет для Wi-Fi roaming, остальной hardening сохранён; (2) polkit — дублирующий ручной запуск `polkit-gnome-authentication-agent-1` убран из Niri autostart, остаётся XDG autostart (один agent на сессию; runtime-проверка после нового перелогина — не выполнена). Наблюдения без исправлений: transient startup-гонка NetworkManager/iwd вокруг P2P-инициализации (`/net/connman/iwd/0`) без подтверждённого runtime-воздействия; polkit-126-r3 логирует отсутствие `/run/polkit-1/rules.d` и `/usr/local/share/polkit-1/rules.d` — benign, workaround не требуется |
| 2026-09-21 | no-LTO exception cleanup `/etc/portage` COMPLETE: 102 локальных `no-lto-llvm` overrides сняты контролируемыми batch'ами с проверкой `emerge --buildpkgonly -1`; `env/no-lto-llvm`, `env/no-ccache`, `package.env/20-compatibility` удалены; docker-cli exception исчез вместе с этими env-файлами; mesa — только `ssd` в `10-performance`; структура: `env/` — `gcc-fallback`, `kernel-llvm`, `p-cores`, `ssd`; `package.env/` — `00-toolchain`, `10-performance`, `30-gcc-fallback`; BFD policy внутри `env/gcc-fallback`. Корректный вывод: overrides больше не нужны (ebuild `filter-lto` / Go-Rust не используют C/C++ flags напрямую), а не «102 пакета доказанно собираются с ThinLTO» |
| 2026-09-20 | O2 policy применена к Portage-конфигурации (`make.conf`, `env/gcc-fallback`, `env/no-lto-llvm`; `portageq` подтверждает `-O2 -flto=thin`; resolver рассчитывается; полный rebuild завершён 2026-09-21). gcc-fallback cleanup: остались `binutils` и `pango` (оба `bfd`). CPU target review: `-march=alderlake` сохранён, `native` отклонён (explicit target воспроизводим и auditable). Java → `openjdk-bin:25` (system VM). Осознанные USE-добавления: charset-normalizer `native-extensions`, libass `libunibreak`, libheif `x265 dav1d gdk-pixbuf`. Выводы Experiment A/B перенесены из `src/content/docs/experiments/llvm23-toolchain/` в системную документацию и общий guide |
| 2026-09-20 | Experiment B закрыт: B4 (mesa 26.2.2, shader-db на Iris Xe, `-fno-lto` по package policy, Clang 23 + LLD 23) — измеримого runtime-преимущества O3 нет (mean ≈ -0.3% при CV O2 ≈ 4%), крупные Mesa ELF ~+5% `.text`, binpkg +5.31%. Optimization policy decision: global `-O2` + selective benchmark-proven `-O3`, ThinLTO остаётся; selective rules не создаются (libde265 weak ~1.2%/+12.3% `.text`, zstd mixed, openssl/mesa без преимущества). Production не менялся; применение политики и LLVM 23 rollout — NOT STARTED |
| 2026-09-20 | Эксперимент LLVM 23 (`src/content/docs/experiments/llvm23-toolchain/`): фаза A (совместимость Clang/LLD 23 при сохранении GNU-рантайма) завершена — A1–A4 PASS (libde265, libunistring, mesa_clc, mesa через `--buildpkgonly`). Experiment B (-O2 vs -O3) в работе: B1 (libde265) — O3 ~1.2% быстрее, `.text` ~12.3% больше; B2 (zstd 1.5.7-r1) — смешанный результат: compression ~1–2% быстрее, decompression ~1–2% медленнее, `libzstd` `.text` ~9.2% больше; B3 (openssl 3.5.8, crypto, без LTO по политике ebuild) — преимущества O3 нет (AES ≈ ничья, SHA ~-0.5%, ChaCha20 ~-1%), `libcrypto` `.text` +2.6%. Каноническая методика бенчмарков зафиксирована (`benchmark-methodology.md`). Глобальное решение O2/O3 открыто. Production-политика не менялась: Clang/LLD 22, `-O3` + ThinLTO. Rollout `env/llvm-23` осознанно отложен до завершения Experiment B. Финальный review B1–B3 (2026-09-20): документы синхронизированы (исправлены устаревшие статусы в README «Цели» и optimization-o2-o3.md), evidence консолидировано в `results.md`; решение по optimization policy — за владельцем, optional B4 не запускался |
| 2026-09-14 | Диагностика журнала живой системы: ядро 7.2.5 пересобрано (`RT_GROUP_SCHED_DEFAULT_DISABLED=y` → rtkit realtime; `BT_HIDP=m` + `uinput` в modules-load), `audit_backlog_limit=8192` в cmdline UKI — шум rtkit/kauditd/bluetoothd закрыт. TPM2-токен LUKS перезачислен (PCR 7): автозаблокировка реально проверена; ломалась эпизодически (март/апрель) и 2026-09-14 после смены cmdline. Мир обновлён: `libpcap-1.10.7`, `wayland-1.25.0` + `wayland-scanner`. Решение: остаёмся на PCR 7, ukify отклонён |
| 2026-09-14 | `/etc/portage` закрыт аудитами и реорганизован: `package.env`/`env` 221→117 правил, env 11→8 файлов (no-op `lld`, сироты, мёртвые атомы); keywords — 10 доменных файлов, 104 правила (дубли, мёртвые, no-op stable-пины сняты); license и savedconfig почищены; resolver-эталон 0 пакетов. Исправлены две ошибки категории в аудите: xwayland-satellite (gui-apps, установлен), packer (dev-util, установлен — keyword/license/world восстановлены) |
| 2026-09-13 | USE-серия (батчи 1–9) закрыта: NM `-modemmanager -ppp -bluetooth`, qemu только x86_64, libvirt `virtiofsd`, глобальный USE без мёртвых флагов; руководства синхронизированы (base-system, firefox, networkmanager-iwd, systemd-uki-setup); `dracut-cpio` включён владельцем; рабочие аудиты перенесены в `.history/` |
| 2026-09-12 | Политика `make.conf` подтверждена; 7 USE-флагов без потребителей удалены; `video_cards_i915` и `llvm_slot_*` сняты; world к одной записи noctalia; ccache оставлен с замером через 4–8 недель |
| 2026-09-11 | Аудит `make.conf`: невалидный `iris` и no-op `GOFLAGS` удалены |
| 2026-09-10 | Baseline-аудит системы; загрузочная цепочка (UKI, Secure Boot, TPM2) проверена; `lsm=` вместо `security=apparmor` |
| 2026-09-09 | Структурная миграция репо; политика/CONTRIBUTING/инвентаризация; Noctalia → `::guru`; BIOS 313→314 |
| 2026-08-01 | Ребилд `@world` с PGO успешен (GCC-PGO: bash/binutils; clang-PGO: xz-utils/python) |
| 2026-07-19…31 | Кандидат очистки `/etc/portage` на LLVM 22 применён; вскрыт PATH-дрейф bare `clang` |
| 2026-06-13/14 | Первый аудит дрейфа (файл утрачен); созданы `AGENTS.md` и `CHECKPOINT.md` |

---

*Обновляй после каждой сессии синхронизации или крупных изменений.*
