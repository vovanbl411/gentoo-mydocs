---
title: "Оптимизация CPU: Intel Alder Lake (i7-1260P)"
kind: system
scope: system
status: current
last_verified: "2026-10-30"
verified_on: [asus-b5402]
---

## Current state

- CPU: Intel Core i7-1260P, Alder Lake, с P- и E-ядрами.
- Для userspace на workstation заданы `-march=alderlake`, `-O2` и ThinLTO.
- `CPU_FLAGS_X86` соответствует инструкциям, доступным Portage на этой системе.
- Для управления частотами используется `intel_pstate` в режиме `active`.
- В конфигурации работающего ядра включены HFI, Intel Idle, RAPL, Turbo
  Boost Max 3.0 и IOMMU. `CONFIG_X86_NATIVE_CPU` и `CONFIG_INTEL_TXT` не
  включены.
- BOLT отключён; возвращаться к нему можно только в рамках отдельного эксперимента с новым профилем.

## Userspace

Флаги `CFLAGS` и `CXXFLAGS` на workstation используют `-march=alderlake`.
Текущий набор `CPU_FLAGS_X86`:

```makefile
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"
```

Обычные переносимые userspace binpkg собираются на `gentoo-builder-01` с целью
`x86-64-v3`. Это отдельная политика builder; она не меняет Alder Lake policy
локальных userspace-сборок workstation. Сравнение производительности и
ограничения эксперимента описаны в
[сравнении Alder Lake и x86-64-v3](../../../../experiments/compiler-optimization/alderlake-vs-x86-64-v3/).

## Ядро

`sys-kernel/gentoo-kernel` для workstation собирается на `gentoo-builder-01`
только в виде GPKG и там не устанавливается. Для сборки применяется отдельное
окружение `workstation-kernel`: `KCFLAGS` задаёт
`-march=alderlake -mtune=alderlake`, а `KRUSTFLAGS` —
`-C target-cpu=alderlake`. Подробности приведены в
[документе о загрузке и Portage](../../system/boot-and-portage/#обновление-ядра-сборка-gpkg-на-builder).

В конфигурации работающего ядра `CONFIG_X86_NATIVE_CPU` не включён. Эта
настройка не описывает compiler flags отдельной сборки на builder. Среди
включённых параметров CPU и платформы:

- `CONFIG_INTEL_HFI_THERMAL=y` — поддержка Hardware Feedback Interface для
  гибридного CPU.
- `CONFIG_INTEL_IDLE=y`, `CONFIG_INTEL_RAPL=y` и `CONFIG_INTEL_TURBO_MAX_3=y`.
- `CONFIG_INTEL_IOMMU=y`, `CONFIG_INTEL_IOMMU_DEFAULT_ON=y`,
  `CONFIG_INTEL_IOMMU_SCALABLE_MODE_DEFAULT_ON=y` и `CONFIG_INTEL_IOMMU_SVM=y`.
- `CONFIG_INTEL_TDX_HOST` и `CONFIG_INTEL_TXT` не включены.

Частотный драйвер работающей системы — `intel_pstate`; его режим — `active`.

## BOLT

BOLT не используется. Старую инструкцию см. в
[архиве BOLT](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/bolt.md).
Возврат к нему требует отдельного эксперимента с новым профилированием.

## Related docs

- [Загрузка и Portage](../../system/boot-and-portage/) — toolchain и отдельный
  workflow сборки ядра для workstation.
- [Сравнение Alder Lake и x86-64-v3](../../../../experiments/compiler-optimization/alderlake-vs-x86-64-v3/) — результаты сравнения целей компиляции.
