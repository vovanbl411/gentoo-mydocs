---
title: "Toolchain primer: five independent layers"
kind: reference
scope: system
status: draft
last_verified: null
verified_on: [asus-b5402]
---

This document provides a mental model of the five independent toolchain layers
for the [LLVM 23](../) experiment: which settings changed and which remained
untouched. It is a conceptual reference, not LLVM reference material or a
description of the current system configuration.

The actual values below belong to the historical Gate A0 baseline captured on
2026-09-20 and recorded in [results.md](../results/). The system's current
source of truth is the [boot and Portage record](../../../systems/asus-b5402/system/boot-and-portage/).
Permanent `env/llvm-23` and the controlled rollout are not covered by this
primer.

## Experiment status in these records

- Experiment A (LLVM 23 compatibility) — **COMPLETE**, A1–A4 PASS.
- Experiment B (-O2 vs -O3) — **COMPLETE**, B1–B4.
- Optimization policy decision: global `-O2` + selective benchmark-proven
  `-O3`.
- The policy was applied to `/etc/portage` 2026-09-20; the full rebuild was
  completed 2026-09-21.
- Permanent `env/llvm-23` / controlled rollout — **NOT STARTED** in the
  context of these records.

## 1. Five layers

```text
compiler   → GCC / Clang
linker     → GNU ld.bfd / LLD
C++ stdlib → libstdc++ / libc++
rtlib      → libgcc / compiler-rt
unwinder   → libgcc_s / libunwind
```

| Layer | Purpose |
|-------|---------|
| Compiler | translates C/C++ to object files; it neither links them nor provides a runtime |
| Linker | combines `.o`/`.a` into ELF and resolves symbols; an LTO build is linker work |
| C++ stdlib | the `std::` implementation: containers, strings, iostream |
| rtlib | compiler support runtime: CRT objects (`crtbegin*`/`crtend*`), integer builtins (`__udivti3`), atomics, sanitizers |
| unwinder | stack unwinding: C++ exceptions, `backtrace`, profilers |

The layers are nearly orthogonal: “all GNU” and “all LLVM” are only two corners
of the space of valid combinations. This machine's baseline stack was mixed,
and that is normal.

## 2. Historical experiment baseline — Gate A0, 2026-09-20

| Layer | Value | Set by |
|-------|-------|--------|
| Primary compiler | Clang 22.1.8 | `make.conf` (`CC=clang`) + PATH order |
| Parallel compiler | Clang 23.1.1 | `/usr/lib/llvm/23/bin/`; it builds the kernel (env `kernel-llvm`) |
| Portage linker | LLD (slot 22) | `-fuse-ld=lld` in `LDFLAGS` make.conf |
| Bare clang linker | GNU ld.bfd | `File: /etc/clang/22/gentoo-linker.cfg` |
| C++ stdlib | libstdc++ (GCC 15) | `gentoo-stdlib.cfg` → `--stdlib=libstdc++` |
| rtlib | libgcc | `gentoo-rtlib.cfg` → `--rtlib=libgcc` |
| unwinder | libgcc_s | `gentoo-unwindlib.cfg` → `--unwindlib=libgcc` |

In the baseline, slot 23's cfg was identical to slot 22: `bfd` / `libgcc` /
`libstdc++` / `libgcc`. Clang 23 was configured for the same GNU runtime, so
changing the compiler/linker in the pilot did not also change stdlib, rtlib, or
unwinder.

## 3. Why Clang works normally with libstdc++ + libgcc

- Clang and GCC emit ABI-compatible object files: they share the Itanium C++
  ABI and the low-level runtime contract.
- libgcc and compiler-rt are two implementations of one interface (builtins,
  CRT, `_Unwind_*`). Clang can link either; `--rtlib` selects it.
- libstdc++ is a regular system library, not a “part of GCC”; Clang targets it
  by default.
- A Gentoo world has mixed GCC and Clang object files on one GNU runtime for
  years. Therefore, the phase “change compiler/linker without touching
  runtimes” is the low-risk part of the experiment.

## 4. “Build world with Clang” ≠ “move to libc++”

- `--stdlib` and the set of linked libraries select the standard library, not
  the compiler. Clang targets libstdc++ by default on Gentoo.
- libc++ is another `std::` implementation with a different internal ABI:
  `std::string` layout, `std::list` nodes, and so on. libc++ symbols use the
  inline namespace `std::__1`, so the linker will not catch everything: some
  mismatches appear at runtime as ODR/ABI breakage.
- Moving to libc++ means rebuilding all C++ and breaking compatibility with
  precompiled binaries. It is a separate higher-risk decision and outside the
  first phases.

