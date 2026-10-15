---
kind: reference
scope: system
status: historical
last_verified: null
verified_on: [asus-b5402]
---

# Журнал эксперимента: LLVM 23 toolchain

> **Архив:** исторический материал LLVM 23 experiment (2026-09-20…21).
> Старые инструкции, baseline и next steps не являются текущей процедурой.
> Итоги эксперимента: [LLVM 23: эксперимент и выводы](../../src/content/docs/experiments/llvm23-toolchain/index.md).
> Актуальное состояние системы: [Загрузка и Portage](../../src/content/docs/systems/asus-b5402/system/boot-and-portage.md).

Это канонический хронологический журнал LLVM 23 experiment. Для каждого гейта
здесь фиксируются дата, исходная конфигурация, точная изменяемая переменная,
команды, релевантный вывод, PASS/FAIL, evidence, ограничения, rollback и
следующий минимальный gate. Build logs целиком не копируются — только
воспроизводимые команды и существенные результаты.

Зафиксированный итог журнала: Experiment A — COMPLETE, Experiment B —
COMPLETE, Experiment C — NOT STARTED. Optimization policy применена, полный
rebuild завершён; limited LLVM 23 rollout на последнем checkpoint этого
журнала ещё NOT STARTED.

Experiment record хранится здесь. Текущее production-состояние машины
описывается отдельно в
[`../../systems/asus-b5402/system/boot-and-portage.md`](../../src/content/docs/systems/asus-b5402/system/boot-and-portage.md);
исторические значения ниже не являются inventory текущей системы.

Нумерация: A — LLVM 22→23 (compatibility), B — -O2 vs -O3 (optimization),
C — runtimes. Исходный план — в [agent-prompt.md](agent-prompt.md), ментальная модель слоёв — в
[toolchain-primer.md](../../src/content/docs/experiments/llvm23-toolchain/toolchain-primer.md), методология и данные B — в
[-O2 vs -O3](../../src/content/docs/experiments/compiler-optimization/o2-vs-o3.md).

## Статусы

| Эксперимент | Вопрос | Статус |
|-------------|--------|--------|
| A — LLVM 22 → 23 | совместимость Clang/LLD 23 с runtime-архитектурой baseline экспериментального периода | **COMPLETE** |
| B — -O2 vs -O3 | выбор глобального optimization baseline | **COMPLETE** |
| C — runtimes | `libgcc → compiler-rt`, `libgcc_s → libunwind` | NOT STARTED |

| Gate | Статус | Gate | Статус |
|------|--------|------|--------|
| A1 libde265 | PASS | B1 libde265 | COMPLETE |
| A2 libunistring | PASS | B2 zstd | COMPLETE |
| A3 mesa_clc | PASS | B3 openssl | COMPLETE |
| A4 mesa | PASS | Финальный review B1–B3 | COMPLETE |
| — | — | B4 mesa | COMPLETE |
| — | — | Optimization policy decision | COMPLETE |
| — | — | Применение политики к `/etc/portage` | COMPLETE (2026-09-20) |
| — | — | Portage no-LTO exception cleanup | COMPLETE (2026-09-21) |
| — | — | Полный rebuild `@world` (O2/LTO policy) | COMPLETE (2026-09-21) |

B1 — benchmark result, а не validation gate: для O2/O3 статус «PASS» не
используется.

## Gate A0 — baseline

> **Исторический baseline, зафиксированный 2026-09-20**: раздел описывает
> состояние на дату начала эксперимента, а не текущий inventory машины.

- **Дата**: 2026-09-20.
- **Изменяемая переменная**: нет. Фиксация состояния и сверка документации с
  живой системой.

### Исходная конфигурация

Зафиксирована владельцем при подготовке эксперимента (см.
[agent-prompt.md](agent-prompt.md)):

```text
CC=clang CXX=clang++ AR=llvm-ar NM=llvm-nm RANLIB=llvm-ranlib
Clang 22.1.8
CFLAGS/CXXFLAGS = -march=alderlake -O3 -flto=thin -pipe
                  -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld

Portage linker = LLD (слот 22)
Bare clang default linker = GNU ld.bfd
C++ stdlib = libstdc++ (GCC 15)
rtlib = libgcc
unwindlib = libgcc / libgcc_s
LLVM 23.1.1 + LLD 23.1.1 установлены параллельно
```

