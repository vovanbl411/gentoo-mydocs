---
kind: reference
scope: system
status: historical
last_verified: null
verified_on: [asus-b5402]
---

# Оптимизация Clang 23 с помощью BOLT на Gentoo (Alder Lake)

> **Архив:** документ сохраняет исторический эксперимент с BOLT на LLVM 23
> для ASUS B5402. Эта конфигурация больше не является active policy системы.
> Команды нельзя применять как current setup без нового профилирования и
> проверки; результаты benchmark и конфигурация оставлены как historical
> record.

Текущее состояние CPU, toolchain и Portage описано в системных документах:

- [Оптимизация CPU](../src/content/docs/systems/asus-b5402/hardware/cpu-optimization.md);
- [Загрузка и Portage](../src/content/docs/systems/asus-b5402/system/boot-and-portage.md).

## Состояние на момент архивирования

На момент архивирования BOLT временно не использовался с 2026-07, live-слоты
LLVM 23/24 были удалены из системы, а основным toolchain оставался стабильный
LLVM 22 без BOLT. Возврат к BOLT был отложен до стабильного LLVM 23. Это
historical state и rationale того периода, а не описание current state
сегодня.

## Цель исторического эксперимента

Целью было создать монолитный C++ компилятор с профилированной бинарной
оптимизацией BOLT и использовать его как системный компилятор Gentoo на Alder
Lake.

## Исторические результаты benchmark сборки LLVM

Замеры проводились на процессоре Intel Core i7-1260P (Alder Lake), строго на P-ядрах (0-7), 8 потоков.

| Компилятор | Время сборки (Elapsed) | User Time (CPU) | Разница |
|------------|------------------------|-----------------|---------|
| Системный Clang | 28:32.71 | 13116.12s | Базовый уровень |
| BOLT Clang-23 | 20:26.99 | 9287.89s | -28.4% времени |

> **Исторический результат:** ускорение компиляции составило почти 30% при
> одновременном снижении суммарной нагрузки на процессор (User Time) на ~1 час
> в пересчёте на одно ядро. Внутренняя статистика dynostats показала сокращение
> прыжков вперёд (taken forward branches) на 81.3% и полное (100%) устранение
> PLT-вызовов. Это benchmark конкретного эксперимента, а не обещание
> производительности для других систем или workloads.

## Этап 1: Сборка "Монолита" (Инструментарий)

В рамках эксперимента BOLT требовал статической линковки без динамических
библиотек. Clang собирался со специальными релокациями.

### Конфигурация CMake

```bash
mkdir build-profile && cd build-profile

cmake -G Ninja ../llvm \
    -DCMAKE_BUILD_TYPE=Release \
    -DLLVM_ENABLE_PROJECTS="clang;lld;bolt" \
    -DLLVM_TARGETS_TO_BUILD="X86" \
    -DLLVM_USE_LINKER=lld \
    -DLLVM_ENABLE_LTO=Thin \
    -DLLVM_LINK_LLVM_DYLIB=OFF \
    -DLLVM_BUILD_LLVM_DYLIB=OFF \
    -DCMAKE_EXE_LINKER_FLAGS="-Wl,--emit-relocs -Wl,--build-id" \
    -DCMAKE_CXX_FLAGS="-march=alderlake -O3" \
    -DCMAKE_C_FLAGS="-march=alderlake -O3" \
    -DLLVM_ENABLE_RTTI=ON \
    -DLLVM_INCLUDE_TESTS=OFF

ninja -j 8
```

> **Важно**: Флаги `--emit-relocs` и `--build-id` критически необходимы для работы BOLT.

## Этап 2: Сбор профиля (Сбор данных)

Для обучения BOLT запускалась реальная тяжёлая компиляция с записью событий
LBR (Last Branch Record).

### Нюансы среды

- tmpfs в `/tmp` не использовался, так как файл `perf.data` мог быть огромным;
  `TMPDIR` переносился на физический диск.
- На Alder Lake выполнение изолировалось строго на P-ядрах через `taskset`,
  чтобы E-ядра не искажали профиль.

```bash
# Разогрев сборочной директории (2-3 минуты)
taskset -c 0-7 ninja -C /path/to/workload -j 8

# Запись профиля
doas env TMPDIR=$HOME/tmp/ taskset -c 0-7 perf record \
    -e cycles:u \
    -j any,u \
    -a -F 1000 \
    -- ninja -C /path/to/workload -j 8
```

