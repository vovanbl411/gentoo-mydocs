---
title: Эксперименты compiler optimization
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

Здесь собраны завершённые empirical experiments по compiler/CPU optimization
policy. Каждое сравнение хранит вопрос, методику, результаты, ограничения и
подробную evidence на одной странице.

| Эксперимент | Главный вопрос | Принятое production decision |
|-------------|----------------|-----------------------------|
| [Global `-O2` vs `-O3`](./o2-vs-o3/) | Нужен ли global `-O3`? | Global `-O2`; ThinLTO где поддерживается; selective `-O3` только после package-specific benchmark. По B1–B4 selective rules не созданы. |
| [`alderlake` vs `x86-64-v3`](./alderlake-vs-x86-64-v3/) | Насколько значима runtime penalty portable `x86-64-v3` для binpkg отдельного build host? | ASUS B5402 остаётся на `-march=alderlake`; `gentoo-builder-01` использует portable `-march=x86-64-v3` для userspace binpkg. |

Эти записи объясняют измеренные основания и границы решений. Текущая
конфигурация и эксплуатация остаются в документации
[workstation](../../systems/asus-b5402/system/boot-and-portage/) и
[builder](../../systems/gentoo-builder-01/).
