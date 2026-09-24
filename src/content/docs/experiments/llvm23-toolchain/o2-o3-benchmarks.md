---
title: Бенчмарки -O2 vs -O3 (Experiment B)
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

Это measurement record Experiment B: здесь сохранены первичные данные,
derived metrics, методические примечания и ограничения B1–B4.

> **Статус**:
>
> - B1–B4 — COMPLETE;
> - final review — COMPLETE;
> - optimization policy decision — COMPLETE;
> - policy применена к `/etc/portage` 2026-09-20;
> - полный rebuild `@world` под `-O2` завершён 2026-09-21;
> - post-rebuild boot/runtime проверены.

Границы источников правды:

- текущее production-состояние системы — в
  [`../../systems/asus-b5402/system/boot-and-portage.md`](../../../systems/asus-b5402/system/boot-and-portage/);
- подробный decision record — в
  [optimization-o2-o3.md](../optimization-o2-o3/);
- каноническая методика — в
  [benchmark-methodology.md](../benchmark-methodology/);
- gate journal — в [results.md](../results/).

B1–B4 — это benchmark results, а не validation gates. «PASS» здесь не
используется: ни один optimization level не является «успехом теста».

## 1. Принцип измерений

В каждом A/B меняется ровно optimization level. Неизменны: compiler
(Clang 23), linker (LLD 23), `-march=alderlake`, LTO mode по package/ebuild
policy (ThinLTO в B1/B2, без LTO в B3/B4), libstdc++/libgcc/libgcc_s, версия
пакета и workload.

## 2. Методология сборки

- Обе версии собираются через `--buildpkgonly` в отдельные PKGDIR — живая
  система не затрагивается.
- Toolchain вызывается только absolute paths слота 23
  (`/usr/lib/llvm/23/bin/...`).
- На design/checkpoint-этапе до rollout decision постоянный `env/llvm-23` не
  создавался: rollout был отложен до решения по optimization baseline.

## 3. Методология runtime-измерений (B1)

Фиксированный HEVC benchmark:

```text
/tmp/libde265-bench.hevc
~21 MB, 1920x1080, 60 fps source, 30 секунд
```

Запуск:

```text
dec265 -q -t 1
```

- декодирование без вывода на экран;
- ровно один поток декодера.

CPU affinity:

```text
CPU 2 — P-core (core 1), max frequency 4.7 GHz; SMT-sibling — CPU 3
```

Процесс закреплён за CPU 2 через `taskset`. Счётчики — `perf stat`: task-clock,
cycles, instructions, branches, branch-misses, cache-references, cache-misses.

Порядок measured runs (перед ними обе версии прошли warm-up):

```text
1 O2, 2 O3, 3 O3, 4 O2, 5 O3, 6 O2, 7 O2, 8 O3
```

Итого 4 сэмпла на каждый уровень.

На гибридном Intel PMU строки вида `cpu_atom/... <not counted>` ожидаемы:
процесс закреплён за P-core. Валидные counters — `cpu_core/*` со 100%
measured time.

## 4. B1 — libde265-1.1.3

Почему выбран: compute-heavy codec; C++; подходит для real runtime benchmark;
поддерживает фиксированный HEVC bitstream; позволяет single-thread benchmark;
достаточно мал для повторяемых сборок.

### 4.1 Build cost (первичные timing'и)

| Метрика | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| User time | 67.89 s | 69.84 s | +2.87% |
| System time | 10.63 s | 11.26 s | +5.93% |
| Wall time | 27.42 s | 28.32 s | +3.28% |
| Max RSS | 182716 KiB | 184740 KiB | +1.11% |

> ⚠️ **Важный нюанс**: эти build-time цифры вспомогательные и не являются
> устойчивым benchmark: выполнено по одному build-run каждого варианта при
> различавшемся состоянии filesystem cache (`File system inputs`: O2 = 9720,
> O3 = 0). Вывод «O2 компилируется на 3.28% быстрее» делать нельзя. Для
> серьёзного build-time вывода нужны повторные controlled builds.

### 4.2 Code size

Это прямой и воспроизводимый результат двух готовых ELF.

`libde265.so`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 576615 | 3328 | 18275 | 582808 |
| O3 | 647595 | 3328 | 21011 | 653800 |
| O3 vs O2 | +12.31% | = | — | +12.18% |

`dec265`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 16632 | 1816 | 2048 | 21504 |
| O3 | 18492 | 1816 | 192 | 23360 |
| O3 vs O2 | +11.18% | = | — | +8.63% |

binpkg:

```text
O2 = 337920 байт, O3 = 368640 байт → +9.09%
```

Главное size-наблюдение: на этом workload `-O3` увеличил `.text` основной
библиотеки примерно на 12.3%. Это не «проблема» сама по себе — code growth
оценивается вместе с runtime performance.

### 4.3 Raw runtime samples

O2 (runs 1, 4, 6, 7):

