---
title: Методика optimization-бенчмарков (Experiment B)
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

Это каноническая методика Experiment B для A/B-сравнений `-O2` vs `-O3`.
Правила были зафиксированы до интерпретации результатов и не менялись после
получения данных. B1–B4 завершены, а документ остаётся reference-записью о
том, как были получены результаты.

Фактические данные находятся в
[o2-o3-benchmarks.md](../o2-o3-benchmarks/), подробный decision record — в
[optimization-o2-o3.md](../optimization-o2-o3/), gate journal — в
[results.md](../results/).

## 0. Разделение фактов и выводов

Во всей документации эксперимента разделяются:

```text
raw facts      — измеренные значения (raw samples, размеры ELF, provenance)
derived metrics — средние, медианы, CV, проценты, нормализованные метрики
interpretation — качественные выводы из derived metrics с указанием ограничений
decision       — изменение production policy; отдельный шаг владельца
```

Пример, зафиксированный до production rollout и оставленный без
ретроспективного обновления:

```text
FACT:          O3 libcrypto .text +2.62%
FACT:          AES throughput difference -0.17%
INTERPRETATION: AES — фактически ничья в пределах наблюдаемой вариации
DECISION:       production optimization policy пока не меняется
```

## Правила

### Rule 1 — меняется одна переменная

Для O2/O3-сравнения одинаковы: версия пакета, compiler, linker, CPU target,
USE flags, dependencies, LTO policy, runtime libraries, benchmark workload.
Меняется только `-O2` ↔ `-O3`.

### Rule 2 — Clang 23 фиксирован

Compiler — Clang 23, linker — LLD 23 (absolute paths слота 23). Experiment B
не является benchmark'ом LLVM 22 vs LLVM 23.

### Rule 3 — package-native policy сохраняется

Если ebuild сам отключает LTO (например, OpenSSL `filter-lto`) — не включать
LTO обратно. Если package-specific policy отключает LTO — сохранять её
одинаково для O2 и O3. Benchmark отражает реальную Gentoo build policy, а не
искусственную конфигурацию.

### Rule 4 — buildpkgonly

Где возможно, сборка через `--buildpkgonly` в разные PKGDIR:

```text
/tmp/<package>-o2-pkgs
/tmp/<package>-o3-pkgs
```

Живая система не меняется, обе сборки сохраняются одновременно, возможен
side-by-side анализ.

### Rule 5 — provenance до benchmark

До runtime-теста подтвердить из binpkg metadata/environment: `CC`, `CXX`,
`AR`, `NM`, `RANLIB`, `CFLAGS`, `CXXFLAGS`, `LDFLAGS`, состояние LTO. Не
доверять только командной строке запуска emerge.

### Rule 6 — изолированные runtime-деревья

Распакованные O2/O3-сборки запускаются со своими библиотеками через
`LD_LIBRARY_PATH` (проверка `ldd` или эквивалент). Не допускать ситуацию
«O2 executable + системная/O3 библиотека».

### Rule 7 — correctness до performance

До benchmark: smoke test; round-trip / decode verification / детерминированный
результат, где применимо; обе сборки функционально корректны. Бенчмарк
сломанного бинарника не имеет смысла.

### Rule 8 — одно физическое ядро

Single-thread benchmarks закрепляются `taskset -c <тот же P-core>`. Стандарт
для этой машины — CPU 2 (P-core), если нет отдельной причины выбрать другое.
Не смешивать P-core и E-core сэмплы.

### Rule 9 — warm-up

Перед measured samples — warm-up обеих сборок (не входит в измерения). Цели:
стабилизация filesystem/page cache, загрузка библиотек, прогрев branch
predictor/кода, снижение cold-start эффектов. Warm-up не устраняет thermal и
системный шум полностью — это не утверждается.

### Rule 10 — симметричный порядок

Стандартный порядок measured runs:

```text
O2, O3, O3, O2, O3, O2, O2, O3
```

