# AGENTS.md — Памятка для ассистентов

> Файл для ассистентов (агентов), работающих с репозиторием `gentoo-mydocs`.
> Здесь собраны соглашения, опасности и контекст, которые нужны для качественной помощи.

---

## 1. Что это за проект

**`gentoo-mydocs`** — практическая документация по Gentoo Linux, основанная
на эксплуатации ASUS ExpertBook B5402 (Intel Core i7-1260P, Alder Lake).

- Язык: **русский** (технические термины часто на английском).
- Формат: Markdown; источником правды остаются существующие `.md`-каталоги.
  Для сайта добавлена минимальная инфраструктура Astro Starlight
  (`npm run build` из `src/content/docs/`); CI и deployment отсутствуют.
- Цель: публиковать повторяемые руководства и отдельно вести состояние
  эталонной системы.
- Аудитория: пользователи, уже знакомые с Gentoo/Linux, и автор репозитория.

Контракт структуры и метаданных находится в `DOCUMENTATION_POLICY.md`, а
порядок подготовки изменений — в `CONTRIBUTING.md`. Не дублируй эти правила в
новых служебных разделах.

### Последнее записанное состояние эталонной системы

Это контекст для навигации, а не актуальный аудит. Перед изменением
пользовательской документации факты нужно подтвердить заново.

- **Pure Wayland** — Niri, без X11.
- **LLVM/LTO** — Clang 22 (основной), глобально `-O2` + Thin LTO. Установлены слоты 22 (основной) и 23 (им намеренно собирается ядро, env `kernel-llvm`); слоты 21/24 удалены. BOLT отключён до стабильного релиза LLVM 23.
- **Hardened/systemd** — профиль `default/linux/amd64/23.0/no-multilib/hardened/systemd`.
- **Безопасность** — Secure Boot + TPM 2.0 + LUKS2 + AppArmor + Auditd + USBGuard + doas.
- **Btrfs + Snapper** — flat layout субволюмов.
- **systemd-boot + UKI** — генератор — Dracut (`uki_generator=dracut`);
  `ukify` в production path не используется.

---

## 2. Структура репозитория

```text
.
├── README.md                 # Главная страница и навигация
├── DOCUMENTATION_POLICY.md   # Контракт структуры и метаданных
├── CONTRIBUTING.md           # Правила подготовки изменений
├── DOCUMENTATION_INVENTORY.md # Инвентаризация перед реструктуризацией
├── AGENTS.md                 # Этот файл
├── CHECKPOINT.md             # Текущее состояние и план работ
├── .markdownlint.json        # Конфиг markdownlint, но он в .gitignore
├── .gitignore                # Игнорирует .history, .kilocodemodes, .markdownlint.json,
│                             # node_modules/, dist/, .astro/
│
├── package.json              # npm-скрипты и зависимости сайта (Astro Starlight)
├── package-lock.json         # Зафиксированные версии зависимостей
├── astro.config.mjs          # Конфиг Astro + Starlight; русский root locale
├── src/
│   ├── content.config.ts     # Схема docs-коллекции: docsSchema() + наша metadata
│   └── content/
│       └── docs/
│           └── index.md      # Временная POC-страница (Gate 1), не навигация сайта
│
├── installation/             # Установка и загрузка
│   ├── base-system.md        # make.conf, toolchain, USE-флаги
│   ├── systemd-uki-setup.md  # Ядро, Dracut, UKI, systemd-boot
│   └── secure-boot-tpm.md    # sbctl, Secure Boot, TPM2 + LUKS2
│
├── desktop/                  # Рабочее окружение
│   ├── default-applications.md
│   ├── niri.md               # Конфиг Niri (KDL), greetd/tuigreet
│   ├── noctalia-shell.md     # Noctalia v5 для Niri
│   └── wayland-portals.md    # XDG Desktop Portals
│
├── filesystem/               # Файловая система
│   ├── btrfs-setup.md        # Btrfs layout, mount options, CoW
│   └── snapper-backups.md    # Snapper: конфиги, хуки, таймеры
│
├── hardware/                 # Железо
│   └── intel-graphics.md     # Общее руководство Intel Xe / i915
│
├── networking/               # Сеть
│   ├── networkmanager-iwd.md # NetworkManager + iwd
│   ├── nftables-firewall.md  # Базовый desktop firewall
│   └── wireless-regulatory.md# Регуляторный домен Wi-Fi
│
├── security/                 # Безопасность
│   ├── app-armor.md
│   ├── auditd.md
│   ├── doas-configuration.md
│   ├── kernel-hardening.md
│   └── usbguard.md
│
├── managed/                  # Управление пакетами
│   └── portage.md            # Большое руководство по Portage
│
├── settings/                 # Прикладные настройки
│   ├── firefox.md
│   ├── perplexity.md         # Интеграция Perplexity AppImage
│   ├── flatpak.md
│   ├── gtk.md
│   ├── obs-studio.md
│   └── r2modman.md
│
├── experiments/              # Незавершённые исследования и проверки
│   ├── llvm23-toolchain/
│   └── elan-fingerprint-04f3-0c77/
│
├── systems/                  # Состояние эталонных систем
│   └── asus-b5402/
│       ├── README.md
│       ├── applications.md
│       ├── desktop/
│       ├── filesystem/
│       ├── hardware/
│       ├── networking/
│       ├── security/
│       └── system/
│
├── troubleshooting/          # Повторяемые решения проблем
│   ├── android-usb-mtp.md
│   ├── docker-29-iptables-missing.md
│   ├── docker-libvirt-nftables.md
│   ├── luks-tpm2-unlock-after-uki-rebuild.md
│   └── networkmanager-iwd-mac-randomization.md
│
├── archive/                  # Исторические материалы, не для применения
│
├── .codex/                   # Служебный контекст для агентов
│   ├── project-context.md
│   ├── actual-system.md
│   └── extracted-docs.md
│
├── .history/                 # Ручное версионирование документов
└── screenshots/              # Скриншоты только для README.md
```

