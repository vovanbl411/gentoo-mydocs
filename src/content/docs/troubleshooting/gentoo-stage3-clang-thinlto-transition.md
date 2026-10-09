---
title: "Переход stage3 → Clang/ThinLTO: bootstrap cycles и stale toolchain metadata"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-10-09"
verified_on: [gentoo-builder-01]
---

При первой пересборке GCC-based stage3 под Clang + ThinLTO + LLD возможны
циклические зависимости и вызовы старого compiler из metadata уже
установленных пакетов. Для наблюдавшихся USE cycles помогло временно
отключить один флаг, установить bootstrap closure, удалить override
и повторить пересборку под полной target policy. Для Perl XS потребовалась
пересборка самого Perl под Clang. Для kernel helper preparation потребовалось
package-specific исключение из ThinLTO, описанное отдельно ниже.

## Когда применять

Решения ниже применимы при совпадении симптома во время первичного перехода
stage3 на production toolchain. Они проверены владельцем на
[gentoo-builder-01](../../systems/gentoo-builder-01/) в installer/chroot
2026-10-09. Это не список обязательных исключений для каждой Gentoo-системы.

До исправления проверь profile, compiler/linker policy и вывод resolver.
Сохрани изменяемую Portage-конфигурацию. Временный USE override добавляй
только для наблюдаемого цикла; после bootstrap удали именно свою запись
и верни target USE. Постоянное исключение меняет итоговую package policy.

Ниже команды выполняются от root внутри installer chroot, поэтому `doas`
не требуется. Пути временных override в примерах — предложенное место для
повторения процедуры, а не подтверждённые имена файлов исходной VM.

## 1. Self-cycle вокруг `pypi-attestations` при `verify-provenance`

**Симптом:** global `verify-provenance` на чистом builder вызывает self-cycle
вокруг `dev-python/pypi-attestations`. Portage предлагает временно отключить
`verify-provenance`.

**Причина:** проверка provenance требует пакета, который ещё предстоит
установить в bootstrap environment.

**Исправление:** временно отключить `verify-provenance` через `package.use`.
Пример записи в `/etc/portage/package.use/bootstrap-transition`:

```text
*/* -verify-provenance
```

Установить `dev-python/pypi-attestations`, затем удалить override.
Финальная global target policy снова действует без временного исключения.

**Проверка:** с восстановленным `verify-provenance` resolver больше
не сообщает self-cycle, а полная пересборка завершается успешно.
Постоянный `-verify-provenance` не является частью решения.

## 2. Цикл `libcap-ng[bpf]` ↔ `audit`

**Симптом:** Portage сообщает circular dependency:

```text
sys-libs/libcap-ng[bpf]
  -> sys-process/audit
  -> sys-libs/libcap-ng
```

**Причина:** включённый `bpf` замыкает bootstrap dependency cycle между
`sys-libs/libcap-ng` и `sys-process/audit`.

**Исправление:** временно отключить `bpf` только у `libcap-ng`.
Пример записи в `/etc/portage/package.use/bootstrap-transition`:

```text
sys-libs/libcap-ng -bpf
```

Установить `sys-libs/libcap-ng` и `sys-process/audit`, удалить временную
запись и вернуть финальный `bpf` перед полной пересборкой.

**Проверка:** resolver с возвращённым `bpf` проходит без этого цикла;
финальная конвергенция на builder завершилась успешно.

> **Важно:** source build `libcap-ng[bpf]` требует подходящего BTF/kernel
> environment. Успешная конвергенция в installer chroot не заменяет
> отдельную проверку этого условия после first boot; такая проверка
> на builder пока не подтверждена.

## 3. `docutils` → `pillow` → `harfbuzz` → `glib` → `docutils`

**Симптом:** circular dependency при сборке bootstrap closure:

```text
dev-python/docutils
 -> dev-python/pillow[truetype]
 -> media-libs/harfbuzz
 -> dev-libs/glib
 -> dev-python/docutils
```

**Причина:** зависимость `pillow[truetype]` включает цепочку, возвращающуюся
к ещё не установленному `docutils`.

**Исправление:** временная запись в
`/etc/portage/package.use/bootstrap-transition`:

```text
dev-python/pillow -truetype
```

Установить `dev-python/docutils` и bootstrap closure, удалить override,
вернуть `truetype`, затем повторить полную пересборку.

**Проверка:** после возвращения `truetype` resolver и сборка проходят;
последующая финальная конвергенция на builder завершилась успешно.
Постоянный `-truetype` не требуется.

## 4. `libidn2`: символ есть, symbol-version metadata не согласована

**Симптом:** линковка `sys-devel/binutils-2.47` завершается ошибкой:

