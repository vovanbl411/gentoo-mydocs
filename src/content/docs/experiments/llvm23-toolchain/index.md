---
title: "Эксперимент: LLVM 23 toolchain"
kind: reference
scope: system
status: draft
last_verified: null
verified_on: [asus-b5402]
---

Этот каталог хранит исследовательский план перехода основной сборочной цепочки
ASUS ExpertBook B5402 с LLVM 22 на LLVM 23 и связанное исследование
optimization policy.

## Текущий статус эксперимента

| Часть | Статус | Результат / следующий шаг |
|-------|--------|---------------------------|
| Experiment A | **COMPLETE** | A1–A4 — PASS; совместимость подтверждена только для протестированных классов |
| Experiment B | **COMPLETE** | B1–B4 — COMPLETE; принято `global -O2 + selective benchmark-proven -O3` |
| Optimization policy | **APPLIED** | Применена 2026-09-20 |
| Полный `@world` rebuild под `-O2` | **COMPLETE** | Завершён 2026-09-21; post-rebuild boot/runtime проверены |
| Limited `env/llvm-23` pilot | **NOT STARTED** | Следующий отдельный этап после resolver-аудита |
| Experiment C (`compiler-rt + libunwind`) | **NOT STARTED** | Отдельный эксперимент; `libc++` в него не входит |

Experiment A проверял compatibility, но не сравнивал performance LLVM 22 и
LLVM 23. Этот вопрос остаётся открытым.

## Граница source of truth

`experiments/` хранит research record, hypotheses, gates и measurements. Это
не подтверждённое текущее состояние машины. Current source of truth для
системы находится в `systems/asus-b5402/`, прежде всего в
[описании загрузки и Portage](../../systems/asus-b5402/system/boot-and-portage/).
После завершения отдельных этапов подтверждённые результаты должны быть
перенесены в системную документацию или общие guides.

## Документы

- [Toolchain-праймер](toolchain-primer/) — пять слоёв цепочки и фактическая
  конфигурация машины;
- [Гипотеза: -O2 против -O3](optimization-o2-o3/) — дизайн Experiment B,
  критерии выбора пакетов, критерий решения;
- [Методика бенчмарков](benchmark-methodology/) — канонические правила
  измерений и интерпретационная рамка для всех B-гейтов;
- [Бенчмарки -O2/-O3](o2-o3-benchmarks/) — данные и результаты B1–B4;
- [Журнал результатов](results/) — записи по гейтам, итоги Experiment A и
  B, optimization policy decision;
- [Исходный prompt для агента](agent-prompt/) — historical orchestration
  prompt, а не актуальная инструкция выполнения Experiment A или B.

## Цели

1. Совместим ли переход compiler/linker stack с Clang/LLD 22 на Clang/LLD 23
   без одновременной смены runtime-архитектуры. — **Experiment A: COMPLETE**
   (совместимость доказана для протестированных классов; производительность
   LLVM 22 vs 23 не измерялась).
2. Даёт ли LLVM 23 практический выигрыш по времени сборки, размеру бинарников
   или производительности на Alder Lake. — открытый вопрос, benchmark'ов
   нет.
3. Какой глобальный optimization baseline оправдан: `-O3` глобально или
   `-O2` глобально с package-specific `-O3`. — **Experiment B: COMPLETE**
   (B1–B4; решение: global `-O2` + selective benchmark-proven `-O3`;
   применена к `/etc/portage` 2026-09-20, полный rebuild завершён 2026-09-21).
4. Есть ли практический смысл после этого переходить с GNU runtime-компонентов
   на `compiler-rt + libunwind`, не смешивая этот шаг с заменой C++ stdlib. —
   Experiment C: NOT STARTED.

Переход с `libstdc++` на `libc++` не входит в первые фазы эксперимента,
поскольку это отдельное ABI-решение с более высоким риском.

## Подтверждённый baseline перед экспериментом

На момент подготовки эксперимента живой вывод системы показал:

```text
Compiler:          Clang 22.1.8
Portage linker:    LLD через -fuse-ld=lld в LDFLAGS
Bare Clang linker: GNU ld.bfd
C++ stdlib:        GCC 15 libstdc++
Compiler runtime:  libgcc
Unwinder:          libgcc / libgcc_s
```

Clang 23.1.1 и LLD 23.1.1 уже установлены параллельно.

Конфигурация `/etc/clang/23/` перед началом эксперимента:

```text
-fuse-ld=bfd
--rtlib=libgcc
--stdlib=libstdc++
--unwindlib=libgcc
```

Это означает, что в первой фазе можно менять только compiler/linker:

```text
Clang 22 -> Clang 23
LLD   22 -> LLD   23
```

и оставить без изменений:

```text
libstdc++
libgcc
libgcc_s
```

## Исключения Portage на старте эксперимента

> Historical starting snapshot: 111 записей ниже — состояние на момент
> проверки. Текущее состояние: после cleanup 2026-09-20/21 gcc-fallback
> остался только на `sys-devel/binutils` и `x11-libs/pango` (BFD policy
> внутри `env/gcc-fallback`); все 102 локальных `no-lto-llvm` overrides
> сняты, `env/no-lto-llvm` и `env/no-ccache` удалены; source
> `dev-java/openjdk:17` заменён на `dev-java/openjdk-bin:25`. Действующее
> состояние —
> [systems/asus-b5402/system/boot-and-portage.md](../../systems/asus-b5402/system/boot-and-portage/).

Аудит `package.env` показал 111 записей, связанных с
`gcc-fallback`, `problem-llvm`, `llvm-22` или `no-lto-llvm`.