---

## 3. Стилевые соглашения

Авторитетные правила публикации, frontmatter и разделения scope описаны в
`DOCUMENTATION_POLICY.md` и `CONTRIBUTING.md`. Ниже остаются только краткие
соглашения, нужные агенту во время правки.

### Human-first

Пользовательские документы пишутся human-first: сначала основной ответ /
current state, затем детали, history и verification. Перед существенной
правкой перечитай соответствующий раздел `DOCUMENTATION_POLICY.md`.

Три проверки перед сдачей правки:

- current state раньше history;
- evidence сохраняется, но не заслоняет основной текст;
- краткий summary не теряет технические различия.

### Язык и тон

- **Язык**: русский.
- **Тон**: личный, инструктивный, иногда разговорный; обращение «ты» допустимо.
- Пиши так, как будто объясняешь себе — кратко, по делу, без маркетинговой воды.

### Структура документа

- **H1** — название темы.
- **H2** — крупные разделы, часто с номерами (`## 1. Установка`).
- **H3** — подразделы.
- Большие документы могут начинаться с **оглавления**.
- Используй **таблицы** для сравнений, опций, USE-флагов, команд.
- Перед конфигом указывай путь: `Файл: /etc/portage/make.conf`.

### Форматирование

- Блоки кода с языком: `bash`, `makefile`, `conf`, `ini`, `toml`, `kdl`, `nft`, `css`, `apparmor`, `c`.
- Команды с привилегиями: преимущественно `doas` (система настроена на doas).
- Исключения возможны, но должны быть явно обоснованы.
- Пути к файлам указывай явно.

### Callouts (выделения)

- `> **Примечание**: ...`
- `> **Важно**: ...`
- `> ⚠️ **Важный нюанс**: ...`

### Соглашения по содержанию

- **USE-флаги**: списком с обратным слэшем переноса строк.
- **Пакеты Gentoo**: в формате `category/package`.
- **Версии/слоты**: указывай актуальные (`LLVM 22`, `llvm_slot_22`). Установлены слоты 22 (основной) и 23 (ядро, пилот); слоты 21/24 удалены.
- **Скриншоты**: только в `README.md`.
- **Ссылки**: внешние — на Gentoo Wiki, GitHub, официальную документацию; внутренние — из `README.md`.

### Повторяющиеся шаблоны

- «Файл: `<path>`» перед конфигом.
- Раздел «Основные команды» в виде таблицы.
- Чек-листы в конце инструкций.
- «Шпаргалка» для быстрых команд.
- Блок «Environment» в конце сложных гайдов.

---

## 4. Рабочий процесс

### Перед изменениями

```bash
git status --short --branch
```

### Что полезно проверить

```bash
# Список всех markdown-файлов
find . -path './.git' -prune -o -name '*.md' -type f -print

# Поиск TODO/FIXME/черновиков
rg -n "TODO|FIXME|WIP|чернов|draft|TBD|устар|deprecated|XXX" -S . --glob '!/.git/**'
```

### Использование sub-агентов

Для широкого анализа, аудита, проверки связей между файлами — используй sub-агентов (`explore`).
Критический путь (ключевые конфиги, безопасность, загрузка) проверяй самостоятельно.

### Коммиты

- Сохраняй текущий стиль сообщений: `add:`, `update:`, `change:`, `fix:`.
- Делай маленькие атомарные коммиты по темам.

---

## 5. Важные предостережения

### Не запускай команды из документации как тесты

Многие сниппеты нацелены на живую систему и содержат деструктивные или привилегированные команды:

```text
doas
emerge
systemctl
nft
mount
dracut
sbctl
systemd-cryptenroll
```

### Особенно опасные операции

- `sbctl enroll-keys -m` — перезапись ключей UEFI.
- `systemd-cryptenroll --tpm2-device=auto ...` — изменение LUKS.
- `doas btrfs scrub start /` — долгая операция на живой ФС.
- Пересборка мира с изменением линкера (`mold` ↔ `lld`).

Для рискованных гайдов добавляй:

- applicability (когда применимо);
- prerequisites (что нужно сделать до);
- exact config paths;
- verification commands;
- rollback path;
- risk notes;
- references.

### Дрейф документации

Главная проблема проекта — расхождение между документами и реальной системой.
Прежний аудит `troubleshooting/system-vs-docs-drift-2026-06-13.md` отсутствует
и признан устаревшим источником. Не используй утверждения из старого handoff
как подтверждение: состояние системы нужно проверять заново и датировать по
`DOCUMENTATION_POLICY.md`.

---

## 6. Известные проблемы и нерешённые вопросы

- `settings/obs-studio.md` требует технической проверки; состояние установки
  вынесено в системный раздел.
- `.gitignore`, `.kilocodemodes`, `.markdownlint.json` имеют executable bit.
- `.markdownlint.json` игнорируется `.gitignore`.
- Автоматических проверок в CI нет. Локальный `npm run build` (Astro Starlight)
  собирает сайт из `src/content/docs/` и не валидирует Markdown в остальных
  каталогах репозитория.

Подробности и план — в `CHECKPOINT.md`.

---

## 7. Контакты и быстрые ссылки

- Конфиги управляются через `chezmoi`: [vovanbl411/dotfiles](https://github.com/vovanbl411/dotfiles)
- Быстрые ссылки: см. `README.md` → «Быстрые ссылки»

---

*Обновляй этот файл, если меняешь структуру проекта, стиль или ключевые соглашения.*