## 5. Portage-selected LLD ≠ Clang's own default linker

Clang is a driver: it selects a linker through `-fuse-ld=...`. The value comes
from the following places:

- A package build in Portage: `LDFLAGS` from `make.conf` contains
  `-fuse-ld=lld` → it links with LLD independently of cfg defaults.
- A bare invocation (`clang++ test.cpp` manually, without flags): its default
  comes from `File: /etc/clang/<slot>/gentoo-linker.cfg`; in the baseline it
  was `-fuse-ld=bfd`.

This gives the baseline asymmetry: Portage linker = LLD, bare clang = bfd. The
asymmetry had already caused trouble (bare-clang PATH drift, July 2026 — see
`CHECKPOINT.md`). The practical pilot conclusion: check linker provenance from
the ELF itself (`readelf`), not from which clang “should have” built a package.

In the 2026-09-20 baseline, `/usr/lib/llvm/22/bin` preceded
`/usr/lib/llvm/23/bin` in PATH (set through `/etc/env.d/`), so the bare names
`clang`, `ld.lld` resolved to slot 22 and Clang 23 was invoked only by the
absolute path `/usr/lib/llvm/23/bin/...`. The pilot therefore used absolute
paths.

## 6. What Gentoo USE flags do

In the baseline, bare-clang defaults were generated by separate cfg packages
(named in comments in the cfg files themselves): `llvm-core/clang-linker-config`,
`llvm-runtimes/clang-rtlib-config`, `llvm-runtimes/clang-stdlib-config`, and
`llvm-runtimes/clang-unwindlib-config`. Their USE flags were checked in the VDB
on 2026-09-20:

| USE | Package | What it switches |
|-----|---------|------------------|
| `default-lld` | llvm-core/clang-linker-config | bare-clang default linker → LLD |
| `default-compiler-rt` | llvm-runtimes/clang-rtlib-config | bare-clang default rtlib → compiler-rt |
| `default-libcxx` | llvm-runtimes/clang-stdlib-config | bare-clang default stdlib → libc++ |
| `llvm-libunwind` | llvm-runtimes/clang-unwindlib-config | default unwinder → llvm-libunwind |

The `compiler-rt` and `libcxx` flags control building the runtimes themselves
(compiler-rt, libc++/libc++abi) as part of the LLVM stack.

Two limits apply:

1. “Built” ≠ “used”. The presence of compiler-rt or libc++ on the system does
   not switch anything: the linking flags of each package make the actual
   choice (`--rtlib`, `--stdlib`, `--unwindlib`).
2. `default-*` changes only bare-invocation defaults; Portage builds specify
   flags explicitly and override the defaults.

By the first-phase design, these flags did not change (rule 7 in agent-prompt):
slot 23 cfg files supplied the GNU runtime by default.

## 7. How layers map to the experiment

The table below records the original design and experiment mapping. Experiments
A and B are complete; Experiment C remains a separate unfinished phase, and a
move to `libc++` is not part of the first-phase plan.

| Hypothesis | Changes | Keeps |
|------------|---------|-------|
| A: LLVM 22 → 23 | compiler, linker (pilot packages) | stdlib, rtlib, unwinder, `-O3`, ThinLTO, `package.env` exceptions |
| B: -O2 vs -O3 | only the optimization level in CFLAGS/CXXFLAGS | everything else, including LLVM version |
| C: runtimes | `libgcc → compiler-rt`, `libgcc_s → libunwind` | compiler, linker, stdlib |
| outside scope | `libstdc++ → libc++` | — |

### Two axes: compiler and LLVM libraries

Packages that depend on LLVM as a library (mesa, mesa_clc, xwayland-satellite,
and others) have one more independent axis: the LLVM slot they link against.
The ebuild selects it through `LLVM_COMPAT`/`LLVM_SLOT`; it is unrelated to
which Clang compiles the package sources.

Gate A3 demonstrated this in practice: `mesa_clc` was built with Clang 23,
while `LLVM_COMPAT=(18 19 20 21 22)` selected `LLVM_SLOT=22`, and the
executable links to `libLLVM.so.22.1`/`libclang-cpp.so.22.1`. The configuration
“build with a new compiler, link with older LLVM libraries” is valid (but does
not automatically generalize to all ebuilds; see results.md).

## Related records

- [LLVM 23 experiment status](../)
- [Results log](../results/)
- [Experiment B: -O2 vs -O3](../optimization-o2-o3/)
- [Current system source of truth](../../../systems/asus-b5402/system/boot-and-portage/)
