---
title: Compiler optimization experiments
kind: reference
scope: system
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

The experiment pages are historical records of the conditions, results, and
limits of the measurements. The table summarizes decisions adopted from that
evidence for ASUS B5402 and `gentoo-builder-01`; see the system documentation
for the current configuration.

| Experiment | What it tested | Adopted decision |
|------------|----------------|------------------|
| [Global `-O2` vs `-O3`](./o2-vs-o3/) | Is global `-O3` justified? | Global `-O2`; ThinLTO where package or ebuild policy permits. Use selective `-O3` only after a separate benchmark shows a significant, reproducible practical benefit. B1–B4 produced no selective rules. |
| [`alderlake` vs `x86-64-v3`](./alderlake-vs-x86-64-v3/) | Does `x86-64-v3` cause a practically meaningful runtime regression in the tested workloads? | Workstation userspace uses `-march=alderlake`; portable userspace binpkgs from the builder use `-march=x86-64-v3`. No practically meaningful V3 runtime regression appeared in the tested workloads. This supports the builder policy within the measured scope, but does not prove target equivalence or justify changing the workstation target. |

Current implementation is documented in the system pages for [workstation CPU optimization](../../systems/asus-b5402/hardware/cpu-optimization/),
[workstation Portage](../../systems/asus-b5402/system/boot-and-portage/), and the
[builder](../../systems/gentoo-builder-01/).