### Команды Gate 0

```bash
portageq envvar CC CXX AR NM RANLIB CFLAGS CXXFLAGS LDFLAGS
clang --version
/usr/lib/llvm/23/bin/clang --version
/usr/lib/llvm/23/bin/ld.lld --version
```

### Контрольный прогон (2026-09-20, read-only)

```text
/usr/lib/llvm: слоты 22, 23
clang (bare) → 22.1.8; /usr/lib/llvm/23/bin/clang → 23.1.1;
/usr/lib/llvm/23/bin/ld.lld → LLD 23.1.1

portageq: CC=clang CXX=clang++ AR=llvm-ar NM=llvm-nm RANLIB=llvm-ranlib;
CFLAGS/CXXFLAGS и LDFLAGS совпадают с baseline слово в слово.

/etc/clang/22 и /etc/clang/23 (идентичны):
gentoo-linker.cfg    → -fuse-ld=bfd
gentoo-rtlib.cfg     → --rtlib=libgcc
gentoo-stdlib.cfg    → --stdlib=libstdc++
gentoo-unwindlib.cfg → --unwindlib=libgcc

PATH: /usr/lib/llvm/22/bin стоит раньше /usr/lib/llvm/23/bin (env.d) →
bare clang/ld.lld = слот 22; Clang 23 — только по абсолютному пути.
```

Заодно сняты обе pre-flight проверки Gate A1 (`-###` ничего не исполняет):

```bash
/usr/lib/llvm/23/bin/clang++ -### -x c++ /dev/null -fuse-ld=lld 2>&1 | tail -n1
/usr/lib/llvm/23/bin/clang++ -### -x c++ /dev/null 2>&1 | tail -n1
```

```text
С -fuse-ld=lld: линкер = /usr/lib/llvm/23/bin/ld.lld        ✓
Без флагов:     линкер = /usr/bin/x86_64-pc-linux-gnu-ld.bfd ✓
Библиотеки:     -lstdc++ -lgcc_s -lgcc; CRT из /usr/lib/gcc/x86_64-pc-linux-gnu/15 ✓
```

### PASS/FAIL

**PASS** — baseline зафиксирован, воспроизводим и совпадает с документацией
эксперимента и системными разделами.

### Rollback/остаточные изменения

Не требуются: система не изменялась.

## Gate A1 — libde265 (один небольшой пакет)

- **Дата**: 2026-09-20 (после A0).
- **Изменяемая переменная**: compiler и linker 22 → 23 через абсолютные пути
  LLVM 23; flags, рантаймы и package.env — без изменений.

### Конфигурация пилота

```text
Compiler: Clang 23 (абсолютные пути)
Linker:   LLD 23
CFLAGS/CXXFLAGS: -march=alderlake -O3 -flto=thin -pipe
                 -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk
C++ stdlib: libstdc++
Runtime/unwinder: libgcc + libgcc_s
```

### Команды фиксации (владелец)

```bash
bzcat /var/db/pkg/media-libs/libde265-1.1.3/environment.bz2 | grep -aE '^(CC|CXX|AR|NM|RANLIB|CFLAGS|CXXFLAGS|LDFLAGS)='
readelf -d /usr/lib64/libde265.so.0.2.3 | grep NEEDED
size /usr/lib64/libde265.so.0.2.3
dec265 --help
```

### Результаты