| Counter | Run 1 | Run 4 | Run 6 | Run 7 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 21731.69 | 22003.41 | 21839.04 | 21814.05 |
| cycles | 46690276038 | 47255483294 | 46910346329 | 46946088203 |
| instructions | 141635129334 | 141635236109 | 141635425518 | 141635431312 |
| branches | 19642874220 | 19642888401 | 19642915757 | 19642910961 |
| branch-misses | 239842775 | 240134715 | 239459934 | 241801223 |
| cache-references | 942489409 | 950215150 | 943852950 | 948821984 |
| cache-misses | 687022658 | 693481193 | 691350274 | 692593020 |

O3 (runs 2, 3, 5, 8):

| Counter | Run 2 | Run 3 | Run 5 | Run 8 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 21588.60 | 21463.31 | 21698.80 | 21596.33 |
| cycles | 46461951992 | 46110277119 | 46614916994 | 46438829343 |
| instructions | 139073672292 | 139073298961 | 139072953284 | 139073137924 |
| branches | 20039257780 | 20039212216 | 20039168892 | 20039191967 |
| branch-misses | 236171520 | 236463037 | 237613644 | 237622513 |
| cache-references | 934415295 | 939829363 | 949502531 | 944262287 |
| cache-misses | 684544511 | 686057321 | 693593821 | 690624986 |

### 4.4 Derived (средние по 4 прогонам)

| Метрика | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| task-clock | 21.847 s | 21.587 s | -1.19% |
| cycles | 46.95 B | 46.41 B | -1.16% |
| instructions | 141.64 B | 139.07 B | -1.81% |
| IPC | ~3.017 | ~2.997 | -0.66% |
| branches | 19.64 B | 20.04 B | +2.02% |
| branch miss rate | ~1.223% | ~1.183% | чуть лучше |
| cache references | ~946.3 M | ~942.0 M | -0.46% |
| cache miss rate | ~73.03% | ~73.11% | практически без изменений |

Вариация сэмплов (task-clock): O2 CV ≈ 0.52%, O3 CV ≈ 0.45%.

Средняя effective frequency (cycles / task-clock): O2 ≈ 2.149 GHz,
O3 ≈ 2.150 GHz — практически одинаковая, поэтому измеренная разница не
выглядит следствием систематически разной средней частоты.

### 4.5 Интерпретация

Ключевой фактический результат:

```text
O3 runtime improvement ≈ 1.2%
O3 instructions        ≈ -1.8%
O3 libde265 .text      ≈ +12.3%
```

> Для этого конкретного single-thread libde265 HEVC decode workload `-O3` дал
> небольшой, но воспроизводимый runtime-выигрыш примерно 1.2%, одновременно
> увеличив `.text` основной библиотеки примерно на 12.3%.

Наблюдения:

- O3 выполняет меньше instructions и тратит немного меньше cycles;
- IPC у O3 немного ниже; branch count выше, но branch miss rate чуть лучше;
- cache miss rate практически не отличается;
- средняя effective CPU frequency одинаковая.

> ⚠️ **Важный нюанс**: не считать, что рост `.text` доказанно ухудшил
> instruction cache — текущие perf counters этого не доказали.

### 4.6 Значение для optimization policy

B1 усиливает гипотезу `global -O2 + selective -O3`: на compute-heavy codec O3
покупает небольшой runtime-выигрыш ценой заметно большего machine code
footprint. Но одного codec workload недостаточно, чтобы менять глобальную
optimization policy всей системы.

На checkpoint после B1 изменений в `make.conf`, `package.env` и
production-политике не было; package-specific `-O3` rule для libde265 не был
создан — на том этапе это был только experimental result. Выбор пакетов
следующих гейтов оставался за владельцем (критерии — в
[optimization-o2-o3.md](../optimization-o2-o3/)).

## 5. B2 — app-arch/zstd-1.5.7-r1

Класс workload: compression/decompression, C, real-world compression library
и CLI.

Почему выбран: принципиально другой workload по сравнению с codec B1; есть
реальные compression и decompression пути; используется один и тот же corpus;
runtime легко измерять single-thread; пакет небольшой и дешёвый для повторных
сборок.

Обе сборки: Clang 23 + LLD 23 + `-march=alderlake` + ThinLTO + одинаковый
runtime stack, версия пакета и USE/dependencies. Единственная намеренная
разница — `-O2` ↔ `-O3`. Сборки через `--buildpkgonly` в разные PKGDIR:
`/tmp/zstd-o2-pkgs` и `/tmp/zstd-o3-pkgs`.

### 5.1 Build cost (auxiliary observation)

| Метрика | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| User time | 91.75 s | 95.73 s | +4.34% |
| System time | 14.25 s | 14.58 s | +2.32% |
| Wall time | 38.08 s | 36.69 s | -3.65% |
| Max RSS | 204724 KiB | 216836 KiB | +5.92% |

