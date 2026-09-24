---
title: "Prompt для агента: LLVM 23 toolchain experiment"
kind: reference
scope: system
status: historical
last_verified: null
verified_on: [asus-b5402]
---

> **Исторический документ:** это исходный prompt, использованный для
> организации LLVM 23 experiment. Он сохраняется как provenance принятых
> решений и reasoning process. Experiment A и B уже завершены; инструкции
> «создай документы», «начни Gate A1» и другие шаги ниже не являются current
> next steps. Актуальный статус эксперимента см. в [README.md](../),
> фактические результаты — в [results.md](../results/).

Работай в репозитории `vovanbl411/gentoo-mydocs`, ветка
`docs/llvm23-toolchain-experiment`.

Перед любыми выводами прочитай:

- `DOCUMENTATION_POLICY.md`
- `CONTRIBUTING.md`
- `CHECKPOINT.md`
- `systems/asus-b5402/system/boot-and-portage.md`
- `experiments/llvm23-toolchain/index.md`

## Контекст

Эталонная машина — ASUS ExpertBook B5402, Intel Core i7-1260P, Gentoo hardened
systemd profile.

> **Historical baseline:** значения ниже были зафиксированы перед экспериментом
> и не описывают current system state сегодня.

Живой baseline перед экспериментом:

```text
CC=clang
CXX=clang++
AR=llvm-ar
NM=llvm-nm
RANLIB=llvm-ranlib

Clang 22.1.8

CFLAGS/CXXFLAGS:
-march=alderlake -O3 -flto=thin -pipe
-mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk

LDFLAGS:
-Wl,-O1 -Wl,--as-needed -fuse-ld=lld

Portage linker = LLD
Bare clang default linker = GNU ld.bfd
C++ stdlib = GCC 15 libstdc++
rtlib = libgcc
unwindlib = libgcc/libgcc_s
```

Проверено также:

```text
LLVM 23.1.1 установлен
LLD 23.1.1 установлен

/etc/clang/23/gentoo-linker.cfg:
-fuse-ld=bfd

/etc/clang/23/gentoo-rtlib.cfg:
--rtlib=libgcc

/etc/clang/23/gentoo-stdlib.cfg:
--stdlib=libstdc++

/etc/clang/23/gentoo-unwindlib.cfg:
--unwindlib=libgcc
```

Следующий `package.env` snapshot также относится к моменту подготовки
эксперимента. Слово «сейчас» в исходном prompt означает момент той фиксации, а
не current Portage state.

Аудит `package.env` показал 111 правил, связанных с
`gcc-fallback|problem-llvm|llvm-22|no-lto-llvm`, но это НЕ означает
111 несовместимых с LLVM пакетов.

Явный `gcc-fallback` сейчас применяется только к девяти пакетам:

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

Большая часть остальных правил — `no-lto-llvm` или другие точечные исключения.

## Общая цель

Не пытайся "сделать систему максимально LLVM" как самоцель.

Нужно отдельно проверить четыре независимых гипотезы:

> Это исходный набор гипотез. Впоследствии Experiment A и B были завершены, а
> Experiment C остаётся NOT STARTED. Гипотезы ниже не переписаны задним числом.

1. **LLVM 23 migration**  
   Насколько безопасно перевести основной compiler/linker stack с
   Clang/LLD 22 на Clang/LLD 23, сохранив GNU C++/runtime stack.

2. **Optimization policy**  
   Насколько оправдан глобальный `-O3` по сравнению с `-O2` при
   `-march=alderlake + ThinLTO`.

3. **LLVM runtimes**  
   Есть ли практический смысл после стабилизации LLVM 23 заменить
   `libgcc + libgcc_s` на `compiler-rt + libunwind`.

4. **C++ stdlib**  
   `libstdc++ -> libc++` считать отдельным поздним исследованием с
   повышенным ABI-риском. Не включать в первые фазы.

## Сначала задокументируй наш разбор