VDB подтвердил окружение сборки:

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -flto=thin ...
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld
```

Runtime dependencies (`NEEDED`):

```text
libstdc++.so.6
libgcc_s.so.1
libc.so.6
libm.so.6
```

Размер `/usr/lib64/libde265.so.0.2.3`:

```text
text = 647595
data = 3328
bss  = 21011
```

Smoke test: `dec265 --help`, exit status 0.

### PASS/FAIL

**PASS**.

### Что доказано

- `libde265` успешно собирается Clang 23;
- LLD используется через текущую Portage policy;
- ThinLTO сохраняется;
- GNU `libstdc++ + libgcc/libgcc_s` сохраняются;
- установленный executable запускается.

### Что НЕ доказано

- LLVM 23 быстрее LLVM 22;
- `-O3` лучше `-O2`;
- размер бинарника лучше/хуже LLVM 22.

> **Примечание**: размер не сравнивается с `libde265-1.0.16` — это другая
> версия, сравнение некорректно. Полный upstream test suite не проходил.

### Rollback/остаточные изменения

Пакет установлен штатно; рантаймы и глобальная policy не менялись. Отдельный
rollback не требуется.

## Gate A2 — libunistring (существующая no-lto-llvm policy)

- **Дата**: 2026-09-20 (после A1).
- **Изменяемая переменная**: только compiler/toolchain binaries 22 → 23.
  Optimization policy пакета не менялась.

### Исходная политика пакета

```text
dev-libs/libunistring no-lto-llvm
```

`no-lto-llvm` задаёт:

```text
-O3
-fno-lto
-fuse-ld=lld
```

### Команды фиксации (владелец)

```bash
bzcat /var/db/pkg/dev-libs/libunistring-1.4.2/environment.bz2 | grep -aE '^(CC|CXX|AR|NM|RANLIB|CFLAGS|CXXFLAGS|LDFLAGS)='
readelf -d /usr/lib64/libunistring.so.5 | grep NEEDED
size /usr/lib64/libunistring.so.5
```

### Результаты

VDB после сборки:

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -fno-lto ...
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld -fno-lto
```

Runtime dependencies:

```text
libc.so.6
```

Отсутствие `libstdc++`/`libgcc_s` ожидаемо: это чистая C library.

Размер `/usr/lib64/libunistring.so.5`:

```text
text = 1980090
data = 15760
bss  = 4496
```

### PASS/FAIL

**PASS**.

### Главный вывод

> Существующая package-specific `no-lto-llvm` policy совместима с
> использованием Clang 23 без необходимости одновременно менять optimization
> policy.

### Будущий audit item

`RUSTFLAGS` внутри env-файла `no-lto-llvm` содержит hardcoded
`/usr/lib/llvm/22/bin/clang`. На момент Gate A2 это намеренно не исправлялось:
для `libunistring` Rust не участвует, правка env-файла — отдельное изменение
живой системы вне рамок гейта. Проверить при следующем аудите `/etc/portage`.

### Rollback/остаточные изменения

Не требуются.

## Gate A3 — mesa_clc (LLVM как library dependency)

- **Дата**: 2026-09-20 (после A2).
- **Изменяемая переменная**: compiler/toolchain binaries 22 → 23; LLVM_SLOT
  ebuild-политикой не менялся.

Пакет:

```text
dev-util/mesa_clc-26.2.2
```

Важный случай: ebuild содержит

```text
LLVM_COMPAT=(18 19 20 21 22)
```

и выбрал `LLVM_SLOT=22`, при этом сам пакет успешно скомпилирован Clang 23.

### Команды фиксации (владелец)

```bash
bzcat /var/db/pkg/dev-util/mesa_clc-26.2.2/environment.bz2 | grep -aE '^(CC|CXX|AR|NM|RANLIB|LLVM_SLOT|LLVM_COMPAT)='
readelf -d /usr/bin/mesa_clc | grep NEEDED
size /usr/bin/mesa_clc
mesa_clc --help
```

### Результаты

VDB:

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang-23
CXX=/usr/lib/llvm/23/bin/clang++-23
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -flto=thin ...
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld

LLVM_COMPAT=(18 19 20 21 22)
LLVM_SLOT=22
```

Фактические dynamic dependencies:

```text
libLLVM.so.22.1
libclang-cpp.so.22.1
libLLVMSPIRVLib.so.22.1
libstdc++.so.6
libgcc_s.so.1
```

Размер `/usr/bin/mesa_clc`:

```text
text = 107159
data = 2848
bss  = 8056
```

Smoke test: `mesa_clc --help`, exit status 0.

### PASS/FAIL

**PASS**.

### Главный вывод

> Для данного ebuild `LLVM_COMPAT`/`LLVM_SLOT` описывают поддерживаемый LLVM
> dependency slot и не являются автоматически ограничением версии Clang,
> которой можно компилировать C/C++ исходники пакета.

Фактически доказана конфигурация:

```text
Clang 23
   ↓ compile