> ⚠️ **Важный нюанс**: эти build-time результаты — не устойчивый benchmark:
> `File system inputs` различался (O2 = 15560, O3 = 0), CPU utilization тоже
> (O2 ≈ 278%, O3 ≈ 300%). Писать «O3 собирается быстрее» или «O2 собирается
> быстрее» как устойчивый вывод нельзя — только auxiliary observation.

### 5.2 Code size

`zstd` CLI:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 197973 | 4800 | 4032 | 205808 |
| O3 | 203330 | 4800 | 6864 | 211168 |
| O3 vs O2 | +2.71% | = | — | +2.60% |

`libzstd.so.1.5.7`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 832540 | 2424 | 4000 | 837784 |
| O3 | 909186 | 2408 | 1088 | 914424 |
| O3 vs O2 | +9.21% | ≈ | — | +9.15% |

Главный size-результат B2: основная `libzstd.so` при `-O3` выросла примерно
на 9.2% по `.text`.

### 5.3 Corpus и изоляция

Реальный corpus из исходников текущего Linux kernel tree:

```text
/usr/src/linux → включены include, kernel, mm, fs
/tmp/zstd-bench-kernel.tar      ~53 MB (tar)
/tmp/zstd-bench-kernel.tar.zst  ~11 MB (compressed reference, zstd -3 -T1)
```

Обе экспериментальные версии запускались со своими библиотеками через
`LD_LIBRARY_PATH`; подтверждено: O2-исполняемый файл использует O2-`libzstd`,
O3 — O3-`libzstd`. Случайное использование установленной системной
`libzstd` исключено. sha256 результатов в записи не фиксировался — значение
не подставляется.

### 5.4 Методология runtime

Как и в B1: CPU 2 (P-core), `taskset -c 2`, `perf stat`, warm-up обеих
версий, порядок measured runs `1 O2, 2 O3, 3 O3, 4 O2, 5 O3, 6 O2, 7 O2,
8 O3` — 4 сэмпла на уровень. Счётчики `cpu_core/*` (task-clock, cycles,
instructions, branches, branch-misses, cache-references, cache-misses).

Повторы внутри одного measured run:

```text
compression:   zstd -3 -T1, 50 повторов
decompression: zstd -d,      150 повторов
```

Compression и decompression измерялись отдельно.

### 5.5 Raw compression samples

O2 (runs 1, 4, 6, 7):

| Counter | Run 1 | Run 4 | Run 6 | Run 7 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 18286.78 | 18497.96 | 18374.85 | 18439.38 |
| cycles | 35530101132 | 35956814961 | 35790875150 | 35897949117 |
| instructions | 71524689048 | 71799279991 | 71711122335 | 71583323202 |
| branches | 7409139778 | 7474375647 | 7453762900 | 7422987741 |
| branch-misses | 279061831 | 279023257 | 279036896 | 279302147 |
| cache-references | 1219579285 | 1171009639 | 1194789038 | 1265494373 |
| cache-misses | 172547809 | 185006451 | 182128247 | 170231124 |

O3 (runs 2, 3, 5, 8):

| Counter | Run 2 | Run 3 | Run 5 | Run 8 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 18077.36 | 17227.58 | 19000.05 | 18116.24 |
| cycles | 35274746771 | 34422881748 | 36839070554 | 35149848483 |
| instructions | 70085531557 | 69838802299 | 69806564589 | 69172273018 |
| branches | 7241342218 | 7181959381 | 7174395814 | 7022218791 |
| branch-misses | 278028365 | 277749107 | 278357603 | 278082232 |
| cache-references | 1241326989 | 1206209761 | 1193935364 | 1242888787 |
| cache-misses | 163883144 | 173585391 | 207527397 | 168301335 |

### 5.6 Derived compression (средние по 4 прогонам)

| Метрика | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| task-clock | ~18.400 s | ~18.105 s | ~-1.60% |
| median task-clock | ~18.407 s | ~18.097 s | ~-1.69% |
| cycles | ~35.79 B | ~35.42 B | ~-1.04% |
| instructions | ~71.65 B | ~69.73 B | ~-2.69% |
| IPC | ~2.002 | ~1.968 | ~-1.67% |
| branches | ~7.440 B | ~7.155 B | ~-3.83% |
| branch miss rate | ~3.75% | ~3.89% | немного хуже |
| cache miss rate | ~14.63% | ~14.60% | практически без изменений |

Вариация сэмплов (task-clock): O2 CV ≈ 0.49%, O3 CV ≈ 4.00%.

> Compression с `-O3` примерно на 1–2% быстрее на этом workload, но вариация
> O3-сэмплов заметно выше, чем O2 (в основном за счёт run 5), поэтому точную
> величину выигрыша не следует завышать.

Наблюдения: O3 выполняет меньше instructions и тратит меньше cycles; IPC чуть
ниже; branch count ниже; branch miss rate немного хуже; cache miss rate
фактически без изменений.

