# CHECKPOINT.md — Текущее состояние проекта

> Файл состояния для ассистентов и автора: что сделано, что синхронизировано,
> что требует внимания.

---

## Метаданные

| Параметр | Значение |
|----------|----------|
| Дата последнего аудита | 2026-09-22 — live-system review (ядро, boot/UKI, graphics, polkit); `/etc/portage` целиком — 2026-09-14; baseline системы — 2026-09-10 |
| Ветка | `main` |
| Рабочее дерево | Starlight adaptation: Gate 2 (migration в `src/content/docs/`) выполнен 2026-09-25; sidebar IA и deployment — следующие gate |
| Система | Gentoo, ядро `7.2.7-bdsm`, BIOS `B5402CBA.314`, systemd-boot + UKI, Secure Boot + TPM2 (авторазблокировка LUKS реально проверена 2026-09-14) |
| Аппаратура | ASUS ExpertBook B5402, i7-1260P (Alder Lake) |

---

## Состояние системы

- **Профиль**: `default/linux/amd64/23.0/no-multilib/hardened/systemd`.
- **Toolchain**: Clang/LLD 22 основной (`-O2` с 2026-09-20, ThinLTO, PGO);
  LLVM 23.1.1 — им намеренно собирается ядро (env `kernel-llvm`, пилот);
  слоты 21/24 удалены; `rust-bin-1.97.1`; BOLT отложен.
- **make.conf** (политика 2026-09-20): `-O2`/ThinLTO с исключениями
  `package.env`, явный `-mno-*`, `MAKEOPTS="-j14 -l10"`, ccache глобально.
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
- ccache: замер hit rate — окно середина октября…начало ноября 2026
  (`--zero-stats` от 2026-09-12).
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
