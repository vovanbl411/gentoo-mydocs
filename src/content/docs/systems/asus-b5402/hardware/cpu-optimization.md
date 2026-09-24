---
title: "Оптимизация CPU: Intel Alder Lake (i7-1260P)"
kind: system
scope: system
status: draft
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## Current state

- CPU: Intel Core i7-1260P, Alder Lake (гибридные P/E-ядра).
- Флаги компиляции: `-march=alderlake`; набор `CPU_FLAGS_X86` записан по
  результату `cpuid2cpuflags` (см. ниже).
- Драйвер частот: intel_pstate в режиме active.
- HFI / Intel Thread Director: `CONFIG_INTEL_HFI_THERMAL=y`.
- BOLT не используется (отключён с 2026-07, см. ниже).
- IOMMU включён; поддержка TXT включена в конфигурации ядра.
- TDX неприменим: аппаратуры TDX на этом процессоре нет.

## Флаги компиляции и инструкции

В `make.conf` используется `-march=alderlake`. Это включает поддержку
специфичных инструкций для данной архитектуры, за исключением тех, что
заблокированы аппаратно (например, AVX-512).

Набор инструкций, записанный по результату `cpuid2cpuflags` для i7-1260P:

```makefile
# Оптимальный набор для i7-1260P в make.conf
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"
```

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

BOLT сейчас не используется — временно отключён с 2026-07; ждём стабильного
релиза LLVM 23 и нового профилирования. Инструкция сохранена в
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
