---
title: Compiler optimization experiments
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

This section collects completed empirical experiments on compiler and CPU
optimization policy. Each comparison keeps its question, method, results,
limitations and detailed evidence on one page.

| Experiment | Question | Adopted production decision |
|------------|----------|-----------------------------|
| [Global `-O2` vs `-O3`](./o2-vs-o3/) | Is global `-O3` justified? | Global `-O2`; ThinLTO where supported; selective `-O3` only after a package-specific benchmark. No selective rules resulted from B1–B4. |
| [`alderlake` vs `x86-64-v3`](./alderlake-vs-x86-64-v3/) | Does portable `x86-64-v3` impose a meaningful runtime penalty for build-host binpkgs? | ASUS B5402 retains `-march=alderlake`; `gentoo-builder-01` uses portable `-march=x86-64-v3` for userspace binpkgs. |

These records explain the measured basis and limits of the decisions. Current
configuration and operations remain in the [workstation](../../systems/asus-b5402/system/boot-and-portage/)
and [builder](../../systems/gentoo-builder-01/) documentation.
