---
title: "Toolchain-праймер: пять независимых слоёв"
kind: reference
scope: system
status: draft
last_verified: null
verified_on: [asus-b5402]
---

Документ даёт mental model пяти независимых слоёв toolchain для эксперимента
[LLVM 23](../): какие настройки менялись, а какие оставались
нетронутыми. Это conceptual reference, а не справочник по LLVM и не описание
текущей конфигурации системы.

Фактические значения ниже относятся к historical Gate A0 baseline, снятому
2026-09-20 и записанному в [results.md](../results/). Current source of truth
системы находится в
[документе о загрузке и Portage](../../../systems/asus-b5402/system/boot-and-portage/).
Permanent `env/llvm-23` и controlled rollout не являются содержанием этого
primer.

## Статус эксперимента в этих записях

- Experiment A (LLVM 23 compatibility) — **COMPLETE**, A1–A4 PASS.
- Experiment B (-O2 vs -O3) — **COMPLETE**, B1–B4.
- Optimization policy decision: global `-O2` + selective benchmark-proven
  `-O3`.
- Политика применена к `/etc/portage` 2026-09-20; полный rebuild завершён
  2026-09-21.
- Permanent `env/llvm-23` / controlled rollout — **NOT STARTED** в контексте
  этих записей.

## 1. Пять слоёв

```text
compiler   → GCC / Clang
linker     → GNU ld.bfd / LLD
C++ stdlib → libstdc++ / libc++
rtlib      → libgcc / compiler-rt
unwinder   → libgcc_s / libunwind
```

| Слой | Что делает |
|------|------------|
| Compiler | переводит C/C++ в объектные файлы; сам не линкует и не предоставляет рантайм |
| Linker | склеивает `.o`/`.a` в ELF и разрешает символы; LTO-сборка — это работа линкера |
| C++ stdlib | реализация `std::`: контейнеры, строки, iostream |
| rtlib | вспомогательный рантайм компилятора: CRT-объекты (`crtbegin*`/`crtend*`), integer builtins (`__udivti3`), atomics, санитайзеры |
| unwinder | раскрутка стека: исключения C++, `backtrace`, профилировщики |

Слои почти ортогональны: «всё GNU» и «всё LLVM» — только два угла пространства
валидных комбинаций. В baseline стек этой машины был смешанным, и это норма.

## 2. Historical experiment baseline — Gate A0, 2026-09-20

| Слой | Значение | Чем задано |
|------|----------|------------|
| Compiler основной | Clang 22.1.8 | `make.conf` (`CC=clang`) + порядок PATH |
| Compiler параллельный | Clang 23.1.1 | `/usr/lib/llvm/23/bin/`; им собирается ядро (env `kernel-llvm`) |
| Linker в Portage | LLD (слот 22) | `-fuse-ld=lld` в `LDFLAGS` make.conf |
| Linker у bare clang | GNU ld.bfd | `Файл: /etc/clang/22/gentoo-linker.cfg` |
| C++ stdlib | libstdc++ (GCC 15) | `gentoo-stdlib.cfg` → `--stdlib=libstdc++` |
| rtlib | libgcc | `gentoo-rtlib.cfg` → `--rtlib=libgcc` |
| unwinder | libgcc_s | `gentoo-unwindlib.cfg` → `--unwindlib=libgcc` |

В baseline cfg слота 23 был идентичен слоту 22: `bfd` / `libgcc` /
`libstdc++` / `libgcc`. Clang 23 был настроен на тот же GNU-рантайм, поэтому
смена compiler/linker в пилоте не тянула за собой смену stdlib, rtlib и
unwinder.

## 3. Почему Clang нормально живёт на libstdc++ + libgcc

- Clang и GCC выпускают ABI-совместимые объектники: общий Itanium C++ ABI и
  общий контракт низкоуровневого рантайма.
- libgcc и compiler-rt — две реализации одного интерфейса (builtins, CRT,
  `_Unwind_*`). Clang линкуется к любой из них; выбор — флагом `--rtlib`.
- libstdc++ — обычная системная библиотека, а не «часть GCC»; Clang целится в
  неё по умолчанию.
- Gentoo-мир годами собирается GCC- и Clang-объектниками вперемешку на одном
  GNU-рантайме. Поэтому этап «поменять compiler/linker, не трогая рантаймы» —
  низкорисковая часть эксперимента.

## 4. «Собрать world Clang'ом» ≠ «перейти на libc++»

- stdlib выбирается флагом `--stdlib` и набором линкуемых библиотек, а не
  компилятором. Clang на Gentoo по умолчанию нацелен на libstdc++.
- libc++ — другая реализация `std::` с другим внутренним ABI: layout
  `std::string`, узлы `std::list` и так далее. Символы libc++ живут в inline
  namespace `std::__1`, поэтому линкер поймает не всё: часть несовпадений
  проявится в рантайме как ODR/ABI-поломки.
- Переход на libc++ означает пересборку всего C++ и разрыв с
  прекомпилированными бинарниками. Это отдельное решение с повышенным риском,
  оно вынесено за рамки первых фаз.

