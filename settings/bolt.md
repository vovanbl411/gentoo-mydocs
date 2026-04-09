# Оптимизация Clang 23 с помощью BOLT на Gentoo (Alder Lake)

Цель: Создание бескомпромиссно быстрого, монолитного C++ компилятора путем применения профилированной бинарной оптимизации (BOLT) для использования в качестве системного компилятора в Gentoo.

## Итоговые результаты (Бенчмарк сборки LLVM)

Замеры проводились на процессоре Intel Core i7-1260P (Alder Lake), строго на P-ядрах (0-7), 8 потоков.

| Компилятор | Время сборки (Elapsed) | User Time (CPU) | Разница |
|------------|------------------------|-----------------|---------|
| Системный Clang | 28:32.71 | 13116.12s | Базовый уровень |
| BOLT Clang-23 | 20:26.99 | 9287.89s | -28.4% времени |

> **Достижение**: Ускорение компиляции почти на 30% при одновременном снижении суммарной нагрузки на процессор (User Time) на ~1 час в пересчете на одно ядро. Внутренняя статистика dynostats показала сокращение прыжков вперед (taken forward branches) на 81.3% и полное (100%) устранение PLT-вызовов.

## Этап 1: Сборка "Монолита" (Инструментарий)

BOLT требует статической линковки без динамических библиотек. Собираем Clang со специальными релокациями.

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

## Этап 2: Сбор профиля (Жатва данных)

Для обучения BOLT запускаем реальную тяжелую компиляцию, записывая события LBR (Last Branch Record).

### Нюансы среды

- Избегаем tmpfs в /tmp, так как файл perf.data будет огромным. Экспортируем TMPDIR на физический диск.
- На Alder Lake изолируем выполнение строго на P-ядрах через taskset, чтобы профиль не искажался E-ядрами.

```bash
# Разогрев сборочной директории (2-3 минуты)
taskset -c 0-7 ninja -C /path/to/workload -j 8

# Запись профиля
doas env TMPDIR=/home/vladimir/tmp/ taskset -c 0-7 perf record \
    -e cycles:u \
    -j any,u \
    -a -F 1000 \
    -- ninja -C /path/to/workload -j 8
```

## Этап 3: Агрегация данных (perf2bolt)

Конвертируем сырой perf.data в формат .fdata, понятный BOLT.

```bash
doas env TMPDIR=/home/vladimir/tmp/ \
    perf2bolt /home/vladimir/llvm-project/build-profile/bin/clang-23 \
    -p /path/to/workload/perf.data \
    -o /home/vladimir/tmp/clang.fdata \
    -w /home/vladimir/tmp/clang.yaml \
    -v 2
```

## Этап 4: Бинарная оптимизация (Магия BOLT)

Применяем собранный профиль к монолитному бинарнику Clang.

```bash
llvm-bolt /home/vladimir/llvm-project/build-profile/bin/clang-23 \
    -o /home/vladimir/llvm-project/build-profile/bin/clang-23.bolt \
    -data /home/vladimir/tmp/clang.fdata \
    -reorder-blocks=ext-tsp \
    -reorder-functions=hfsort+ \
    -split-functions \
    -plt=all \
    -dyno-stats
```

- **ext-tsp**: Оптимальный алгоритм переупорядочивания блоков для Alder Lake.
- **split-functions**: Отделяет "горячий" код от кода обработки ошибок.

После завершения подменяем оригинальный бинарник:

```bash
mv bin/clang-23 bin/clang-23.pre-bolt
mv bin/clang-23.bolt bin/clang-23
```

## Этап 5: Интеграция в Gentoo

Чтобы использовать оптимизированный тулчейн в Portage без нарушения системной иерархии, копируем его в /opt и создаем минималистичный конфиг окружения.

### 1. Перенос тулчейна

Сохраняем всю структуру (инклуды, либы, симлинки).

```bash
doas mkdir -p /opt/llvm-bolt
doas rsync -av --progress /home/vladimir/llvm-project/build-profile/ /opt/llvm-bolt/
```

### 2. Настройка окружения Portage

Создаем файл конфигурации с минимальным (и полностью рабочим!) набором переменных. Компилятор сам отлично находит системные пути GCC.

Файл: `/etc/portage/env/bolt-compiler.conf`

```makefile
CC="/opt/llvm-bolt/bin/clang"
CXX="/opt/llvm-bolt/bin/clang++"
```

### 3. Активация

В файле `/etc/portage/package.env` применяем новый компилятор к нужным пакетам или ко всей системе:

```makefile
# Для конкретных пакетов
sys-devel/llvm bolt-compiler.conf
sys-devel/clang bolt-compiler.conf

# ИЛИ для всего мира
*/* bolt-compiler.conf
```

> **Готово**! Теперь система собирается экстремально быстрым, кастомным компилятором, спрофилированным под конкретное железо.
