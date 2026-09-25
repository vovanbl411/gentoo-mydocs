---
title: "Experiment: LLVM 23 toolchain"
kind: reference
scope: system
status: draft
last_verified: null
verified_on: [asus-b5402]
---

This directory contains the research plan for moving the primary toolchain of
the ASUS ExpertBook B5402 from LLVM 22 to LLVM 23, and the related
optimization-policy research.

## Current experiment status

| Part | Status | Result / next step |
|------|--------|--------------------|
| Experiment A | **COMPLETE** | A1–A4 — PASS; compatibility confirmed only for the tested classes |
| Experiment B | **COMPLETE** | B1–B4 — COMPLETE; `global -O2 + selective benchmark-proven -O3` adopted |
| Optimization policy | **APPLIED** | Applied 2026-09-20 |
| Full `@world` rebuild with `-O2` | **COMPLETE** | Completed 2026-09-21; post-rebuild boot/runtime checked |
| Limited `env/llvm-23` pilot | **NOT STARTED** | Next separate phase after the resolver audit |
| Experiment C (`compiler-rt + libunwind`) | **NOT STARTED** | Separate experiment; it does not include `libc++` |

Experiment A tested compatibility, but did not compare LLVM 22 and LLVM 23
performance. That question remains open.

## Source-of-truth boundary

`experiments/` holds the research record, hypotheses, gates, and measurements.
It is not the confirmed current state of the machine. The current system source
of truth is in `systems/asus-b5402/`, especially the
[boot and Portage record](../../systems/asus-b5402/system/boot-and-portage/).
After individual phases are completed, confirmed results must move into system
documentation or general guides.

## Documents

- [Toolchain primer](toolchain-primer/) — the five toolchain layers and the
  machine's actual configuration;
- [Hypothesis: -O2 vs -O3](optimization-o2-o3/) — Experiment B design,
  package-selection criteria, and the decision criterion;
- [Benchmark methodology](benchmark-methodology/) — canonical measurement
  rules and interpretation framework for every B gate;
- [-O2/-O3 benchmarks](o2-o3-benchmarks/) — B1–B4 data and results;
- [Results log](results/) — gate entries, Experiment A and B outcomes, and
  the optimization-policy decision;
- [Original agent prompt](agent-prompt/) — a historical orchestration prompt,
  not current instructions for running Experiment A or B.

## Objectives

1. Can the compiler/linker stack move from Clang/LLD 22 to Clang/LLD 23 without
   simultaneously changing the runtime architecture? — **Experiment A:
   COMPLETE** (compatibility was demonstrated for the tested classes; LLVM 22
   vs 23 performance was not measured).
2. Does LLVM 23 offer a practical benefit in build time, binary size, or
   performance on Alder Lake? — an open question; there are no benchmarks.
3. Which global optimization baseline is justified: global `-O3`, or global
   `-O2` with package-specific `-O3`? — **Experiment B: COMPLETE** (B1–B4;
   decision: global `-O2` + selective benchmark-proven `-O3`; applied to
   `/etc/portage` 2026-09-20, full rebuild completed 2026-09-21).
4. Is there practical value after that in moving from GNU runtime components to
   `compiler-rt + libunwind`, without combining it with replacing the C++
   standard library? — Experiment C: NOT STARTED.

Moving from `libstdc++` to `libc++` is outside the experiment's first phases,
because it is a separate ABI decision with higher risk.

## Confirmed baseline before the experiment

At experiment preparation time, live system output showed:

```text
Compiler:          Clang 22.1.8
Portage linker:    LLD through -fuse-ld=lld in LDFLAGS
Bare Clang linker: GNU ld.bfd
C++ stdlib:        GCC 15 libstdc++
Compiler runtime:  libgcc
Unwinder:          libgcc / libgcc_s
```

Clang 23.1.1 and LLD 23.1.1 were already installed in parallel.

The `/etc/clang/23/` configuration before the experiment:

```text
-fuse-ld=bfd
--rtlib=libgcc
--stdlib=libstdc++
--unwindlib=libgcc
```

This means that the first phase can change only the compiler/linker:

```text
Clang 22 -> Clang 23
LLD   22 -> LLD   23
```

while leaving unchanged:

```text
libstdc++
libgcc
libgcc_s
```

## Portage exceptions at experiment start

> Historical starting snapshot: the 111 entries below describe the state at
> verification time. Current state: after the 2026-09-20/21 cleanup,
> gcc-fallback remains only for `sys-devel/binutils` and `x11-libs/pango`
> (BFD policy inside `env/gcc-fallback`); all 102 local `no-lto-llvm`
> overrides were removed, as were `env/no-lto-llvm` and `env/no-ccache`; source
> `dev-java/openjdk:17` was replaced by `dev-java/openjdk-bin:25`. The active
> state is in [systems/asus-b5402/system/boot-and-portage.md](../../systems/asus-b5402/system/boot-and-portage/).

The `package.env` audit showed 111 entries associated with `gcc-fallback`,
`problem-llvm`, `llvm-22`, or `no-lto-llvm`.

This number must not be read as 111 packages incompatible with LLVM.

An explicit `gcc-fallback` applied to nine packages at verification time:

```text
app-shells/bash
sys-devel/binutils
app-containers/lxc
app-editors/nano
dev-cpp/highway
dev-java/openjdk
net-analyzer/nmap
x11-libs/pango
media-libs/libjxl
```

Most remaining rules merely disable ThinLTO or provide another narrow
exception.

## LLVM_COMPAT

The VDB showed a small set of installed packages with the `LLVM_COMPAT`
variable. This must not be treated as a list of packages that can or cannot be
compiled by a particular Clang version: `LLVM_COMPAT` often describes
compatibility with LLVM as a library or tool dependency.

The experiment therefore distinguishes two independent axes:

- the Clang/LLD version that compiles a package's C/C++ code;
- the LLVM slot a package links with or depends on as a library/toolchain
  component.

## Experiment status

**Experiment A — LLVM 22 → 23 (compatibility): COMPLETE.**

| Gate | Package | Class | LTO | LLVM dependency | Result |
|------|---------|-------|-----|-----------------|--------|
| A1 | libde265-1.1.3 | C++ codec | ThinLTO | n/a | PASS |
| A2 | libunistring-1.4.2 | C library | disabled | n/a | PASS |
| A3 | mesa_clc-26.2.2 | C/C++ LLVM-dependent | ThinLTO | LLVM 22 | PASS |
| A4 | mesa-26.2.2 (`--buildpkgonly`) | large graphics stack | disabled | LLVM 22 | PASS |

A is a compatibility result, not a performance comparison: it does not prove
compatibility of the whole `@world` and does not remove package-specific
exceptions.

**Experiment B — -O2 vs -O3: COMPLETE** (B1–B4, final review, and
optimization-policy decision — 2026-09-20). B1 (libde265, single-thread HEVC
decode): O3 runtime ~1.2% faster, instructions ~1.8% fewer, `.text` ~12.3%
larger. B2 (zstd 1.5.7-r1): `libzstd` `.text` ~9.2% larger; compression ~1–2%
faster, decompression ~1–2% slower — a mixed result. B3 (openssl 3.5.8,
without LTO by ebuild policy): no O3 benefit — AES-256-CTR effectively a tie
(~-0.17%), SHA-256 ~-0.5%, ChaCha20 ~-1%, `libcrypto` `.text` ~+2.6%. B4
(mesa 26.2.2, shader-db on Iris Xe, `-fno-lto` by package policy): no
measurable O3 runtime benefit; large Mesa ELF ~+5% `.text`, binpkg +5.31%.
Details are in [o2-o3-benchmarks.md](o2-o3-benchmarks/).

The pattern across four workload classes (codec, compression/decompression,
crypto, desktop/graphics): `-O3` increased code footprint in every tested
class, while runtime benefit was small, workload-specific, absent, or negative.

**Optimization policy decision (2026-09-20)**: global `-O2` + selective
benchmark-proven `-O3`; ThinLTO remains global where package/ebuild policy
allows it. No selective `-O3` rules were created after B1–B4. The policy was
applied to `/etc/portage` 2026-09-20 (`make.conf`, env); the full `@world`
rebuild with `-O2` completed 2026-09-21 (post-rebuild boot/runtime checked).

## Roadmap

### Completed

```text
Experiment A — LLVM 23 compatibility — COMPLETE
          ↓
Experiment B — -O2 vs -O3 — COMPLETE
  B1 libde265 — COMPLETE
  B2 zstd — COMPLETE
  B3 openssl — COMPLETE
  final B1–B3 review — COMPLETE (2026-09-20)
  B4 mesa — COMPLETE (2026-09-20)
  optimization policy decision — COMPLETE (2026-09-20)
          ↓
applying -O2 in /etc/portage — COMPLETE (2026-09-20)
          ↓
full O2 rebuild + validation — COMPLETE (2026-09-21)
```

### Open / next

```text
limited env/llvm-23 pilot —
NOT STARTED
          ↓
controlled LLVM 23 rollout — after a separate decision and resolver audit
          ↓
Experiment C (compiler-rt + libunwind) — NOT STARTED
```

Experiment B no longer blocks `env/llvm-23`: the optimization policy has been
selected. The order remains: apply the optimization policy first, then start a
controlled LLVM 23 rollout; do not do both at once.

Each following item requires a separate owner decision:

- a limited `env/llvm-23` pilot; a global transition only after the resolver
  audit;
- a world rebuild using the controlled scheme: pretend/resolver check,
  exception assessment, rebuild; retain existing GCC fallbacks until each has
  been assessed separately;
- Experiment C (`compiler-rt + libunwind`) after A and B, with its own
  baseline and rollback; do not include `libc++`;
- do not use Firefox as an early pilot.

## What to measure

For configuration comparisons, record:

- wall-clock build time;
- peak memory, where practical;
- final ELF and binpkg size;
- link time for large ThinLTO packages, where separable;
- build errors/warnings;
- any need for new `package.env` exceptions;
- runtime benchmarks only where a reproducible workload exists.

Do not declare LLVM 23 faster based only on compilation time for one package.

## Experiment safety rules

- Do not remove LLVM 22 before migration completes.
- Do not change the compiler, C++ standard library, and runtime at once.
- Do not remove existing GCC fallbacks in bulk.
- Do not enable `default-libcxx` during the first phases.
- Do not bypass an `LLVM_COMPAT` ebuild without separate justification.