## 5. Portage-selected LLD ≠ default linker самого Clang

Clang — это driver: он сам выбирает линкер по `-fuse-ld=...`. Откуда берётся
значение:

- Сборка пакета в Portage: `LDFLAGS` из `make.conf` содержит `-fuse-ld=lld` →
  линкуется LLD независимо от cfg-дефолтов.
- Bare-вызов (`clang++ test.cpp` руками, без флагов): берётся дефолт из
  `Файл: /etc/clang/<slot>/gentoo-linker.cfg`; в baseline это был
  `-fuse-ld=bfd`.

Отсюда асимметрия baseline: Portage linker = LLD, bare clang = bfd.
Асимметрия уже кусала (PATH-дрейф bare clang, июль 2026 — см. `CHECKPOINT.md`).
Практический вывод для пилота: linker provenance проверяют по самому ELF
(`readelf`), а не по тому, какой clang «должен был» собирать пакет.

В baseline от 2026-09-20 `/usr/lib/llvm/22/bin` стоял в PATH раньше
`/usr/lib/llvm/23/bin` (задано через `/etc/env.d/`), поэтому bare-имена
`clang`, `ld.lld` резолвились в слот 22, а Clang 23 вызывался только абсолютным
путём `/usr/lib/llvm/23/bin/...`. Поэтому pilot использовал абсолютные пути.

## 6. Что делают USE-флаги Gentoo

В baseline дефолты bare clang генерировали отдельные cfg-пакеты (подписаны в
комментариях самих cfg): `llvm-core/clang-linker-config`,
`llvm-runtimes/clang-rtlib-config`, `llvm-runtimes/clang-stdlib-config`,
`llvm-runtimes/clang-unwindlib-config`. Их USE-флаги проверены в VDB
2026-09-20:

| USE | Пакет | Что переключает |
|-----|-------|-----------------|
| `default-lld` | llvm-core/clang-linker-config | дефолтный линкер bare clang → LLD |
| `default-compiler-rt` | llvm-runtimes/clang-rtlib-config | дефолтный rtlib bare clang → compiler-rt |
| `default-libcxx` | llvm-runtimes/clang-stdlib-config | дефолтная stdlib bare clang → libc++ |
| `llvm-libunwind` | llvm-runtimes/clang-unwindlib-config | дефолтный unwinder → llvm-libunwind |

Флаги `compiler-rt` и `libcxx` управляют сборкой самих рантаймов
(compiler-rt, libc++/libc++abi) как части LLVM-стека.

Два ограничения:

1. «Собрано» ≠ «используется». Наличие compiler-rt или libc++ в системе ничего
   не переключает: реальный выбор делают флаги линковки каждого пакета
   (`--rtlib`, `--stdlib`, `--unwindlib`).
2. `default-*` меняют только дефолты bare-вызовов; сборки Portage задают флаги
   явно и дефолты переопределяют.

По design первой фазы эти флаги не менялись (правило 7 из agent-prompt): cfg
слота 23 обеспечивали GNU-рантайм по умолчанию.

## 7. Как слои ложатся на эксперимент

Таблица ниже фиксирует исходный design и mapping экспериментов. Experiment A
и B завершены; Experiment C остаётся отдельной незавершённой фазой, а переход
на `libc++` не входит в план первых фаз.

| Гипотеза | Меняет | Сохраняет |
|----------|--------|-----------|
| A: LLVM 22 → 23 | compiler, linker (пилотные пакеты) | stdlib, rtlib, unwinder, `-O3`, ThinLTO, исключения package.env |
| B: -O2 vs -O3 | только уровень оптимизации в CFLAGS/CXXFLAGS | всё остальное, включая версию LLVM |
| C: runtimes | `libgcc → compiler-rt`, `libgcc_s → libunwind` | compiler, linker, stdlib |
| вне плана | `libstdc++ → libc++` | — |

### Две оси: компилятор и LLVM-библиотеки

Для пакетов, которые зависят от LLVM как от библиотеки (mesa, mesa_clc,
xwayland-satellite и другие), есть ещё одна независимая ось: слот LLVM, с
которым пакет линкуется. Его выбирает ebuild через `LLVM_COMPAT`/`LLVM_SLOT`,
и он не связан с тем, каким Clang компилируются исходники пакета.

Gate A3 доказал это на практике: `mesa_clc` собран Clang 23, при этом
`LLVM_COMPAT=(18 19 20 21 22)` выбрал `LLVM_SLOT=22`, и исполняемый файл
линкуется с `libLLVM.so.22.1`/`libclang-cpp.so.22.1`. Конфигурация «новым
компилятором собираем, на старые LLVM-библиотеки линкуемся» — валидна (но не
обобщается автоматически на все ebuild, см. results.md).

## Related records

- [Статус LLVM 23 experiment](../)
- [Журнал результатов](../results/)
- [Experiment B: -O2 против -O3](../optimization-o2-o3/)
- [Current system source of truth](../../../systems/asus-b5402/system/boot-and-portage/)
