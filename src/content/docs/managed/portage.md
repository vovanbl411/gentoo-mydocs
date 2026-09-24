---
title: "Portage: управление пакетами Gentoo"
kind: guide
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

Как ставить пакеты, обновлять систему и поддерживать её в порядке через
Portage (`emerge`). Конфигурация toolchain и `make.conf` разобраны в
[базовой системе](../installation/base-system.md); записанная package
policy эталонной машины — в
[её системном разделе](../systems/asus-b5402/system/boot-and-portage.md).

## Quick workflow

Ежедневный цикл обслуживания:

```text
Sync repositories
→ read Gentoo news
→ preview/update @world
→ merge config updates
→ preview depclean
→ depclean if expected
→ preserved rebuild if Portage requires it
```

```bash
doas emerge --sync                  # синхронизировать репозитории
eselect news list                   # новости Gentoo: список
eselect news read                   # прочитать новые

doas emerge --ask --verbose --update --deep --changed-use @world

doas dispatch-conf                  # слить обновления конфигов

doas emerge --pretend --depclean    # кандидаты на удаление
doas emerge --ask --depclean        # удалить, если список ожидаем
```

Если после обновления Portage сообщает о `@preserved-rebuild`:

```bash
doas emerge --ask @preserved-rebuild
```

News стоит читать всегда, а перед крупными profile/toolchain-миграциями —
обязательно: там публикуют плановые изменения и требуемые действия.

## Installing and searching packages

Основная команда установки:

```bash
doas emerge --ask --verbose category/package
```

- `--ask` — показать план и спросить подтверждение перед действиями;
- `--verbose` — подробный план: USE-флаги, репозиторий, размеры;
- `--pretend` — только показать план, ничего не выполнять.

Для разовой сборки без попадания в `@world` есть `--oneshot` (`-1`).

Поиск — встроенный в Portage:

```bash
emerge --search keyword     # по имени пакета (поддерживает regex через %)
emerge --searchdesc keyword # шире: ещё и по описаниям
```

`eix` (`app-portage/eix`) — опциональный быстрый индексированный поиск по
дереву; удобен при частых поисках:

```bash
eix keyword                 # быстрый поиск по имени
eix -S keyword              # по описанию
eix -I                      # только установленные
doas eix-update             # перестроить индекс после sync
```

В eix есть и `eix-test-obsolete` — поиск пакетов, которых больше нет в
дереве.

## Updating the system

### Что такое @world

- `@selected` — явно выбранные пакеты и sets (`selected-packages` +
  `selected-sets`); сюда попадает всё, что ставилось без `--oneshot`;
- `@system` и `@profile` — наборы, задаваемые профилем;
- `@world` — охватывает `@selected`, `@system` и `@profile`.

Сами по себе sets не «включают все зависимости»: полный граф для операции
строит resolver — в него попадают пакеты, необходимые для установки
целевых.

### Команда обновления

```bash
doas emerge --ask --verbose --update --deep --changed-use @world
```

- `--update` — обновлять установленные пакеты до доступных версий;
- `--deep` — resolver рассматривает зависимости всей цепочки, а не только
  первый уровень от целевых пакетов;
- `@world` — цель обновления.

