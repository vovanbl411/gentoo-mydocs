---
title: "Гипотеза: глобальный -O2 против глобального -O3 (Experiment B)"
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

## Статус и принятое решение

Experiment B — **COMPLETE**: B1–B4 завершены, а optimization policy decision
зафиксирован 2026-09-20 — global `-O2` + selective benchmark-proven `-O3`.
Политика применена к `/etc/portage` 2026-09-20, полный rebuild завершён
2026-09-21.

Результаты измерений находятся в
[o2-o3-benchmarks.md](o2-o3-benchmarks.md), журнал и решение — в
[results.md](results.md).

Остальная часть документа сохраняет исходную hypothesis и заранее заданный
experimental design, по которым принималось решение. Это decision/experiment
record; current production configuration находится в
[системной документации](../../systems/asus-b5402/system/boot-and-portage.md).

## 1. Исходный вопрос и experimental baseline

Исходный вопрос Experiment B: должен ли глобальный optimization baseline
системы оставаться `-O3`, или разумнее глобальный `-O2` с package-specific
`-O3` только там, где он даёт измеримый выигрыш?

| | Production baseline at experiment start | Candidate policy |
|--|-----------------------------------------|------------------|
| CFLAGS/CXXFLAGS | `-O3` глобально | `-O2` глобально |
| LTO | ThinLTO глобально где поддерживается | ThinLTO без изменений |
| Точечные исключения | `package.env` как есть | `-O3` только пакетам с измеренным выигрышем |

По заранее заданному design production policy не менялась до завершения
измерений, принятия решения и отдельного применения.

## 2. Почему -O3 — не гарантированно быстрее

- `-O3` — не другой набор оптимизаций, а более агрессивные пороги тех же
  трансформаций: выше пороги inlining, агрессивнее unrolling циклов, смелее
  параметры векторизации. Плата — размер кода.
- Векторизация давно не эксклюзив `-O3`: с LLVM 17 loop vectorizer включён и
  на `-O2`, SLP-векторизация на `-O2` в актуальных LLVM тоже активна. Разница
  «векторизуется или нет» между уровнями для большинства кодовых баз исчезла.
- Агрессивный inlining и unrolling раздувают `.text`. Каждая горячая функция
  занимает больше строк i-cache; при выходе за его границы растут промахи,
  падает плотность полезных инструкций, хуже работает prefetch.
- ThinLTO умножает эффект: кросс-модульный inlining подтягивает код из чужих
  TU, а `-O3`-пороги потом разворачивают уже его. Совместный рост кода может
  заметно превышать сумму отдельных эффектов.
- Дополнительная цена — время компиляции: больше инлайна — больше IR для
  оптимизации и линковки.

Вывод из этих рассуждений только один: выигрыш `-O3` обычно живёт в
compute-bound ядрах, а для типичного системного и desktop-кода он часто
нейтрален или отрицателен. Но это теория, а не результат — проверять
измерениями на этой машине.

## 3. Дизайн A/B

Главный принцип: в каждом A/B меняется ровно optimization level. Compiler
(Clang 23), linker (LLD 23), CPU target (`-march=alderlake`), LTO mode,
runtime libraries, версия пакета и benchmark workload остаются одинаковыми.

Условия:

- Experiment A (LLVM 23 compatibility) завершён 2026-09-20 — предусловие
  «сначала стабилизировать compiler/linker baseline» выполнено; B1 измерялся
  на Clang 23 + LLD 23.
- Одни и те же версии пакетов в обеих ветках.
- Сборки через `--buildpkgonly` в отдельные PKGDIR; живая система не меняется.
- Измеряемые сборки — либо без ccache, либо с одинаково холодным или
  обнулённым кэшем, иначе wall-clock несравним.
- Повторять или чередовать прогоны, чтобы отделить эффект от прогрева (page
  cache, tmpfs, ccache).

Канонические правила измерений и интерпретации вынесены в
[benchmark-methodology.md](benchmark-methodology.md); новые methodology rules
этот документ не добавляет.

## 4. Метрики

| Метрика | Как снимать |
|---------|-------------|
| build user/system/wall time | `/usr/bin/time -v` при `--buildpkgonly` |
| peak RSS | `/usr/bin/time -v` (Maximum resident set size) |
| `.text` и размер ELF | `size`, `stat` |
| binpkg size | `ls -l` в PKGDIR |
| runtime task-clock / cycles / instructions / IPC | `perf stat` на закреплённом ядре |
| branches / branch misses / cache refs+misses | `perf stat` |
| Ошибки/предупреждения | счётчики из build log; новые исключения `package.env` |

Где уместно — дополнительные domain-specific метрики workload'а.

## 5. План и критерии выбора пакетов

### Завершённые gates и rollout

| Gate | Класс workload | Статус |
|------|----------------|--------|
| B1 | compute-heavy codec (`media-libs/libde265-1.1.3`) | COMPLETE |
| B2 | compression/decompression (`app-arch/zstd-1.5.7-r1`) | COMPLETE |
| B3 | crypto (`dev-libs/openssl-3.5.8`, без LTO по политике ebuild) | COMPLETE |
| B4 | крупный desktop/graphics workload (`media-libs/mesa-26.2.2`) | COMPLETE |
| — | финальный review B1–B3 | COMPLETE (2026-09-20) |
| — | optimization policy decision | COMPLETE (2026-09-20) |
| — | применение политики к `/etc/portage` | COMPLETE (2026-09-20) |
| — | полный rebuild `@world` под `-O2` | COMPLETE (2026-09-21) |

B4 — последний гейт Experiment B; новых гейтов (B5) не планируется.

### Reusable criteria для будущих package-specific benchmark