Ниже сохранены исходные инструкции по документации. Они уже выполнены, но
объясняют provenance и структуру созданных документов.

До первого изменения живой системы создай в
`experiments/llvm23-toolchain/` следующие документы.

### 1. `toolchain-primer.md`

Объясни простым, но технически точным языком пять независимых слоёв:

```text
compiler   → GCC / Clang
linker     → GNU ld.bfd / LLD
C++ stdlib → libstdc++ / libc++
rtlib      → libgcc / compiler-rt
unwinder   → libgcc_s / libunwind
```

Обязательно объясни:

- какую задачу выполняет каждый слой;
- почему Clang совершенно нормально работает с `libstdc++ + libgcc`;
- почему "собрать world Clang'ом" не означает "перейти на libc++";
- чем Portage-selected LLD отличается от default linker самого Clang;
- что меняют Gentoo USE-флаги:
  `default-lld`, `libcxx`, `default-libcxx`,
  `compiler-rt`, `default-compiler-rt`, `llvm-libunwind`;
- почему `libc++` — отдельное ABI-решение;
- какую конфигурацию реально имеет текущая машина.

Не превращай документ в энциклопедию LLVM. Цель — дать владельцу понятную
ментальную модель конкретно для дальнейшего эксперимента.

### 2. `optimization-o2-o3.md`

Зафиксируй отдельную гипотезу:

```text
сейчас:
-O3 global + ThinLTO

кандидат:
-O2 global + ThinLTO
и -O3 только для пакетов, где измерен полезный эффект
```

Объясни:

- что `-O3` является более агрессивным уровнем оптимизации, а не
  гарантированно более быстрым режимом;
- что современный LLVM умеет vectorization уже не только как уникальную
  особенность `-O3`;
- почему более агрессивный inlining/unrolling может увеличивать `.text`;
- почему рост code size может ухудшать instruction-cache locality;
- почему связку `-O3 + ThinLTO` нужно оценивать измерениями;
- почему нельзя одновременно менять LLVM 22→23 и O3→O2 при первом pilot:
  иначе теряется причинность результата.

Зафиксируй будущий отдельный A/B experiment:

```text
LLVM 23 + -O2 + ThinLTO
vs
LLVM 23 + -O3 + ThinLTO
```

Минимальные метрики:

- wall-clock build time;
- linker time, где его можно отделить;
- ELF `.text` / code size;
- runtime benchmark с воспроизводимым workload;
- peak memory, если измерение удобно;
- ошибки/предупреждения и необходимость исключений.

Не объявлять `-O2` или `-O3` победителем заранее.

### 3. Результаты

Создай `results.md` как журнал эксперимента.

Для каждого gate фиксируй:

- дату;
- исходную конфигурацию;
- точную изменяемую переменную;
- команды;
- релевантный вывод;
- PASS/FAIL;
- что доказано;
- что НЕ доказано;
- rollback/остаточные изменения;
- следующий минимальный gate.

Не копируй гигантские build logs целиком. Фиксируй воспроизводимые команды и
существенные результаты.

## Правила эксперимента

1. Не менять несколько независимых переменных одновременно.
2. Не удалять LLVM 22.
3. Не менять глобальный compiler/runtime stack на первом pilot.
4. Не снимать массово существующие `gcc-fallback` и `no-lto-llvm`.
5. Не считать `LLVM_COMPAT` прямым списком допустимых версий Clang:
   проверять, что именно он регулирует в конкретном ebuild/eclass.
6. Не обходить ограничения ebuild без отдельного анализа.
7. Не менять `default-libcxx`, `default-compiler-rt`,
   `llvm-libunwind` и `default-lld` в первой фазе.
8. Не менять `-O3` на `-O2` во время LLVM 22→23 pilot.
9. Команды, меняющие живую систему, выполняет владелец.
10. После каждого шага давать короткий вывод: что доказано, что не доказано,
    какой следующий минимальный gate.