4 сэмпла каждого варианта. Цели: уменьшить temporal bias, распределить оба
уровня по времени benchmark-сессии, не гонять сначала все O2, потом все O3.
Шумный workload — увеличить число сэмплов, сохраняя balanced/interleaved
порядок.

### Rule 11 — достаточно длинные workload'ы

Measured run должен быть достаточно долгим, чтобы ожидаемая разница runtime
превышала startup noise. Короткие synthetic microbenchmarks — избегать без
необходимости.

### Rule 12 — fixed-work vs fixed-time

- Fixed-work workload (одинаковый вход и операции): `task-clock`, `cycles`,
  `instructions` сравниваются напрямую.
- Fixed-time workload (`openssl speed` и аналоги): raw totals напрямую между
  ветками НЕ сравниваются — более быстрый вариант за то же время обрабатывает
  больше данных. Обязательна нормализация: `cycles/byte`,
  `instructions/byte`, `branches/byte`; обработанные байты берутся из
  throughput/operation count.

### Rule 13 — метрики code size

Минимум для каждой сборки: ELF `.text`, file size, при пользе — binpkg size.
Инструменты — `size` и `stat`, не только `ls -lh`.

### Rule 14 — метрики build cost

Через `/usr/bin/time -v`: user/system/wall time, Maximum RSS, filesystem
inputs/outputs, CPU utilization. Один build-run не является достаточным
основанием для вывода о compile-time performance; если build timing становится
decision factor — повторные controlled builds.

### Rule 15 — метрики runtime

Минимум: task-clock или throughput, cycles, instructions, IPC. Дополнительно
где полезно: branches, branch misses, cache counters, domain-specific метрики.

### Rule 16 — frequency sanity check

Вычислять `cycles / task-clock` для проверки, не объясняется ли результат
разной средней частотой CPU. Это не полная thermal validation.

### Rule 17 — вариабельность

Для сэмплов считать минимум: mean, median, CV (относительную вариацию). Сильный
вывод из разницы, находящейся внутри обычного наблюдаемого шума, не делается.

### Rule 18 — без предопределённого победителя

Цель — не доказать «O2 лучше» или «O3 лучше», а определить измеренный
trade-off скорость / code size / стабильность для конкретных workload'ов.

## Интерпретационная рамка

Классификация результатов (рамка, а не жёсткие числовые пороги):

- **Strong O3 candidate**: чёткий повторяемый runtime-выигрыш, заметно больше
  измерительного шума; приемлемая для workload'а цена по code size.
- **Weak / questionable O3 candidate**: выигрыш ~0–2%, значительный рост кода,
  польза на границе вариации бенчмарка.
- **O2-favored workload**: значимого выигрыша нет или есть регрессия, при этом
  O3 увеличивает code size.

## Ограничения интерпретации

- Generic cache events на Intel hybrid PMU сравнительно шумные, а бенчмарки
  Experiment B не проектировались под изоляцию конкретных cache-иерархий:
  сильных причинных выводов о cache behavior не делать. Central decision
  опирается прежде всего на throughput, cycles/byte, instructions/byte и
  code size.
- Scope каждого гейта фиксировать явно (алгоритмы, буферы, ядро, версии,
  железо, compiler) и не обобщать автоматически за его пределы.
- Overclaiming запрещён: формулировки вида «O2 универсально быстрее», «O3
  бесполезен», «O3 ломает cache performance», «LLVM 23 предпочитает O2»,
  «OpenSSL O3 сломан» ничем не доказаны и не используются.
- Рост `.text` создаёт потенциальный instruction-cache trade-off, но без
  прямой изоляции i-cache эффектов причинная связь «O3 медленнее из-за
  i-cache» не утверждается.

## Связанные записи

- [Decision record: `optimization-o2-o3.md`](../optimization-o2-o3/)
- [Measurement record: `o2-o3-benchmarks.md`](../o2-o3-benchmarks/)
- [Gate journal: `results.md`](../results/)
- [Обзор эксперимента: `README.md`](../)