Следующий список не является roadmap незавершённого B5. Это критерии выбора
пакетов для возможных будущих package-specific `-O3` benchmark:

- воспроизводимый runtime workload;
- одинаковая версия пакета в обеих ветках;
- одинаковый LLVM 23 toolchain, `-march=alderlake`, LTO mode и runtime
  libraries;
- меняется только `-O2` ↔ `-O3`;
- желательно реальные workloads, а не synthetic microbenchmarks;
- workload достаточно длинный, чтобы benchmark noise был существенно меньше
  измеряемой разницы.

## 6. Результаты B1–B4 (кратко)

B1 — libde265-1.1.3, single-thread HEVC decode (4+4 прогона, P-core):

```text
O3 runtime       ≈ 1.2% быстрее (task-clock -1.19%)
O3 instructions  ≈ 1.8% меньше
O3 libde265 .text ≈ 12.3% больше
```

B2 — zstd-1.5.7-r1, compression и decompression по одному corpus (4+4 прогона
на каждый путь, P-core):

```text
O3 libzstd .text ≈ 9.2% больше
O3 compression   ≈ 1–2% быстрее
O3 decompression ≈ 1–2% медленнее
```

Смешанный результат: `-O3` увеличил code footprint, улучшив один hot path и
ухудшив другой. Важное ограничение: package-specific `-O3` не выбирается
автоматически только потому, что пакет «performance-sensitive».

B3 — openssl-3.5.8, crypto (без LTO по политике ebuild `filter-lto`;
`openssl speed`, 4+4 сэмпла на алгоритм, P-core):

```text
AES-256-CTR:  преимущества O3 нет (≈ -0.17%, фактически ничья)
SHA-256:      O3 ≈ -0.5%
ChaCha20:     O3 ≈ -1%
libcrypto .text ≈ +2.62%, libssl .text ≈ +4.24%
```

> В протестированных OpenSSL crypto workload'ах `-O3` не дал измеримого
> преимущества над `-O2`, продолжая увеличивать размер кода.

B4 — mesa-26.2.2, shader-db на настоящей Iris Xe (без LTO по package policy;
4+4 прогона, P-core):

```text
runtime: измеримого преимущества O3 нет (mean ≈ -0.30% при CV O2 ≈ 4%)
libgallium .text ≈ +5.23%, libvulkan_intel ≈ +4.79%, hasvk ≈ +4.92%
binpkg ≈ +5.31%
```

Тенденция после четырёх классов workload (codec, compression/decompression,
crypto, desktop/graphics):

> `-O3` во всех протестированных классах увеличивал code footprint, а runtime
> benefit был небольшим, workload-specific, отсутствующим либо отрицательным.

На этом основании optimization policy decision принято (2026-09-20) — см.
«Критерий решения» ниже и [results.md](results.md).

Сводная таблица B1–B4, методика измерений (канонические правила и
интерпретационная рамка) и полные данные — в
[benchmark-methodology.md](benchmark-methodology.md) и
[o2-o3-benchmarks.md](o2-o3-benchmarks.md).

Политика применена к `/etc/portage` 2026-09-20: `make.conf` и env-файлы
переведены на `-O2`, resolver рассчитывается; полный rebuild `@world` под
`-O2` завершён 2026-09-21 (post-rebuild boot/runtime проверены).
Selective `-O3` rules не созданы. На этом checkpoint `env/llvm-23` не
существовал; это состояние experiment checkpoint, а не утверждение о текущей
системе.

## 7. Заранее заданный критерий решения

Этот критерий был сформулирован до получения итогов B1–B4 и отделён от
принятого решения ниже.

Кандидат на будущую политику: `-O2` глобально, `-O3` точечно там, где измерен
полезный эффект. Принять его можно, только если на представительном наборе
пакетов `-O2` заметно не проигрывает в рантайме и при этом выигрывает по
размеру кода или времени сборки, а кандидаты на точечный `-O3` подтверждены
измерениями по отдельности.

Если измерения покажут устойчивое преимущество `-O3` — глобальная политика
остаётся как есть. Переход только по данным.

Цель эксперимента — не доказать заранее превосходство `-O2` или `-O3`, а
определить разумную политику для конкретной машины.

### Принятое решение (2026-09-20)

Критерий выполнен по результатам B1–B4: `-O2` заметно не проигрывает в
рентайме на протестированном наборе (измеренные преимущества O3 были
небольшими: ≈1.2% в B1 и ≈1–2% на compression path B2; B2 при этом дал
смешанный результат, а во всех гейтах O3 увеличивал code footprint) и
однородно выигрывает по размеру кода; кандидатов на точечный `-O3`
измерения не выявили.

```text
global baseline:  -O2
ThinLTO:          остаётся глобально там, где package/ebuild policy допускает
-O3:             только package-specific после отдельного benchmark со
                  значимым и воспроизводимым практическим выигрышем
```

Selective `-O3` rules по итогам B1–B4 не создаются: libde265 —
weak/questionable (~1.2% за ~12.3% `.text`), zstd — смешанный результат,
OpenSSL и Mesa — без преимущества.

> Решение применено 2026-09-20: `make.conf` и env-файлы переведены на `-O2`,
> resolver рассчитывается. Полный `@world` rebuild под `-O2` завершён
> 2026-09-21; на этом checkpoint LLVM 23 rollout оставался следующим controlled
> шагом (NOT STARTED).

## Related records

- [Статус LLVM 23 experiment](index.md)
- [Каноническая методика benchmark](benchmark-methodology.md)
- [Полные данные B1–B4](o2-o3-benchmarks.md)
- [Журнал результатов и gates](results.md)
- [Toolchain-праймер](toolchain-primer.md)
- [Current system source of truth](../../systems/asus-b5402/system/boot-and-portage.md)