mesa_clc
   ↓ runtime/link dependencies
LLVM 22 libraries
   +
libstdc++ / libgcc_s
```

Это ровно «две оси» из [toolchain-primer.md](../../src/content/docs/experiments/llvm23-toolchain/toolchain-primer.md):
версия компилятора и слот LLVM-библиотек независимы.

> ⚠️ **Важный нюанс**: это доказано для данного конкретного ebuild и не должно
> автоматически обобщаться на все пакеты Gentoo.

### Rollback/остаточные изменения

Не требуются.

## Gate A4 — mesa (крупный production-пакет, --buildpkgonly)

- **Дата**: 2026-09-20, сборка завершена 15:50:03 +03 (BUILD_TIME 1789908603).
- **Изменяемая переменная**: compiler/toolchain binaries 22 → 23.
- **Статус**: **PASS** — итоговый статус подтверждён владельцем.

### Цель

```text
крупный production package
Clang 23 + LLD 23
-O3
-fno-lto (существующая policy)
LLVM libraries slot 22
```

Существующая package policy:

```text
media-libs/mesa no-lto-llvm ssd
```

Сборка выполнялась как `emerge --buildpkgonly ...` — эксперимент не
устанавливал новую Mesa в живую систему.

> ⚠️ **Важный нюанс**: build time этого `--buildpkgonly`-прогона достоверно не
> зафиксирован. Старые `qlop` timings относятся к предыдущим сборкам Mesa и не
> должны использоваться как timing A4. Значение не подставляется.

### Артефакт

```text
/var/cache/binpkgs/media-libs/mesa/mesa-26.2.2-1.gpkg.tar
размер: 24360960 байт (~23.2 MiB)
BUILD_TIME: 1789908603 = 2026-09-20 15:50:03 +03
```

Формат — gpkg (GLEP 78): внешний tar без компрессии, внутри
`metadata.tar.zst` и `image.tar.zst`.

### Build environment (из metadata binpkg)

```text
CC  = /usr/lib/llvm/23/bin/clang-23
CXX = /usr/lib/llvm/23/bin/clang++-23
AR  = /usr/lib/llvm/23/bin/llvm-ar
NM  = /usr/lib/llvm/23/bin/llvm-nm
RANLIB = /usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -fno-lto -pipe
                  -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld -fno-lto

LLVM_COMPAT=(18 19 20 21 22)
LLVM_SLOT=22
USE (релевантное): llvm llvm_slot_22 opencl vaapi video_cards_intel
                   video_cards_zink vulkan zstd
```

LLVM dependencies внутри binpkg:

```text
libgallium-26.2.2.so
  NEEDED libLLVM.so.22.1

libRusticlOpenCL.so.1.0.0
  NEEDED libLLVM.so.22.1
  NEEDED libclang-cpp.so.22.1
  NEEDED libLLVMSPIRVLib.so.22.1
```

Плюс `libstdc++.so.6` и `libgcc_s.so.1` — GNU-рантайм сохранён.

### ELF baseline sizes

| ELF | text |
|-----|------|
| libgallium-26.2.2.so | 33902507 |
| libRusticlOpenCL.so.1.0.0 | 27278236 |
| libvulkan_intel.so | 25886606 |
| libvulkan_intel_hasvk.so | 19691023 |

Суммарный SIZE пакета: 124338330 байт.

Метод разбора binpkg (штатные tar + zstd, всё в /tmp, без установки):

```bash
mkdir -p /tmp/mesa-a4 /tmp/mesa-a4/meta /tmp/mesa-a4/img
cp /var/cache/binpkgs/media-libs/mesa/mesa-26.2.2-1.gpkg.tar /tmp/mesa-a4/
tar xf /tmp/mesa-a4/mesa-26.2.2-1.gpkg.tar -C /tmp/mesa-a4
tar xf /tmp/mesa-a4/mesa-26.2.2-1/metadata.tar.zst --zstd -C /tmp/mesa-a4/meta
tar tvf /tmp/mesa-a4/mesa-26.2.2-1/image.tar.zst --zstd | grep -E '\.so' | sort -k3 -rn | head -12
```

Metadata распаковывается в плоские VDB-подобные файлы (`CC`, `CFLAGS`, `USE`,
`NEEDED.ELF.2`, `environment.bz2`). Для старых `.xpak`-binpkg вместо этого
применимы `qtbz2 -s` + `qxpak`.

### Живая система не тронута (подтверждение)

```text
установленная: /var/db/pkg/media-libs/mesa-26.2.2, BUILD_TIME = 1789260539
               (2026-09-13 03:49 +03)
