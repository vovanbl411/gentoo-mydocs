---
title: "`-march=alderlake` vs `-march=x86-64-v3`"
kind: reference
scope: system
status: historical
last_verified: "2026-10-10"
verified_on: [asus-b5402]
---

## Текущее решение и результат

Для ASUS B5402 сохраняется userspace target `-march=alderlake`. Для
`gentoo-builder-01`, который производит portable userspace binpkg, выбран
`-march=x86-64-v3`.

В трёх проверенных классах workload — сжатие и распаковка, криптография и
компиляция шейдеров Mesa — практически значимой runtime-регрессии V3 не
обнаружено. Эти результаты поддерживают builder policy, но не доказывают
равенство targets для всех пакетов и не служат основанием менять target
рабочей станции.

## Вопрос

Насколько значима runtime performance penalty при использовании portable
`-march=x86-64-v3` вместо workstation-specific `-march=alderlake` для binpkg,
производимых отдельным build host?

## Зачем проводилось сравнение

Для builder нужен portable userspace target, тогда как ASUS B5402 продолжает
собирать пакеты для собственного Alder Lake CPU. Сравнение проверяло runtime
поведение нескольких representative workloads на этом процессоре.

## Условия эксперимента

Проверены `app-arch/zstd-1.5.7-r1`, OpenSSL 3.5.8 и Mesa 26.2.4. Сборки
сравнивались на ASUS ExpertBook B5402CBA с Intel Core i7-1260P; для Mesa
использовалась встроенная графика Alder Lake-P GT2 / Iris Xe. Подробные
параметры каждого workload приведены ниже.

Сравнение и его результаты предоставлены владельцем 2026-10-10. Этот документ
фиксирует empirical evidence и принятую policy; он не является новым аудитом
текущей конфигурации.

## Методика

Сопоставлялись сборки с targets `-march=alderlake` и `-march=x86-64-v3`.
Для OpenSSL и Mesa использовались interleaved runs. Для Mesa перед
измерениями выполнен warm-up, shader cache был отключён. Число runs, CPU
affinity, команды и остальные оговорки зависят от workload и указаны в
подробных результатах.

## Результаты

| Workload | Наблюдение |
|----------|------------|
| zstd compression/decompression | Alder Lake быстрее примерно на 0.35% и 0.33% соответственно; практически значимой потери V3 не обнаружено. |
| OpenSSL crypto | Различия составили от ≈ 0.04% до ≈ 0.55%; субпроцентные результаты не подтверждают преимущество одного target. |
| Mesa shader-db | У V3 меньше mean wall time примерно на 4.37% и median на 6.93%; малое число запусков и более высокая вариативность Alder Lake не позволяют уверенно связать наблюдаемое преимущество с CPU target. |

### zstd

Различия медианной скорости сжатия и распаковки составили около 0.35% и
0.33% в пользу Alder Lake; практически значимой потери V3 не обнаружено.

### OpenSSL

Различия в трёх crypto workload были субпроцентными и не подтверждают
преимущество одного из targets.

### Mesa

У V3 были ниже mean и median wall time, но небольшое число запусков и
вариативность Alder Lake не позволяют уверенно связать это с CPU target.

## Интерпретация

Во всех трёх протестированных workload V3 не показал практически значимой
runtime-регрессии. Различия в zstd и OpenSSL малы. В Mesa shader-db результаты
V3 оказались быстрее, но runs Alder Lake заметно более вариативны, а выборка
мала; преимущество нельзя уверенно приписать CPU target.

Вывод ограничен этими пакетами, версиями и workload. Он подтверждает
пригодность `x86-64-v3` для принятой builder policy в пределах проверенной
evidence, а не универсальную эквивалентность targets.

## Решение

```text
ASUS B5402 workstation:
    -march=alderlake

gentoo-builder-01 portable userspace binpkg:
    -march=x86-64-v3
```

Рабочая станция сохраняет свой Alder Lake target. Portable V3 используется
для userspace binpkg отдельного build host.