Полезные дополнения: `--keep-going` — продолжать после ошибки в отдельном
пакете; `--jobs N` / `--load-average` — параллельная сборка нескольких
пакетов (см. также [OOM при сборке](#oom-при-сборке)).

Portage обновляется как обычный пакет (`sys-apps/portage`); при крупных
обновлениях resolver сам предложит собрать его первым.

### `--changed-use` vs `--newuse`

- `--changed-use` (`-U`) — пересборка, когда фактическое значение
  используемого USE-флага изменилось;
- `--newuse` (`-N`) — шире: реагирует и на изменения состава IUSE,
  включая появление и исчезновение выключенных флагов, в том числе от
  профиля.

Для регулярного обновления `--changed-use` обычно менее шумный — меньше
пересборок из-за флагов, которые всё равно выключены. Это не единственно
правильный выбор: `--newuse` нужен, когда важно отреагировать и на
изменения самого набора флагов.

### Обновления конфигурационных файлов

Обновления не перезаписывают защищённые конфиги, а кладут рядом
`._cfg0000_*`. Слить изменения — отдельный шаг после обновления пакетов:

```bash
doas dispatch-conf
```

- `dispatch-conf` — интерактивное слияние;
- `etc-update` — более простой интерфейс;
- `conf-update` (`app-portage/conf-update`) — альтернатива, если пакет
  доступен.

Инструмент — дело привычки; важно не оставлять `._cfg`-файлы несмотренными
после крупных обновлений.

### Preserved rebuild

Portage сохраняет старые версии библиотек (preserve-libs), пока зависимые
от них пакеты не пересобраны, поэтому обновление библиотеки не ломает
ELF-потребителей мгновенно. Если Portage сообщает о необходимости
`@preserved-rebuild`:

```bash
doas emerge --ask @preserved-rebuild
```

`revdep-rebuild` (`app-portage/gentoolkit`) — дополнительная диагностика
битых ELF/shared-library зависимостей, а не обязательный шаг после
каждого обновления.

## USE policy

USE-флаги определяют, с какой поддержкой собирается пакет.

Небольшая глобальная policy — в `/etc/portage/make.conf`:

```bash
USE="ssl -telemetry"
```

Точечная — в `/etc/portage/package.use/`:

```text
# /etc/portage/package.use/10-desktop
category/package flag -otherflag
```

Package-specific записи перекрывают глобальный `USE`: точечная policy
главнее общей.

Посмотреть фактические флаги пакета и текущий глобальный набор:

```bash
emerge --pretend --verbose category/package
equery uses category/package
portageq envvar USE
```

Testing-версия одного пакета — через `package.accept_keywords`, а не
глобальный `ACCEPT_KEYWORDS="~amd64"` в `make.conf`:

```text
# /etc/portage/package.accept_keywords/testing
category/package ~amd64
```

## USE changes и сообщения resolver

Это две разные ситуации.

### USE уже изменён в конфигурации

`--changed-use` / `--newuse` заставляют resolver пересчитать граф и
пересобрать пакеты, у которых изменились фактические флаги:

```bash
doas emerge --ask --verbose --changed-use @world
```

### Resolver сообщает о необходимых USE changes

Сообщение «The following USE changes are necessary» — не просьба
«перезапустить с `-N`»: resolver перечисляет конкретные изменения, без
которых граф не собирается. Что делать:

1. прочитать, какие именно флаги и для каких пакетов предложены;
2. понять причину: новая версия, изменившиеся зависимости, профиль;
3. осознанно изменить `package.use` или связанную policy.

Autounmask — отдельный инструмент: Portage сам предлагает изменения и
после подтверждения записывает их в policy-файлы. Предложения просматривайте
до подтверждения — они становятся частью вашей конфигурации.

## Removing packages and depclean

```bash
doas emerge --deselect category/package   # снять явный выбор
doas emerge --pretend --depclean          # посмотреть, что уйдёт
doas emerge --ask --depclean              # выполнить очистку
```

- `--deselect` — убирает пакет из `@selected`; пакет и его зависимости
  становятся кандидатами на очистку;
- `--depclean` — dependency-aware очистка: удаляет только то, что больше
  недостижимо из `@world`;
- `emerge --depclean category/package` (`-c`) — dependency-aware удаление
  конкретного пакета: не «абсолютно безопасное», но Portage не удалит
  пакет, от которого зависят другие;
- `--unmerge` (`-C`) — принудительное удаление без dependency-проверок;
  аварийная опция, может оставить систему неработоспособной.

Перед depclean приведите `@world` в согласованное состояние (без случайных
пакетов в `@selected`) и просмотрите весь список удаления.

## Dependency problems

Короткая справка по переменным зависимостей ebuild:

- `BDEPEND` — зависимости сборки на хосте;
- `DEPEND` — зависимости сборки цели;
- `RDEPEND` — время выполнения;
- `PDEPEND` — ставятся после основного пакета;
- `IDEPEND` — ставятся во время установки пакета.

Resolver обрабатывает их автоматически; пользователю они нужны в основном
при разборе конфликтов.

### Blockers

Blocker значит, что два пакета не могут сосуществовать. Прежде чем что-то
предпринимать, поймите блок:

- какая пара конфликтует: SLOT/версия, файлы, USE/dependency requirement;
- нет ли это package move/replacement — пакет переименован или заменён, и
  обновление должно уйти на замену;
- актуально ли состояние репозитория и профиля (`emerge --sync`, news).

Часто блок снимается обновлением обеих сторон конфликта или переходом на
замену. `package.mask` — осознанный policy-выбор, а не универсальный
способ закрыть блокер. Если resolver обрывает поиск, помогает более
глубокий `--backtrack=N` (по умолчанию 20).

### Circular dependencies

Циклическая зависимость — resolver не может выбрать порядок сборки.

1. Прочитать circular dependency report: какие пакеты замыкают цикл.
2. Посмотреть предлагаемые Portage USE changes — часто цикл разрывается
   флагом.
3. Проверить свой `package.use`: локальные ограничения сами нередко
   создают цикл.
4. Увеличить `--backtrack` для более глубокого поиска.
5. Временно менять USE только если понятно, какой dependency edge
   разрывается, и вернуть изменение после.

> ⚠️ `--nodeps` — не способ решения цикла: он пропускает dependency graph,
> сборка может не пройти, а система — остаться несогласованной. Это
> аварийная опция для особых случаев, не часть обычного workflow.

## Repositories / overlays

Оверлеи — дополнительные ebuild-репозитории. Записями в
`/etc/portage/repos.conf` управляет `eselect repository`
(`app-eselect/eselect-repository`; исторический инструмент — layman):

```bash
eselect repository list              # доступные оверлеи
doas eselect repository enable guru  # включить
doas emerge --sync guru              # синхронизировать конкретный
doas emerge --sync                   # или все
```

Свой git-репозиторий:

```bash
doas eselect repository add <name> git <url>
```

После синхронизации пакеты оверлея доступны как обычные.

## Inspecting packages

```bash
emerge --pretend --verbose category/package   # план установки + USE
portageq envvar USE                            # глобальный USE
```

`equery` (`app-portage/gentoolkit`) — короткий набор полезных команд:

| Команда | Что делает |
|---------|------------|
| `equery list <pkg>` | установленные версии пакета |
| `equery files <pkg>` | файлы пакета |
| `equery belongs <file>` | какой пакет владеет файлом |
| `equery depends <pkg>` | кто зависит от пакета |
| `equery depgraph <pkg>` | граф зависимостей |
| `equery uses <pkg>` | USE-флаги и их состояние |
| `equery check <pkg>` | проверка целостности установки |

`eix` — быстрый индексированный поиск (см. раздел установки и поиска).

## Cleaning caches

Скачанные исходники лежат в `/var/cache/distfiles`
(`/usr/portage/distfiles` — исторический путь), локальные бинарные пакеты —
в `/var/cache/binpkgs` (`PKGDIR`).

Очистка устаревшего (`app-portage/gentoolkit`), сначала с превью:

```bash
eclean --pretend distfiles    # что будет удалено
eclean distfiles              # устаревшие исходники
eclean --pretend packages
eclean packages               # устаревшие бинарные пакеты
```

Не чистите package cache вслепую: старые binpkg могут понадобиться для
отката.

## Security: GLSA

Gentoo публикует уведомления о безопасности (GLSA). Проверка —
`glsa-check` (`app-portage/gentoolkit`):

```bash
glsa-check --test all          # какие GLSA затрагивают систему
glsa-check --list affected     # список затрагивающих
glsa-check --pretend affected  # какие шаги нужны для исправления
```

Применение изменений — отдельная операция (`--fix`, экспериментальная
опция): только после просмотра `--pretend`. Актуальные флаги —
`glsa-check --help` и man-страница.

## Advanced features

### binpkgs / binhost

Portage умеет собирать и переиспользовать бинарные пакеты:
`FEATURES="buildpkg"`, `--usepkg`, binhost через `PORTAGE_BINHOST`.
Подробнее — [Gentoo Wiki: Binary package
guide](https://wiki.gentoo.org/wiki/Binary_package_guide).

### ccache

Ускоряет повторные сборки, кэшируя результаты компиляции. Включается
`FEATURES="ccache"` в `make.conf`; подробная настройка — в
[базовой системе](../installation/base-system.md).

### distcc

Распределённая сборка на нескольких машинах: `sys-devel/distcc`,
`FEATURES="distcc"`, `MAKEOPTS` под суммарное число потоков. Требует
настройки `distccd` на хелперах — см.
[Gentoo Wiki: Distcc](https://wiki.gentoo.org/wiki/Distcc).

### Build-time dependencies: `--with-bdeps`

Build-time зависимости Portage учитывает автоматически: для обычных
установок `--with-bdeps` включён по умолчанию, а `--depclean` по умолчанию
не удаляет build-зависимости. Отдельные нюансы — у workflow с бинарными
пакетами (`--usepkg`), там поведение меняется; детали — в `emerge(1)`.
Ручное `--with-bdeps=y` при каждой установке не нужно.

## Kernel packages

Ядро в Gentoo — обычные пакеты Portage:

- `sys-kernel/gentoo-kernel` — dist-kernel, который собирает ebuild;
  конфигурацию можно кастомизировать, в том числе через `savedconfig`;
- `sys-kernel/gentoo-sources` — только исходники; сборка и установка
  вручную.

USE и конфигурация ядерных пакетов управляются стандартными механизмами
Portage (`package.use`, `savedconfig`). Установка образа, initramfs и
загрузчика — зона `sys-kernel/installkernel` + Dracut: схема UKI, подписи и
systemd-boot разобрана в [systemd-uki-setup](../installation/systemd-uki-setup.md).
Здесь руководство по сборке ядра не повторяется.

Автозагрузка модулей ядра под systemd — файлы `/etc/modules-load.d/*.conf`.
В OpenRC механизм свой (`/etc/conf.d/modules`) и к systemd не относится.

## Troubleshooting

### «blocked packages»

См. [Blockers](#blockers): сначала понять пару и причину, затем обновлять
или менять policy. Более глубокий `--backtrack` помогает, если resolver
обрывает поиск.

### OOM при сборке

Разные уровни параллелизма:

- `--jobs N` у emerge — сколько пакетов собирается параллельно;
- `MAKEOPTS="-jN"` — параллелизм build system внутри одного пакета.

Если память кончается при сборке одного тяжёлого пакета, обычно снижают
`MAKEOPTS` для него через `package.env` / env-файл (пример env-политики —
[системный раздел эталонной
машины](../systems/asus-b5402/system/boot-and-portage.md)). Если параллельно
идут несколько пакетов, дополнительно снижают Portage `--jobs`.

### Система сломалась после обновления

Загрузитесь с live-носителя, смонтируйте разделы и войдите в chroot.
Дальнейшее зависит от причины сбоя: незавершённую merge list можно
продолжить через `emerge --resume`, проблемный пакет — переустановить
отдельно, либо заново рассчитать обычное `@world`-обновление. Единой
repair-команды нет: сначала разберитесь, что именно сломалось.

## Related docs

- [Базовая настройка системы: make.conf, USE, ccache](../installation/base-system.md)
- [Ядро и загрузка: UKI через Dracut](../installation/systemd-uki-setup.md)
- [Package policy эталонной машины asus-b5402](../systems/asus-b5402/system/boot-and-portage.md)
- [Gentoo Wiki: Portage](https://wiki.gentoo.org/wiki/Portage)
- [`emerge(1)`](https://dev.gentoo.org/~zmedico/portage/doc/man/emerge.1.html)