binpkg:        BUILD_TIME = 1789908603 (2026-09-20 15:50:03 +03)
→ значения различаются, замены установленной Mesa не было
```

**Наблюдение на checkpoint Gate A4 (2026-09-20)**: в `/etc/portage/env/`
зафиксированы 7 файлов
(`bfd gcc-fallback kernel-llvm no-ccache no-lto-llvm p-cores ssd`) — это
расходится и со старым списком из `boot-and-portage.md` (11 имён, состояние
2026-09-12), и с CHECKPOINT (8 файлов, аудит 2026-09-14). Временных
`llvm-23-pilot`-остатков нет. Разобраться при следующей синхронизации
`/etc/portage`.

### Что доказано

- Mesa 26.2.2 собирается Clang 23 + LLD 23 в рамках существующей
  `no-lto-llvm + ssd` policy;
- `-O3 -fno-lto` и `-fuse-ld=lld` подтверждены из metadata binpkg;
- LLVM library slot 22 подтверждён (`LLVM_SLOT=22`, `USE llvm_slot_22`,
  `libLLVM.so.22.1`);
- установленная Mesa не заменена.

### Что НЕ доказано

- Runtime-поведение собранного Mesa: binpkg не установлен и не запускался;
- время сборки и производительность относительно LLVM 22 (измерений нет).

### Rollback/остаточные изменения

Rollback тривиален: удалить binpkg одной командой владельца. Живая система и
`/etc/portage` не изменялись.

## Итог Experiment A — COMPLETE

Вопрос эксперимента A:

> Можно ли использовать Clang/LLD 23 на baseline-системе экспериментального
> периода, не меняя одновременно libc++, compiler-rt, libunwind и остальную
> runtime architecture?

Ответ по тестам этого baseline:

```text
YES — для протестированных классов пакетов.
```

| Gate | Пакет | Класс | LTO | LLVM dependency | Результат |
|------|-------|-------|-----|-----------------|-----------|
| A1 | libde265-1.1.3 | C++ codec | ThinLTO | n/a | PASS |
| A2 | libunistring-1.4.2 | C library | disabled | n/a | PASS |
| A3 | mesa_clc-26.2.2 | C/C++ LLVM-dependent | ThinLTO | LLVM 22 | PASS |
| A4 | mesa-26.2.2 | large graphics stack | disabled | LLVM 22 | PASS |

Вывод:

> Experiment A показал, что Clang/LLD 23 собирает несколько существенно
> разных классов пакетов на этой машине, сохраняя baseline GNU C++
> runtime architecture и — где применимо — зависимости от LLVM 22.

Ограничения scope:

> Experiment A — это результат совместимости, а не сравнение
> производительности LLVM 22 и LLVM 23.

Результат не доказывает, что весь `@world` совместим с LLVM 23, и не
доказывает отсутствие package-specific исключений. Формулировки «LLVM 23
быстрее», «LLVM 23 лучше», «LLVM 23 готов для всего @world» не подтверждены и
в документации не используются.

## Experiment B — optimization policy

Завершённое сравнение `-O2` vs `-O3` вынесено в [самостоятельный эксперимент](../../src/content/docs/experiments/compiler-optimization/o2-vs-o3.md).
Clang/LLD 23 были фиксированным baseline, а не переменной сравнения. Решение
2026-09-20: global `-O2`, ThinLTO где поддерживается и package-specific `-O3`
только по benchmark; selective rules по B1–B4 не создавались. Применение и
rebuild 2026-09-21 сохранены ниже как предусловия LLVM rollout.

### Portage no-LTO exception cleanup — COMPLETE

- **Дата**: 2026-09-21.
- **Baseline**: 102 локальных назначения `no-lto-llvm` в `package.env` —
  остаток исторического compatibility-слоя (снапшот на старте эксперимента —
  в [исходном prompt](agent-prompt.md)).
- **Метод**: правила снимались контролируемыми batch'ами; каждый batch
  проверялся `emerge --buildpkgonly -1`.
- **Результат**: все 102 overrides удалены; `env/no-lto-llvm`,
  `env/no-ccache` (после исчезновения последнего потребителя) и
  `package.env/20-compatibility` удалены; `media-libs/mesa` — только `ssd`
  в `10-performance`. Итоговая структура на cleanup checkpoint 2026-09-21:
  `env/` — `gcc-fallback`, `kernel-llvm`, `p-cores`, `ssd`; `package.env/` —
  `00-toolchain`, `10-performance`, `30-gcc-fallback`.

Доказано: локальный compatibility blacklist `no-lto-llvm` больше не
требуется — все 102 overrides оказались не нужны (для части пакетов ebuild
сам управляет LTO через `filter-lto`, часть Go/Rust-пакетов не использует
эти C/C++ flags напрямую).

НЕ доказано (на момент cleanup): runtime-состояние полностью пересобранного
`@world`; закрыто полным rebuild 2026-09-21 — см. ниже.

### Полный rebuild `@world` — COMPLETE

- **Дата**: 2026-09-21.
- **Состав**: полный rebuild установленного `@world` после применения
  optimization/LTO policy (`-O2` + ThinLTO; локальные no-LTO overrides
  сняты предыдущим шагом).

Результат: rebuild завершён успешно; система загрузилась штатно, основные
сервисы работают, новых функциональных проблем не обнаружено. Post-rebuild
анализ журналов регрессий, связанных с `-O2` + ThinLTO, не выявил.

> Формулировка намеренно аккуратная: это не значит, что каждый установленный
> файл собран с ThinLTO — ebuild'ы могут фильтровать LTO (`filter-lto`) или
> вообще не использовать C/C++ toolchain.

Найденные при post-rebuild диагностике проблемы — локальные
конфигурационные ошибки, не связанные с optimization policy (iwd
`ProtectKernelTunables`, дублирующийся polkit agent, transient-гонка
NM/iwd). Зафиксированы в системной документации:
[networking](../../src/content/docs/systems/asus-b5402/networking/networkmanager-and-libvirt.md),
[desktop](../../src/content/docs/systems/asus-b5402/desktop/environment.md).

### Decision gate: env/llvm-23 — после optimization policy decision

Блокировка Experiment B'ом снята: исследование завершено, optimization policy
выбрана, применена и проверена полным rebuild. Следующий незавершённый
controlled step на этом checkpoint — limited `env/llvm-23` pilot. Постоянное
назначение LLVM 23 через `package.env` остаётся отдельным решением владельца:

```text
Experiment A — LLVM 23 compatibility — COMPLETE
          ↓