## Этап 3: Агрегация данных (perf2bolt)

Сырой `perf.data` конвертировался в формат `.fdata`, понятный BOLT.

```bash
doas env TMPDIR=$HOME/tmp/ \
    perf2bolt $HOME/llvm-project/build-profile/bin/clang-23 \
    -p /path/to/workload/perf.data \
    -o $HOME/tmp/clang.fdata \
    -w $HOME/tmp/clang.yaml \
    -v 2
```

## Этап 4: Бинарная оптимизация (Магия BOLT)

Собранный профиль применялся к монолитному бинарнику Clang.

```bash
llvm-bolt $HOME/llvm-project/build-profile/bin/clang-23 \
    -o $HOME/llvm-project/build-profile/bin/clang-23.bolt \
    -data $HOME/tmp/clang.fdata \
    -reorder-blocks=ext-tsp \
    -reorder-functions=hfsort+ \
    -split-functions \
    -plt=all \
    -dyno-stats
```

- **ext-tsp**: Оптимальный алгоритм переупорядочивания блоков для Alder Lake.
- **split-functions**: Отделяет "горячий" код от кода обработки ошибок.

После завершения оригинальный бинарник подменялся:

```bash
mv bin/clang-23 bin/clang-23.pre-bolt
mv bin/clang-23.bolt bin/clang-23
```

## Этап 5: Интеграция в Gentoo

В исторической конфигурации оптимизированный toolchain копировался в `/opt`, а
для Portage создавался минимальный конфиг окружения без изменения системной
иерархии.

### 1. Перенос тулчейна

Сохранялась вся структура: includes, библиотеки и symlinks.

```bash
doas mkdir -p /opt/llvm-bolt
doas rsync -av --progress $HOME/llvm-project/build-profile/ /opt/llvm-bolt/
```

### 2. Настройка окружения Portage

Вместо одного монолитного `package.env` использовалась директория
`/etc/portage/package.env/` и несколько специализированных env-файлов в
`/etc/portage/env/`.

Файл: `/etc/portage/env/bolt-clang`

```makefile
CC="/opt/llvm-bolt/bin/clang"
CXX="/opt/llvm-bolt/bin/clang++"
```

Файл: `/etc/portage/env/llvm-bolt`

```makefile
LDFLAGS="${LDFLAGS} -fuse-ld=lld -Wl,-q"
```

Файл: `/etc/portage/env/p-cores`

```makefile
PORTAGE_SCHEDULING_COMMAND="taskset -pc 0-7"
MAKEOPTS="-j8 -l8"
CARGO_BUILD_JOBS="8"
RUSTFLAGS="${RUSTFLAGS} -C link-arg=-fuse-ld=mold"
```

Файл: `/etc/portage/env/ssd`

```makefile
PORTAGE_TMPDIR="/var/tmp/portage-disk"
```

### 3. Активация

Файл: `/etc/portage/package.env/00-toolchain`

```makefile
# LLVM core — BOLT + pinning
llvm-core/clang                     llvm-bolt  p-cores  ssd
llvm-core/lld                       llvm-bolt  p-cores  ssd
llvm-core/llvm                      llvm-bolt  p-cores  ssd
app-shells/bash                     llvm-22
```

Файл: `/etc/portage/package.env/10-performance`

```makefile
app-editors/zed           p-cores
*/*                       bolt-clang
de-qt/qtwebengine         bolt-profiling
sys-kernel/gentoo-kernel  kernel-llvm     p-cores
www-client/chromium       bolt-profiling
www-client/firefox        ssd p-cores llvm-22
```

## Historical conclusion

В рамках исторической конфигурации после этого `llvm-core/*` собирался
BOLT-компилятором с LLD на P-ядрах, а весь мир (`*/*`) использовал
`bolt-clang`. Остальные env-файлы (`p-cores`, `ssd`, `llvm-22`) добавлялись по
мере необходимости.

## Related docs

- [Оптимизация CPU на ASUS B5402](../src/content/docs/systems/asus-b5402/hardware/cpu-optimization.md)
- [Загрузка, toolchain и Portage на ASUS B5402](../src/content/docs/systems/asus-b5402/system/boot-and-portage.md)