### 5.7 Raw decompression samples

O2 (runs 1, 4, 6, 7):

| Counter | Run 1 | Run 4 | Run 6 | Run 7 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 13789.92 | 13712.38 | 14209.12 | 13798.00 |
| cycles | 26384291959 | 26267484060 | 27120061864 | 26308901048 |
| instructions | 94824041918 | 94824066908 | 94824061984 | 94824022872 |
| branches | 10298262278 | 10298257328 | 10298266523 | 10298261676 |
| branch-misses | 223569056 | 222822396 | 223932994 | 223363940 |
| cache-references | 311863508 | 300013735 | 307793287 | 314804547 |
| cache-misses | 53753848 | 52540086 | 71666073 | 48958518 |

O3 (runs 2, 3, 5, 8):

| Counter | Run 2 | Run 3 | Run 5 | Run 8 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 13774.02 | 14057.35 | 14809.65 | 13895.89 |
| cycles | 26449476930 | 26881085468 | 28257910205 | 26537616338 |
| instructions | 94756939397 | 94756946738 | 94756932413 | 94756893507 |
| branches | 10262609884 | 10262605340 | 10262609410 | 10262605615 |
| branch-misses | 234970867 | 234680362 | 234907628 | 234483988 |
| cache-references | 316081454 | 310299468 | 318353459 | 317565939 |
| cache-misses | 48256530 | 60574041 | 90462898 | 50120655 |

### 5.8 Derived decompression (средние по 4 прогонам)

| Метрика | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| task-clock | ~13.877 s | ~14.134 s | ~+1.85% |
| median task-clock | ~13.794 s | ~13.977 s | ~+1.32% |
| cycles | ~26.52 B | ~27.03 B | ~+1.93% |
| instructions | ~94.824 B | ~94.757 B | ~-0.07% |
| IPC | ~3.576 | ~3.505 | ~-1.96% |
| branches | ~10.298 B | ~10.263 B | ~-0.35% |
| branch miss rate | ~2.17% | ~2.29% | хуже |
| cache metrics | noisy | noisy | без уверенного вывода |

> Decompression с `-O3` примерно на 1–2% медленнее, при почти неизменном
> количестве instructions.

Главная observation: O3 не уменьшил instruction count на decompression
сколько-нибудь значимо, но потребовал больше cycles; IPC ниже, branch miss
rate хуже, измеренный runtime медленнее. По cache-счётчикам decompression
заметный шум — глубокий вывод по ним не делается.

### 5.9 Frequency sanity check

Средняя effective frequency (cycles / task-clock):

```text
Compression:   O2 ≈ 1.945 GHz, O3 ≈ 1.956 GHz
Decompression: O2 ≈ 1.911 GHz, O3 ≈ 1.912 GHz
```

> Различия runtime не объясняются систематической разницей средней частоты
> O2/O3.

### 5.10 Центральный результат B2

```text
libzstd .text:  O3 ≈ +9.2%
compression:    O3 ≈ 1–2% быстрее
decompression:  O3 ≈ 1–2% медленнее
```

> `-O3` существенно увеличил code footprint основной библиотеки, дав при
> этом смешанные runtime-результаты: небольшое улучшение compression и
> небольшую деградацию decompression.

Это более важный результат, чем любой отдельный perf counter.

### 5.11 Интерпретация

B2 показал принципиальную вещь:

> Даже внутри одного пакета `-O3` может улучшить один hot path и ухудшить
> другой.

Отсюда: даже package-specific `-O3` нельзя автоматически считать идеальной
policy только потому, что пакет «performance-sensitive». Неверно и обратное —
«O3 всегда плох» или «O2 всегда лучше». Правильный вывод:

> Optimization level должен оцениваться по реальному workload mix и
> измеренному trade-off, а не по предположению, что более высокий optimization
> level автоматически лучше.

> ⚠️ **Важный нюанс**: больший `.text` создаёт потенциальный
> instruction-cache trade-off, но этот benchmark напрямую эффекты
> instruction cache не изолировал — причинный вывод «O3 медленнее из-за
> большего i-cache footprint» не доказан.

## 6. B3 — dev-libs/openssl-3.5.8

Класс: cryptography; C / assembly-heavy; production crypto implementation.
B3 добавляет третий класс workload к исследованию: codec (B1),
compression/decompression (B2), crypto (B3).

### 6.1 Особенность Gentoo OpenSSL build policy

Gentoo ebuild OpenSSL самостоятельно выполняет `filter-lto` и убирает ThinLTO
из build flags: upstream OpenSSL не рассматривает LTO как нормально
поддерживаемую и регулярно тестируемую конфигурацию. Поэтому:

```text
B1: ThinLTO
B2: ThinLTO
B3: без LTO — по политике ebuild, одинаково для обеих веток
```