```text
/usr/lib64/libpsl.so.5: undefined reference to `idn2_lookup_u8@IDN2_0.0.0'
```

**Причина по диагностике:** во время большой первичной пересборки
установленная `libidn2` имела несогласованную symbol-version metadata.
Это наблюдение не устанавливает универсальный баг LLVM или `binutils`.

Были установлены `net-dns/libidn2-2.3.8` и `net-libs/libpsl-0.21.5`.
`libpsl.so.5` зависела от `libidn2.so.0`; `idn2_lookup_u8` физически
присутствовал. При этом loader сообщал:

```text
/usr/lib64/libidn2.so.0: no version information available
```

**Исправление:** переустановить `net-dns/libidn2`, затем повторить сборку
`sys-devel/binutils`:

```bash
emerge --ask --oneshot net-dns/libidn2
emerge --ask --oneshot sys-devel/binutils
```

**Проверка:** после переустановки `libidn2` сборка `binutils` на builder
успешно завершилась. Само наличие символа до исправления было недостаточной
проверкой: ошибка относилась к его версии.

## 5. Perl XS вызывает GCC из stage3 с `-flto=thin`

**Симптом:** native library `sys-libs/libapparmor-4.0.3` успешно собирается
через Clang + ThinLTO + LLD, но Perl SWIG/XS binding вызывает старый compiler:

```text
x86_64-pc-linux-gnu-gcc ... -flto=thin
```

```text
cc1: error: unrecognized argument to ‘-flto=’ option: ‘thin’
```

**Причина:** установленный Perl сконфигурирован ещё в stage3/GCC environment.
Perl `Config` продолжает передавать GCC при сборке XS modules,
хотя текущая C/C++ policy использует Clang-specific `-flto=thin`.
Успешная native-сборка `libapparmor` не проверяет compiler, выбранный Perl XS.

**Исправление:** пересобрать `dev-lang/perl` уже под финальной Clang
toolchain policy, затем повторить `sys-libs/libapparmor`:

```bash
emerge --ask --oneshot dev-lang/perl
emerge --ask --oneshot sys-libs/libapparmor
```

**Проверка:** повторная сборка `libapparmor`, включая Perl binding,
на builder успешно завершилась. Проверяй выбранный XS compiler по build
output: stale Perl toolchain metadata должна быть заменена пересборкой Perl.

Не сохраняй `sys-libs/libapparmor -perl` и не добавляй постоянный GCC
fallback для этого пакета: они скрывают причину сбоя. Intentional GCC/BFD
fallback builder для `sys-devel/binutils` и `x11-libs/pango` — отдельная
принятая policy, которую эти bootstrap fixes не отменяют.

## 6. `gentoo-kernel-bin`: ThinLTO объекты и прямой вызов `ld.bfd`

**Симптом:** установка `sys-kernel/gentoo-kernel-bin-6.18.54` прерывается
на `modules_prepare` / kernel helper compilation:

```text
clang ... -flto=thin ... libbpf.o
x86_64-pc-linux-gnu-ld.bfd -r ...
libbpf.o: file not recognized: file format not recognized
```

**Причина:** global userspace ThinLTO flags попали в kernel helper objects,
но этот build path напрямую вызвал `ld.bfd`, который не смог обработать
полученный объект. Выбор LLD в userspace `LDFLAGS` не отменяет прямой вызов
BFD внутри kernel preparation.

**Исправление:** ограничить no-LTO/BFD-compatible policy пакетом
`sys-kernel/gentoo-kernel-bin`. Сохрани Clang и обычную userspace
Clang + ThinLTO + LLD policy. Пример адаптации для portable builder:

Файл: `/etc/portage/env/builder-kernel-bin-no-lto` (пример имени env-файла).

```makefile
CFLAGS="-march=x86-64-v3 -O2 -pipe"
CXXFLAGS="${CFLAGS}"
LDFLAGS="-Wl,-O1 -Wl,--as-needed -fuse-ld=bfd"
```

Файл: `/etc/portage/package.env` (добавь к существующим правилам):

```text
sys-kernel/gentoo-kernel-bin builder-kernel-bin-no-lto
```

Если для пакета уже есть env rules, согласуй их порядок: последующие
настройки не должны снова добавлять `-flto=thin` или несовместимый linker.
Пример показывает необходимые свойства исправления; точное имя env-файла
исходной VM не фиксируется. Это package-specific helper exception,
а не temporary bootstrap USE override.

**Проверка:** повтори установку пакета и проверь build output: helper objects
собираются без ThinLTO, BFD link проходит. На builder установка завершилась,
Dracut initramfs создан, first boot с `6.18.54-gentoo-dist-bin` — PASS.
Для проверки запуска используй `uname -r` после загрузки с целевого диска,
а не внутри chroot.

Это не свидетельство broken kernel release и не причина отключать ThinLTO
глобально или переводить builder на GCC. Stable builder kernel `6.18.54`
выбран отдельно от workstation kernel, который остаётся local-only.

## Финальная проверка

Удали temporary bootstrap overrides, верни target USE и выполни полную
конвергенцию:

```bash
emerge \
    --ask \
    --verbose \
    --update \
    --deep \
    --newuse \
    --complete-graph \
    @world
```

Затем повтори resolver:

```bash
emerge --pretend --verbose --update --deep --newuse --complete-graph @world
```

На builder полная пересборка завершилась успешно, overrides удалены;
повторный resolver показал:

```text
Calculating dependencies ... done!
Dependency resolution took 7.27 s (backtrack: 0/20).

Total: 0 packages, Size of downloads: 0 KiB

Nothing to merge; quitting.
```

Это acceptance gate package/toolchain этапа. Сам по себе resolver не
подтверждает boot/runtime или готовность binhost. Base installation и
first boot builder приняты отдельно; проверки — в
[системном документе](../../systems/gentoo-builder-01/#first-boot-и-guest-runtime--pass).

## Environment и границы проверки

Наблюдения относятся к no-multilib hardened/systemd builder, LLVM/Clang/LLD
22, portable `x86-64-v3`, C/C++ `-O2` + ThinLTO и Python `python3_14`.
Точная текущая конфигурация и следующий этап — в
[состоянии gentoo-builder-01](../../systems/gentoo-builder-01/).

Отсутствие `/usr/src/linux` внутри installer chroot давало non-blocking
warning; случайные kernel sources ради него не устанавливались.
`app-alternatives/bc` обнаружил `/usr/bin/bc` и `/usr/bin/dc`, которыми
не владел ни один установленный package, но успешно merged. Эти наблюдения
не были причиной failure.
