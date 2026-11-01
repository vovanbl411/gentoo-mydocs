---
title: Эксперименты compiler optimization
kind: reference
scope: system
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

Страницы экспериментов — исторические записи с условиями, результатами и
ограничениями измерений. Таблица кратко показывает решения, принятые по этим
данным для ASUS B5402 и `gentoo-builder-01`; текущую конфигурацию см. в
системных документах.

| Эксперимент | Что проверяли | Принятое решение |
|-------------|---------------|------------------|
| [Global `-O2` vs `-O3`](./o2-vs-o3/) | Нужен ли глобальный `-O3`? | Глобальный `-O2`; ThinLTO — если это допускает политика пакета/ebuild. Selective `-O3` — только после отдельного benchmark со значимым и воспроизводимым практическим выигрышем. По B1–B4 selective rules не созданы. |
| [`alderlake` vs `x86-64-v3`](./alderlake-vs-x86-64-v3/) | Есть ли практически значимая runtime-регрессия у `x86-64-v3` в проверенных workloads? | Workstation userspace — `-march=alderlake`; portable userspace binpkg builder — `-march=x86-64-v3`. В проверенных workloads практически значимой runtime-регрессии V3 не обнаружено. Это поддерживает policy builder в пределах измерений, но не доказывает эквивалентность targets и не даёт основания менять target workstation. |

Текущая реализация описана в системных документах: [CPU workstation](../../systems/asus-b5402/hardware/cpu-optimization/),
[Portage workstation](../../systems/asus-b5402/system/boot-and-portage/) и
[builder](../../systems/gentoo-builder-01/).