Это не недостаток эксперимента: B3 проверяет O2/O3 ещё в одной реальной
production configuration (Rule 3 методики — package-native policy
сохраняется).

### 6.2 Controlled-variable design

Одинаково в обеих ветках: `dev-libs/openssl-3.5.8`; Clang 23; LLD 23;
`-march=alderlake`; runtime/dependencies; конфигурация пакета; LTO отключён
ebuild'ом. Единственная намеренная разница — `-O2` ↔ `-O3`.

### 6.3 Provenance

Обе сборки — `--buildpkgonly`:

```text
O2: /tmp/openssl-o2-pkgs/dev-libs/openssl/openssl-3.5.8-1.gpkg.tar
O3: /tmp/openssl-o3-pkgs/dev-libs/openssl/openssl-3.5.8-1.gpkg.tar
```

Environment обеих веток (различие — только уровень оптимизации):

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS = -march=alderlake -O2|-O3 -pipe -mno-kl -mno-pconfig
         -mno-sgx -mno-widekl -mshstk -Qunused-arguments
         -fno-strict-aliasing -Wa,--noexecstack
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld
```

> ⚠️ **Важный нюанс**: `-flto=thin` отсутствует в обеих ветках — такова
> политика ebuild. B3 — чистое O2/O3-сравнение без LTO.

### 6.4 Build cost (auxiliary observation)

| Метрика | O2 | O3 |
|---------|----|----|
| User time | 751.77 s | 751.57 s |
| System time | 256.78 s | 256.22 s |
| Wall time | 5:21.60 | 4:23.87 |
| Max RSS | 153008 KiB | 153228 KiB |
| CPU usage | 313% | 381% |

```text
O2: filesystem inputs 5160, outputs 105216
O3: filesystem inputs 3120, outputs 800
```

> ⚠️ **Важный нюанс**: меньший wall-clock у O3 НЕ доказывает, что O3
> компилируется быстрее. User time и system time практически идентичны, CPU
> utilization и filesystem state/outputs сильно различались, выполнено по
> одному build-run каждого варианта. Build-time данные остаются
> вспомогательными.

### 6.5 Code size

`openssl` CLI:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 998556 | 108000 | 22056 | 1109584 |
| O3 | 1012212 | 108000 | 20728 | 1123232 |
| O3 vs O2 | +1.37% | = | — | +1.23% |

`libcrypto.so.3`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 5489884 | 496424 | 14904 | 5989928 |
| O3 | 5633716 | 496296 | 14376 | 6133816 |
| O3 vs O2 | +2.62% | ≈ | — | +2.40% |

`libssl.so.3`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 985286 | 53116 | 3120 | 1041264 |
| O3 | 1027022 | 53084 | 2368 | 1082976 |
| O3 vs O2 | +4.24% | ≈ | — | +4.01% |

Сравнение главных библиотек B1–B3:

```text
B1 libde265:  O3 main-library .text ≈ +12.3%
B2 libzstd:   O3 main-library .text ≈ +9.2%
B3 libcrypto: O3 main-library .text ≈ +2.6%
```

Magnitude code growth зависит от пакета/workload; вывод «O3 всегда
увеличивает `.text` на одинаковую величину» был бы неверен.

### 6.6 Isolation

Обе версии запускались со своими библиотеками через `LD_LIBRARY_PATH`:

```text
O2: libssl.so.3, libcrypto.so.3
    → /tmp/openssl-o2-image/image/usr/lib64/
O3: libssl.so.3, libcrypto.so.3
    → /tmp/openssl-o3-image/image/usr/lib64/