11. Подтверждённые результаты в `systems/asus-b5402/` переносить только
    после завершения соответствующего gate.
12. Не обновлять `last_verified` на основании планов или предположений.

## Эксперимент A — LLVM 22 vs LLVM 23

Далее сохранён исходный план Experiment A. Фактические результаты находятся в
[results.md](../results/); Experiment A имеет статус COMPLETE.

### Gate A0 — baseline

Baseline уже снят и приведён выше. Проверь документацию против фактического
вывода пользователя и зафиксируй его в `results.md`.

### Gate A1 — один небольшой пакет

Первый кандидат: `media-libs/libde265`.

Цель:

```text
до:
Clang 22 + LLD 22 + -O3 + ThinLTO
+ libstdc++ + libgcc + libgcc_s

pilot:
Clang 23 + LLD 23 + -O3 + ThinLTO
+ libstdc++ + libgcc + libgcc_s
```

Меняются только compiler/linker.

Для pilot использовать абсолютные LLVM 23 paths:

```text
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
AR=/usr/lib/llvm/23/bin/llvm-ar
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib
```

Перед emerge сначала отдельной безвредной командой докажи, что:

```text
/usr/lib/llvm/23/bin/clang++ + -fuse-ld=lld
→ /usr/lib/llvm/23/bin/ld.lld
```

Также докажи, что defaults остаются:

```text
stdlib    = libstdc++
rtlib     = libgcc
unwindlib = libgcc
```

Только после этого подготовь одноразовый pilot build без создания постоянного
`env/llvm-23`.

Сохрани текущие:

```text
-march=alderlake
-O3
-flto=thin
```

После сборки проверить:

- VDB environment пакета;
- compiler provenance;
- linker provenance;
- ELF dynamic dependencies;
- `.text`/ELF size;
- базовый smoke test пакета, если применимо.

Не переходить к permanent `env/llvm-23`, пока Gate A1 не закрыт.

### Gate A2 и далее

После успешного A1 расширять выборку постепенно:

- небольшая C library;
- C++ library;
- пакет с ThinLTO;
- пакет из `no-lto-llvm`;
- более крупный desktop/system package.

Firefox не использовать как ранний pilot.

## Эксперимент B — O2 vs O3

Не начинать, пока LLVM 23 compiler/linker baseline не стабилизирован.

Сравнивать:

```text
LLVM 23 + -O2 + ThinLTO
LLVM 23 + -O3 + ThinLTO
```

на одинаковых пакетах и workloads.

Цель — проверить гипотезу о будущей политике:

```text
-O2 global
-O3 selective only where measured useful
```

Решение принимать по измерениям, а не по теории.

Последующие материалы Experiment B:

- [Гипотеза и decision record](../optimization-o2-o3/);
- [Методика benchmark](../benchmark-methodology/);
- [Данные B1–B4](../o2-o3-benchmarks/).

## Эксперимент C — runtimes

По текущему README Experiment C имеет статус NOT STARTED. Ниже сохранён его
исходный план; новый план в этом документе не создаётся.

Только после A и B отдельно исследовать:

```text
libgcc   -> compiler-rt
libgcc_s -> libunwind
```

Не смешивать этот переход с `libc++`.

## Конечный критерий

Эксперимент должен закончиться не формулировкой "максимально чистый LLVM", а
измеренной и поддерживаемой policy для этой конкретной Gentoo-машины:

- какой Clang/LLD использовать по умолчанию;
- `-O2` или `-O3` глобально;
- где оправданы package-specific exceptions;
- нужен ли `compiler-rt + libunwind`;
- какие пакеты объективно требуют GCC/LLVM22/no-LTO;
- какие исключения оказались историческими и могут быть удалены.

## Related records

- [README.md](../) — current experiment status;
- [results.md](../results/) — gate journal и фактические результаты;
- [optimization-o2-o3.md](../optimization-o2-o3/) — decision record;
- [o2-o3-benchmarks.md](../o2-o3-benchmarks/) — benchmark data.