Experiment B — -O2 vs -O3 — COMPLETE
  B1 libde265 — COMPLETE
  B2 zstd — COMPLETE
  B3 openssl — COMPLETE
  финальный review B1–B3 — COMPLETE (2026-09-20)
  B4 mesa — COMPLETE (2026-09-20)
  optimization policy decision — COMPLETE (2026-09-20)
          ↓
применение -O2 в /etc/portage — COMPLETE (2026-09-20)
          ↓
полный O2 rebuild + валидация — COMPLETE (2026-09-21)
          ↓
limited env/llvm-23 pilot —
NOT STARTED
```

Порядок сохраняется: сначала применяется optimization policy, затем
начинается controlled LLVM 23 rollout — не одновременно. Experiment C
(`compiler-rt + libunwind`) — NOT STARTED.

## Связанные записи

- [Итоги эксперимента](../../src/content/docs/experiments/llvm23-toolchain/index.md) — overview и status эксперимента;
- [toolchain-primer.md](../../src/content/docs/experiments/llvm23-toolchain/toolchain-primer.md) — conceptual model;
- [-O2 vs -O3](../../src/content/docs/experiments/compiler-optimization/o2-vs-o3.md) — решение, методика и benchmark evidence;
- [`../../systems/asus-b5402/system/boot-and-portage.md`](../../src/content/docs/systems/asus-b5402/system/boot-and-portage.md) — current system source of truth.