```

Случайное использование установленного системного OpenSSL исключено.

### 6.7 Runtime-методология

Штатный бенчмарк `openssl speed`. Алгоритмы и причины выбора:

```text
AES-256-CTR — hardware-accelerated / heavily optimized crypto path
SHA-256     — digest workload
ChaCha20    — stream cipher, другие характеристики реализации
```

Параметры: буфер 16384 байт, окно измерения 10 секунд
(`-elapsed -seconds 10 -bytes 16384 -mr -evp <algorithm>`). Среда запуска:
`taskset -c 2` (P-core), `LD_LIBRARY_PATH` своей ветки,
`OPENSSL_CONF=/dev/null` — для снижения влияния системной конфигурации
OpenSSL.

Warm-up: 2-секундный `openssl speed` на каждый алгоритм для каждой ветки (то
же CPU, алгоритм, размер буфера); в measured samples не входит.

Порядок measured runs — симметричный, на каждый алгоритм:

```text
1 O2, 2 O3, 3 O3, 4 O2, 5 O3, 6 O2, 7 O2, 8 O3
```

4 сэмпла каждого уровня на каждый crypto workload. Порядок уменьшает
systematic warm/cold bias и влияние gradual thermal drift, не запускает
сначала все сэмплы одного уровня. Параллельно — `perf stat` со счётчиками
`cpu_core/*` (процесс закреплён за P-core, гибридные `cpu_atom` счётчики не
применяются).

> ⚠️ **Ключевой методологический пункт — time-based semantics**: `openssl
> speed` выполняет работу фиксированное время (10 секунд), а не фиксированный
> объём данных. Более быстрый вариант за те же 10 секунд обрабатывает больше
> данных, поэтому raw cycles/instructions/branches между O2 и O3 нельзя
> напрямую сравнивать как «необходимую работу». Raw perf totals используются
> только вместе с throughput; счётчики нормализуются на обработанный байт
> (`cycles/byte`, `instructions/byte`, `branches/byte`), а processed bytes
> берутся из throughput/operation count.

### 6.8 Raw throughput samples

AES-256-CTR, B/s:

| Ветка | s1 | s2 | s3 | s4 |
|-------|----|----|----|----|
| O2 (runs 1,4,6,7) | 4469612544.00 | 4504633344.00 | 4531491635.20 | 4533325004.80 |
| O3 (runs 2,3,5,8) | 4520530739.20 | 4528771891.20 | 4475356774.40 | 4484456448.00 |

SHA-256, B/s:

| Ветка | s1 | s2 | s3 | s4 |
|-------|----|----|----|----|
| O2 (runs 1,4,6,7) | 1039613952.00 | 1043352780.80 | 1037153075.20 | 1046799974.40 |
| O3 (runs 2,3,5,8) | 1039281356.80 | 1043116851.20 | 1033946726.40 | 1028004249.60 |

ChaCha20, B/s:

| Ветка | s1 | s2 | s3 | s4 |
|-------|----|----|----|----|
| O2 (runs 1,4,6,7) | 1806598144.00 | 1788937830.40 | 1810109235.20 | 1819310489.60 |
| O3 (runs 2,3,5,8) | 1810718720.00 | 1815112908.80 | 1762911846.40 | 1751713382.40 |

### 6.9 Derived throughput

AES-256-CTR:

| Метрика | O2 | O3 |
|---------|----|----|
| mean | 4509765632 B/s | 4502278963 B/s |
| O3 vs O2 (mean) | ≈ -0.17% | |
| median | ≈ 4.518 GB/s | ≈ 4.502 GB/s |
| CV | ≈ 0.66% | ≈ 0.58% |

> AES-256-CTR — фактически статистическая ничья на этом размере выборки:
> доказательств значимого преимущества O3 нет. «O2 быстрее на 0.17%» писать
> нельзя — разница меньше обычной наблюдаемой вариации сэмплов.

SHA-256:

| Метрика | O2 | O3 |
|---------|----|----|
| mean | 1041729945.6 B/s | 1036087296.0 B/s |
| O3 vs O2 (mean) | ≈ -0.54% | |
| median difference | ≈ -0.47% | |
| CV | ≈ 0.41% | ≈ 0.63% |

> Преимущества O3 на SHA-256 нет: измеренный throughput O3 примерно на 0.5%
> ниже, но величина остаётся малой.

ChaCha20:

| Метрика | O2 | O3 |
|---------|----|----|
| mean | 1806238924.8 B/s | 1785114214.4 B/s |
| O3 vs O2 (mean) | ≈ -1.17% | |
| median difference | ≈ -1.19% | |
| CV | ≈ 0.70% | ≈ 1.82% |

> ChaCha20 показал наибольшую регрессию O3 из workload'ов B3 — примерно 1%,
> но вариативность O3-сэмплов заметно выше O2. Писать «O3 ровно на 1.17%
> медленнее» нельзя; корректно — «примерно на 1% медленнее в этой
> benchmark-сессии».

### 6.10 Нормализация perf (на обработанный байт)

Приблизительные нормализованные значения:

| Метрика | AES O2 | AES O3 | SHA O2 | SHA O3 | ChaCha O2 | ChaCha O3 |
|---------|--------|--------|--------|--------|-----------|-----------|
| cycles/byte | ≈0.47883 | ≈0.47799 | ≈2.07533 | ≈2.07644 | ≈1.18964 | ≈1.20216 |
| instructions/byte | ≈1.67512 | ≈1.67512 | ≈2.73894 | ≈2.73815 | ≈3.13522 | ≈3.13523 |
| IPC | ≈3.498 | ≈3.505 | ≈1.3198 | ≈1.3187 | ≈2.635 | ≈2.608 |
| effective frequency | ≈2.172 GHz | ≈2.175 GHz | ≈2.173 GHz | ≈2.170 GHz | ≈2.172 GHz | ≈2.172 GHz |

Интерпретация по алгоритмам:

- AES-256-CTR: O2 и O3 выполняют практически одинаковую instruction-работу на
  байт; compiler optimization level влияет на этот heavily optimized crypto
  hot path очень слабо.
- SHA-256: разница instructions/byte ≈ -0.03% — практически отсутствует.
- ChaCha20: instructions/byte практически идентичны, cycles/byte у O3 ≈ +1.05%
  — хорошо согласуется с измеренной throughput-регрессией.

> ⚠️ **Важный нюанс**: не утверждать без доказательств, что весь AES-путь
> выполняется исключительно ассемблером. Корректная формулировка:
> AES-реализации OpenSSL сильно оптимизированы и часто используют
> архитектурно-специфичный код, что может сокращать долю hot-path работы,
> зависящую от generic оптимизаций компилятора. Этот benchmark согласуется с
> такой возможностью, но не изолирует её напрямую.

### 6.11 Frequency sanity check и cache-счётчики

Средняя effective frequency во всех workload'ах была примерно одинаковой
(~2.17 GHz), различия O2/O3 очень малы:

> Измеренные различия throughput не объясняются систематическим O2/O3-смещением
> средней частоты CPU. Thermal effects полностью не исключены.

Branch/cache счётчики также собирались, но: значения generic cache events
сравнительно шумные; B3 не проектировался под изоляцию конкретных событий
cache-иерархии; семантика Intel hybrid PMU усложняет глубокую интерпретацию
generic cache counters. Сильных причинных выводов о cache behaviour из B3 не
делается; central decision опирается прежде всего на throughput, cycles/byte,
instructions/byte и code size.

### 6.12 Главный результат B3

```text
AES-256-CTR: преимущества O3 нет (mean ≈ -0.17%, фактически ничья)
SHA-256:     O3 ≈ -0.5%
ChaCha20:    O3 ≈ -1%

libcrypto .text ≈ +2.62%
libssl    .text ≈ +4.24%
openssl CLI .text ≈ +1.37%
```

> В протестированных OpenSSL crypto workload'ах `-O3` не дал измеримого
> преимущества по производительности над `-O2`, продолжая увеличивать размер
> кода.

### 6.13 Ограничение scope

B3 проверил только: AES-256-CTR, SHA-256, ChaCha20; буферы 16 KiB; один
P-core; single-process `openssl speed`; OpenSSL 3.5.8; Intel Core i7-1260P;
Clang 23. Результаты относятся именно к этому scope и не обобщаются
автоматически на RSA, ECDSA, TLS handshakes, меньшие буферы, multi-threaded
workload'ы, ARM, другие версии OpenSSL и другие crypto-библиотеки.

## 7. B4 — media-libs/mesa-26.2.2

Класс: крупная desktop/graphics codebase (C/C++), production-пакет. B4 —
последний benchmark Experiment B: закрывает покрытие большим graphics-стеком
после codec (B1), compression/decompression (B2) и crypto (B3).

### 7.1 Controlled-variable gate

Обе Mesa собраны через `--buildpkgonly` в отдельные PKGDIR:

```text
compiler/linker:  Clang 23 + LLD 23 (absolute paths слота 23)
CPU target:       -march=alderlake
LTO:              -fno-lto — по package policy (no-lto-llvm), одинаково
                  в обеих ветках
LLVM dependency:  slot 22
runtime:          GNU (libstdc++/libgcc/libgcc_s) сохранён
```

Normalized metadata diff O2/O3 пустой: единственная намеренная разница —
`-O2` ↔ `-O3`. Production-система во время benchmark не переводилась ни на
один из уровней; Mesa из binpkg не устанавливалась.

### 7.2 Build observations (auxiliary)

| Метрика | O2 | O3 |
|---------|----|----|
| User time | 2047.09 s | 2029.39 s |
| System time | 237.17 s | 230.23 s |
| Wall time | 9:03.04 | 8:46.35 |
| Max RSS | 2669700 KiB | 2666704 KiB |

> ⚠️ **Важный нюанс**: по одному build-run на вариант. Не утверждать, что O3
> компилируется быстрее — build timing остаётся auxiliary observation
> (Rule 14 методики).

### 7.3 Code size

Binpkg:

```text
O2 = 23132160 байт, O3 = 24360960 байт → +5.31%
```

ELF `.text`:

| ELF | O2 | O3 | O3 vs O2 |
|-----|----|----|----------|
| libgallium-26.2.2.so | 32216535 | 33902507 | +5.23% |
| iris_dri.so | 68826 | 68858 | ~+0.05% |
| libvulkan_intel.so | 24704045 | 25886606 | +4.79% |
| libvulkan_intel_hasvk.so | 18767275 | 19691023 | +4.92% |

На крупной production graphics codebase `-O3` снова заметно увеличивает code
footprint; `iris_dri.so` — практически без роста.

### 7.4 Runtime-методология

Workload — Mesa shader-db на фиксированном shader corpus:

```text
GPU:           настоящий Intel Alder Lake-P GT2 / Iris Xe [8086:46a6]
Driver:        real iris userspace driver
Mesa-деревья:  собственные O2/O3-сборки через LIBGL_DRIVERS_PATH и
               LD_LIBRARY_PATH
CPU:           2 (P-core), -j1
Shader cache:  disabled
Warm-up:       перед measured runs, в сэмплы не входит
Порядок:       O2, O3, O3, O2, O3, O2, O2, O3 — 4 measured samples на вариант
```

Для анализа использовались только счётчики `cpu_core/*`; `cpu_atom/*` для
итогового вывода не применяются — workload закреплён за P-core.

### 7.5 Derived runtime

| Метрика | O2 | O3 | O3 vs O2 |
|---------|----|----|----------|
| task-clock mean | 108.942 s | 108.617 s | ≈ -0.30% |
| task-clock median | 106.569 s | 108.964 s | — |
| task-clock CV | ≈ 4.04% | ≈ 1.20% | — |
| cycles | ≈ 200.78 B | ≈ 196.58 B | ≈ -2.09% |
| instructions | ≈ 500.78 B | ≈ 485.53 B | ≈ -3.04% |
| IPC | ≈ 2.494 | ≈ 2.470 | — |
| branches | ≈ 92.46 B | ≈ 89.60 B | ≈ -3.09% |
| branch miss rate | ≈ 1.718% | ≈ 1.764% | — |
| effective frequency | ≈ 1.845 GHz | ≈ 1.810 GHz | — |

Сырые O2 task-clock samples: 106.453, 116.552, 106.076, 106.685 s — один
сэмпл (116.552) заметно шумнее остальных. Постфактум он не удаляется;
высокая вариация O2 (CV ≈ 4%) учтена в интерпретации.

### 7.6 Интерпретация

> B4 не обнаружил измеримого runtime-преимущества `-O3` над `-O2`.

- Mean task-clock отличается на ≈ 0.3% при CV O2 ≈ 4% — разница глубоко
  внутри обычного шума; mean и median при этом расходятся по знаку.
- `-O3` выполнял меньше instructions, cycles и branches, но это не
  трансформировалось в доказанный runtime benefit.
- Средняя effective frequency различалась (O2 ≈ 1.845 GHz, O3 ≈ 1.810 GHz) —
  это наблюдаемый факт, а не доказанная причина результата.

Формулировки «O3 быстрее на 0.3%», «O2 быстрее на 2.25%» и причинные
объяснения результата разницей частоты CPU не используются.

### 7.7 Ограничение scope

B4 проверил только: Mesa shader-db на одном фиксированном shader corpus;
настоящий iris userspace driver на Intel Alder Lake-P GT2 / Iris Xe
[8086:46a6]; один P-core (CPU 2), `-j1`; shader cache disabled; Mesa 26.2.2
без LTO по package policy; Clang 23. Результат не обобщается автоматически на
другие драйверы (hasvk, zink, swrast), игровые, video- и compute-workload'ы,
multi-thread, E-core и другие версии Mesa.

## 8. Сводный вид B1–B4

| Gate | Workload | LTO | O3 runtime | O3 code size |
|------|----------|-----|------------|--------------|
| B1 | libde265 HEVC decode | ThinLTO | ~1.2% быстрее | ~+12.3% `.text` |
| B2-C | zstd compression | ThinLTO | ~1–2% быстрее | ~+9.2% lib `.text` |
| B2-D | zstd decompression | ThinLTO | ~1–2% медленнее | те же ~+9.2% |
| B3-AES | AES-256-CTR | no LTO | фактически ничья | libcrypto ~+2.6% |
| B3-SHA | SHA-256 | no LTO | ~0.5% медленнее | libcrypto ~+2.6% |
| B3-ChaCha | ChaCha20 | no LTO | ~1% медленнее | libcrypto ~+2.6% |
| B4 | Mesa shader-db | no LTO | измеримого преимущества нет | крупные ELF ~+5% `.text`, binpkg +5.31% |

Тенденция после четырёх существенно разных классов workload:

> `-O3` во всех протестированных классах увеличивал code footprint, а runtime
> benefit был небольшим, workload-specific, отсутствующим либо отрицательным.

Это итог Experiment B. Зафиксированное решение — в
[optimization-o2-o3.md](../optimization-o2-o3/) § 7 и [results.md](../results/).

Что покрыто исследованием: C и C++; workload'ы с ThinLTO и без LTO; codec,
compression, decompression, crypto, крупная desktop/graphics codebase;
fixed-work и time-based throughput benchmarks; малые/средние библиотеки и
большой production package. Experiment B не является одним synthetic
microbenchmark.

Изменение в production-политике: optimization policy decision (2026-09-20)
применено к `/etc/portage` — глобальный baseline теперь `-O2`
(`make.conf` и env-файлы переведены, resolver рассчитывается); полный
rebuild `@world` под `-O2` завершён 2026-09-21 (post-rebuild boot/runtime
проверены). Selective rules не созданы. На зафиксированном в этом отчёте
checkpoint `env/llvm-23` не существовал; это историческое состояние
эксперимента, а не утверждение о текущей системе.