Это число нельзя трактовать как 111 пакетов, несовместимых с LLVM.

Явный `gcc-fallback` на момент проверки применён к девяти пакетам:

```text
app-shells/bash
sys-devel/binutils
app-containers/lxc
app-editors/nano
dev-cpp/highway
dev-java/openjdk
net-analyzer/nmap
x11-libs/pango
media-libs/libjxl
```

Большинство остальных правил означает только отключение ThinLTO или другое
точечное исключение.

## LLVM_COMPAT

VDB показал небольшой набор установленных пакетов с переменной
`LLVM_COMPAT`. Это не следует интерпретировать как список пакетов, которые
можно или нельзя компилировать конкретной версией Clang: часто
`LLVM_COMPAT` описывает совместимость с LLVM как библиотекой или tool
dependency.

Поэтому в эксперименте различаются две независимые оси:

- версия Clang/LLD, которой компилируется C/C++ код пакета;
- слот LLVM, с которым пакет линкуется или от которого зависит как от
  библиотеки/toolchain component.

## Статус экспериментов

**Experiment A — LLVM 22 → 23 (compatibility): COMPLETE.**

| Gate | Пакет | Класс | LTO | LLVM dependency | Результат |
|------|-------|-------|-----|-----------------|-----------|
| A1 | libde265-1.1.3 | C++ codec | ThinLTO | n/a | PASS |
| A2 | libunistring-1.4.2 | C library | disabled | n/a | PASS |
| A3 | mesa_clc-26.2.2 | C/C++ LLVM-dependent | ThinLTO | LLVM 22 | PASS |
| A4 | mesa-26.2.2 (`--buildpkgonly`) | large graphics stack | disabled | LLVM 22 | PASS |

A — результат совместимости, а не сравнение производительности: он не
доказывает совместимость всего `@world` и не отменяет package-specific
исключения.

**Experiment B — -O2 vs -O3: COMPLETE** (B1–B4, финальный review и
optimization policy decision — 2026-09-20). B1 (libde265, single-thread HEVC
decode): O3 runtime ~1.2% быстрее, instructions ~1.8% меньше, `.text` ~12.3%
больше. B2 (zstd 1.5.7-r1): `libzstd` `.text` ~9.2% больше; compression ~1–2%
быстрее, decompression ~1–2% медленнее — смешанный результат. B3 (openssl
3.5.8, без LTO по политике ebuild): преимущества O3 нет — AES-256-CTR
фактическая ничья (~-0.17%), SHA-256 ~-0.5%, ChaCha20 ~-1%, `libcrypto`
`.text` ~+2.6%. B4 (mesa 26.2.2, shader-db на Iris Xe, `-fno-lto` по package
policy): измеримого runtime-преимущества O3 нет; крупные Mesa ELF ~+5% `.text`,
binpkg +5.31%. Подробности — в [o2-o3-benchmarks.md](o2-o3-benchmarks/).

Тенденция по четырём классам workload (codec, compression/decompression,
crypto, desktop/graphics): `-O3` во всех протестированных классах увеличивал
code footprint, а runtime benefit был небольшим, workload-specific,
отсутствующим либо отрицательным.

**Optimization policy decision (2026-09-20)**: global `-O2` + selective
benchmark-proven `-O3`; ThinLTO остаётся глобально там, где package/ebuild
policy допускает. Selective `-O3` rules по итогам B1–B4 не создаются.
Политика применена к `/etc/portage` 2026-09-20 (`make.conf`, env); полный
`@world` rebuild под `-O2` завершён 2026-09-21 (post-rebuild boot/runtime проверены).

## Дорожная карта

### Completed

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
```

### Open / next

```text
limited env/llvm-23 pilot —
NOT STARTED
          ↓
controlled LLVM 23 rollout — после отдельного решения и resolver-аудита
          ↓
Experiment C (compiler-rt + libunwind) — NOT STARTED
```

Блокировка `env/llvm-23` со стороны Experiment B снята: optimization policy
выбрана. Порядок сохраняется — сначала применяется optimization policy, потом
начинается controlled LLVM 23 rollout; не одновременно.

Дальше, каждое — отдельным решением владельца:

- ограниченный `env/llvm-23` pilot; глобальный переход — только после
  resolver-аудита;
- world rebuild по контролируемой схеме: pretend/resolver-проверка, оценка
  исключений, пересборка; существующие GCC fallback сохранять до отдельной
  проверки каждого;
- Experiment C (`compiler-rt + libunwind`) после A и B, с собственным
  baseline и rollback; `libc++` не включать;
- Firefox не использовать как ранний пилот.

## Что измерять

Для сравнения конфигураций фиксируются:

- wall-clock время сборки;
- peak memory, если удобно;
- размер итоговых ELF и binpkg;
- время линковки крупных ThinLTO-пакетов, где отделимо;
- ошибки/предупреждения сборки;
- необходимость новых `package.env` исключений;
- runtime benchmark только там, где есть воспроизводимый workload.

Не объявлять LLVM 23 быстрее только по времени компиляции одного пакета.

## Правила безопасности эксперимента

- Не удалять LLVM 22 до завершения миграции.
- Не менять одновременно compiler, C++ stdlib и runtime.
- Не снимать существующие GCC fallback массово.
- Не включать `default-libcxx` в рамках первых фаз.
- Не обходить `LLVM_COMPAT` ebuild без отдельного обоснования.
- Не считать успешную компиляцию достаточной проверкой: нужен хотя бы запуск
  пакета или его штатных smoke checks, если они доступны и безопасны.
- После каждого гейта документировать результат до перехода к следующему.