## Ограничения

- Проверены только zstd 1.5.7-r1, OpenSSL 3.5.8 и Mesa 26.2.4 и описанные
  ниже workloads.
- Замеры выполнены на ASUS B5402CBA с i7-1260P; они не представляют все
  runtime workloads или hardware.
- Различия OpenSSL меньше одного процента, а малое число запусков и
  вариативность Mesa не позволяют уверенно приписать небольшие различия
  конкретному CPU target.
- Результаты не доказывают равенство `-march=alderlake` и
  `-march=x86-64-v3` в целом и не обосновывают смену target рабочей станции.

## Подробные результаты

### zstd 1.5.7-r1 — сжатие и распаковка

Обе сборки — `app-arch/zstd-1.5.7-r1`: workstation target
`-march=alderlake`, builder target `-march=x86-64-v3`; остальная существенная
production policy сопоставима. Execution host — ASUS ExpertBook B5402CBA,
Intel Core i7-1260P, привязка через `taskset` к CPU 1. Вход —
`Rocky-8.10-x86_64-boot.iso`, 1086324736 bytes; `zstd -b3 -e3`, 6 runs на
вариант. В таблице — медианные скорости.

| Workload | `-march=alderlake`, MB/s | `-march=x86-64-v3`, MB/s | Наблюдаемая разница |
|----------|-------------------------|-------------------------|--------------------|
| Compression | 815.5 | 812.7 | Alder Lake ≈ +0.35% |
| Decompression | 5746.7 | 5728.0 | Alder Lake ≈ +0.33% |

Для этого workload практически значимой потери от portable V3 не обнаружено.

### OpenSSL 3.5.8 — криптография

Обе сборки — OpenSSL 3.5.8. Execution host — тот же i7-1260P, CPU 1;
3 interleaved runs на вариант, `openssl speed`, 16384-byte blocks,
5-second window. Runtime CPU capability mask OpenSSL был одинаковым.
В таблице — медианный throughput.

| Workload | `-march=alderlake`, kB/s | `-march=x86-64-v3`, kB/s | Наблюдаемая разница |
|----------|-------------------------|-------------------------|--------------------|
| SHA-256 | 1,056,758 | 1,057,178 | V3 ≈ +0.04% |
| AES-256-GCM | 3,321,747 | 3,340,073 | V3 ≈ +0.55% |
| ChaCha20 | 1,869,817 | 1,866,987 | Alder Lake ≈ +0.15% |

Субпроцентные различия не подтверждают реальное преимущество одной сборки.
Во всех трёх crypto workload практически значимой регрессии V3 не обнаружено.

### Mesa 26.2.4 — компиляция шейдеров

Сравнивались сборки Mesa 26.2.4 в Mesa shader-db на реальном Intel
Alder Lake-P GT2 / Iris Xe с реальным iris userspace driver. CPU 2, `-j1`,
shader cache disabled; перед measured runs выполнен warm-up. Отдельные Mesa
trees выбирались через `LD_LIBRARY_PATH` / `LIBGL_DRIVERS_PATH`. Проведены
3 interleaved measured runs на вариант; в каждом прогоне скомпилировано
8539 shaders.

| Wall time | `-march=alderlake`, s | `-march=x86-64-v3`, s |
|-----------|----------------------|----------------------|
| Run 1 | 113.494 | 103.311 |
| Run 2 | 104.167 | 107.721 |
| Run 3 | 113.034 | 105.198 |
| Mean | ≈ 110.232 | 105.410 |
| Median | 113.034 | 105.198 |

У V3 наблюдалось ≈ 4.37% меньшее mean wall time и ≈ 6.93% меньшее
median wall time. Это не доказывает, что V3 быстрее: Alder Lake runs
заметно более вариативны, выборка маленькая. `x86-64-v3` не показал runtime
regression в этом shader-db workload; наблюдаемое преимущество V3 нельзя
уверенно приписать CPU target.
