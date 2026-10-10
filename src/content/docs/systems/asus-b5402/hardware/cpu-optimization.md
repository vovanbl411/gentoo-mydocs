---
title: "Оптимизация CPU: Intel Alder Lake (i7-1260P)"
kind: system
scope: system
status: draft
last_verified: "2026-10-10"
verified_on: [asus-b5402]
---

## Current state

- CPU: Intel Core i7-1260P, Alder Lake (гибридные P/E-ядра).
- Userspace-флаги компиляции: `-march=alderlake`; набор `CPU_FLAGS_X86` записан по
  результату `cpuid2cpuflags` (см. ниже).
- Ядро: `CONFIG_X86_NATIVE_CPU=y` — штатная native CPU optimization,
  подтверждено владельцем 2026-10-07.
- Драйвер частот: intel_pstate в режиме active.
- HFI / Intel Thread Director: `CONFIG_INTEL_HFI_THERMAL=y`.
- BOLT не используется (отключён с 2026-07, см. ниже).
- IOMMU включён; поддержка TXT включена в конфигурации ядра.
- TDX неприменим: аппаратуры TDX на этом процессоре нет.

## Флаги компиляции и инструкции

Для userspace в `make.conf` используется `-march=alderlake`. Это включает поддержку
специфичных инструкций для данной архитектуры, за исключением тех, что
заблокированы аппаратно (например, AVX-512).

Набор инструкций, записанный по результату `cpuid2cpuflags` для i7-1260P:

```makefile
# Оптимальный набор для i7-1260P в make.conf
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"
```

### Empirical validation: `-march=alderlake` vs `-march=x86-64-v3`

По завершённому сравнению, предоставленному владельцем 2026-10-10,
portable `x86-64-v3` не показал практически значимой performance penalty
относительно workstation-specific `-march=alderlake` в трёх классах workload:
compression/decompression, crypto/SIMD и Mesa shader compilation.
Это empirical support принятой builder policy, а не универсальная гарантия
для любого пакета и не основание менять локальную Alder Lake policy workstation.

#### zstd 1.5.7-r1

Обе сборки — `app-arch/zstd-1.5.7-r1`: workstation target
`-march=alderlake`, builder target `-march=x86-64-v3`; остальная существенная
production policy сопоставима. Execution host — ASUS ExpertBook B5402CBA,
Intel Core i7-1260P, привязка через `taskset` к CPU 1. Вход —
`Rocky-8.10-x86_64-boot.iso`, 1086324736 bytes; `zstd -b3 -e3`,
6 runs на вариант. В таблице — медианные скорости.

| Workload | `-march=alderlake`, MB/s | `-march=x86-64-v3`, MB/s | Наблюдаемая разница |
|----------|-------------------------|-------------------------|--------------------|
| Compression | 815.5 | 812.7 | Alder Lake ≈ +0.35% |
| Decompression | 5746.7 | 5728.0 | Alder Lake ≈ +0.33% |

Для этого workload практически значимой потери от portable V3 не обнаружено.

#### OpenSSL 3.5.8

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

#### Mesa 26.2.4

Сравнивались сборки Mesa 26.2.4 в Mesa shader-db на реальном Intel
Alder Lake-P GT2 / Iris Xe с реальным iris userspace driver. CPU 2, `-j1`,
shader cache disabled; перед measured runs выполнен warm-up. Отдельные
Mesa trees выбирались через `LD_LIBRARY_PATH` / `LIBGL_DRIVERS_PATH`.
Проведены 3 interleaved measured runs на вариант; в каждом прогоне
скомпилировано 8539 shaders.

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

## CPU optimization ядра

По проверке владельца от 2026-10-07, `CONFIG_X86_NATIVE_CPU=y` включает
штатную native CPU optimization через upstream Kconfig. Ручной
`KCFLAGS="-march=alderlake"` для этого не требуется и правильно оставлен
закомментированным. Ядро планируется продолжать собирать локально, чтобы
`native` означал именно Alder Lake.

