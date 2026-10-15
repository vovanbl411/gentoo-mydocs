---
title: "LLVM 23: experiment and conclusions"
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
sidebar:
  order: 1
---

**Experiment A — LLVM 23 compatibility: COMPLETE. A1–A4: PASS.**
The question was whether Clang/LLD 22 could be replaced with 23 while retaining
the GNU runtime stack: `libstdc++ + libgcc/libgcc_s`. This worked for the selected
packages; Mesa was checked through a binpkg build, without installation or a
runtime test.

The experiment did not prove:

- a performance advantage of LLVM 23 over LLVM 22;
- compatibility of the entire `@world` or the absence of package-specific exceptions;
- a need for a global LLVM 23 userspace rollout.

According to the [current system documentation](../../systems/asus-b5402/system/boot-and-portage/#toolchain)
and [CHECKPOINT](https://github.com/vovanbl411/gentoo-mydocs/blob/main/CHECKPOINT.md)
(records as of 2026-10-10), the primary production userspace toolchain is
**LLVM/Clang/LLD 22**, with global **`-O2` + ThinLTO** and the GNU runtime ABI.
LLVM 23.1.1 is deliberately used for the kernel through `env/kernel-llvm`;
migration of the remaining packages to LLVM 23 has not started. Passing A1–A4
does not mean adopting LLVM 23 as the global userspace toolchain.

The optimization-policy study (Experiment B) led to adopting global `-O2` in
production; selective `-O3` requires benchmark evidence. This is a separate
decision, not a result of comparing LLVM versions.

## What changed and why the tests were separated

Experiment A on 2026-09-20 changed the compiler/linker: Clang 22.1.8 → 23.1.1
and LLD 22 → 23.1.1. The GNU C++ standard library, compiler runtime, and
unwinder were retained. The historical baseline used `-O3`; ThinLTO or disabled
LTO was retained according to each package's original policy. This is not the
current global policy.

```text
compiler/linker
≠ optimization policy
≠ C++ stdlib
≠ compiler runtime
≠ unwinder
```

Changing `-O2`/`-O3`, moving to `compiler-rt + libunwind`, and choosing `libc++`
were separated so that results could be attributed to a specific variable.
The layers and Gentoo settings are explained in
[How the compiler toolchain works in Gentoo](toolchain-primer/).

## Experiment A: LLVM 23 compatibility

All four checks ran on 2026-09-20 on the ASUS B5402.

| Gate / package | Why selected | What it tested | Result |
|----------------|--------------|----------------|--------|
| A1 — `media-libs/libde265-1.1.3` | A small ordinary C++ codec | Clang/LLD 23 + ThinLTO, retaining the GNU runtime | **PASS**; `dec265 --help` — exit 0 |
| A2 — `dev-libs/libunistring-1.4.2` | A C library with an existing `no-lto-llvm` policy | New compiler/linker while retaining `-fno-lto` | **PASS**; build and VDB/ELF checked |
| A3 — `dev-util/mesa_clc-26.2.2` | A package with an LLVM library dependency | Clang 23 + ThinLTO with `LLVM_SLOT=22` | **PASS**; `mesa_clc --help` — exit 0 |
| A4 — `media-libs/mesa-26.2.2` | A large graphics stack | Clang/LLD 23, original no-LTO policy, LLVM libraries 22 | **PASS**; `--buildpkgonly` only, installed Mesa was not replaced |

In A3, the compiler version differed from the LLVM library slot:
`mesa_clc` was built with Clang 23 but used `libLLVM.so.22.1` and
`libclang-cpp.so.22.1`. Here, `LLVM_COMPAT`/`LLVM_SLOT` control the dependency
slot, not automatically the allowed Clang version. This conclusion applies to
the tested ebuild and cannot be extended to all Gentoo packages without checking.

ELF and binpkg sizes were recorded as evidence, but do not provide an LLVM
22 vs 23 comparison. A4 build time was not reliably recorded; the runtime
behavior of that Mesa binpkg was not tested.

## Experiment B: a separate optimization question

The `-O2` vs `-O3` comparison became a
[standalone controlled experiment](../compiler-optimization/o2-vs-o3/).
Clang/LLD 23 were its fixed baseline, not the compared variable.

The result: global `-O2` with ThinLTO where package/ebuild policy allows it;
selective `-O3` only after a package-specific benchmark. B produced no selective
rules. The policy was applied on 2026-09-20; a full `@world` rebuild completed
on 2026-09-21 with boot and core-service checks. Methodology, measurements, and
limitations remain in the separate report.

## Experiment C: runtime experiment boundary

The historical status of `compiler-rt + libunwind` is **NOT STARTED**; system
documentation retains the GNU runtime ABI. This is a separate experiment and
is not part of A's result. Installed LLVM runtimes do not imply their use by
default.

`libstdc++ → libc++` is another independent ABI decision with higher risk;
it was outside A and is not included in C.

## Full record

The [experiment log and raw evidence](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/llvm23-toolchain/results.md)
are preserved in the repository archive: baseline, commands, VDB environment,
compiler/linker provenance, `NEEDED`, sizes, smoke tests, limitations, and
rollback. Historical instructions and next steps in the archive are not a
current procedure.