Принятый builder target `x86-64-v3` относится только к portable userspace
binpkg и не заменяет локальную Alder Lake policy. По проверке владельца
от 2026-10-08, `-march=x86-64-v3` и production LLVM/Clang/LLD policy
применены; final `@world` resolver чист. Синхронизация userspace package
policy завершена 2026-10-09; local binpkg production подтверждена владельцем
2026-10-10: успешно собраны GPKG для `app-arch/zstd-1.5.7-r1`,
`dev-libs/openssl-3.5.8` и `media-libs/mesa-26.2.4`; индекс `Packages` создан
при первом zstd pilot.
Private binhost, end-to-end установка, automatic consumption и server ON/OFF
source fallback — CLOSED / PASS по приёмке владельца 2026-10-10; границы
OFF-теста (source path подтверждён, полный rebuild/merge остановлен) — в
[production workflow binary build host](../../system/boot-and-portage/#gentoo-binary-build-host--production).

## Планировщик, Thread Director и управление частотами

Для распределения задач между производительными (P) и энергоэффективными (E)
ядрами Linux использует Hardware Feedback Interface (HFI). В сохранённой
записи `.config` указаны следующие параметры:

- **Intel Thread Director (HFI)**: В ядре активирован
  `CONFIG_INTEL_HFI_THERMAL=y`. Именно этот модуль собирает телеметрию
  с процессора и помогает планировщику корректно раскидывать потоки по
  гибридным ядрам.
- **Управление питанием**: Используется `CONFIG_INTEL_IDLE=y` и
  `CONFIG_INTEL_RAPL=y` (Running Average Power Limit) для точного контроля
  состояний простоя и энергопотребления.
- **Турбо-буст**: Включен `CONFIG_INTEL_TURBO_MAX_3=y` (Intel Turbo Boost Max
  Technology 3.0) для определения самых быстрых ядер и направления на них
  однопоточной нагрузки.
- **Драйвер частот**: Используется intel_pstate в режиме active для
  динамического масштабирования частоты.

## Аппаратная безопасность и виртуализация

- **IOMMU (VT-d)**: Включен по умолчанию с поддержкой масштабируемого режима
  (`CONFIG_INTEL_IOMMU_DEFAULT_ON=y`,
  `CONFIG_INTEL_IOMMU_SCALABLE_MODE_DEFAULT_ON=y`, `CONFIG_INTEL_IOMMU_SVM=y`).
- **Intel TXT**: Поддержка Trusted Execution Technology включена в конфигурации
  ядра (`CONFIG_INTEL_TXT=y`).
- **Intel TDX**: не применимо к этому процессору — TDX существует только в
  серверных Xeon (Sapphire Rapids и новее); клиентские Alder Lake этой
  аппаратуры не имеют. `CONFIG_INTEL_TDX_HOST` в ядре не включён, включать
  смысла нет (проверено 2026-09-22 по `/proc/config.gz`).

## BOLT: why disabled

BOLT сейчас не используется — отключён с 2026-07. Возврат к BOLT возможен
только как отдельный controlled experiment с новым профилированием и
benchmark, если такая цель когда-нибудь появится. Инструкция сохранена в
[`archive/bolt.md`](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/bolt.md) как историческая справка.
Использовать старый профиль вслепую нельзя — см.
[`CHECKPOINT.md`](https://github.com/vovanbl411/gentoo-mydocs/blob/main/CHECKPOINT.md).

Раньше для критически важных компонентов (LLVM-тулчейн, Clang) применялся BOLT
(Binary Optimization and Layout Tool) — переупорядочивание кода внутри
бинарных файлов на основе профилей производительности (perf). Это давало
ощутимый прирост скорости компиляции на архитектуре Alder Lake.

## Related docs

- [Загрузка и Portage](../../system/boot-and-portage/) — toolchain,
  оптимизация, политика `-O2` + ThinLTO.
- [BOLT (архив)](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/bolt.md)
