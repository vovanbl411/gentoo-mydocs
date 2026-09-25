---
title: "Agent prompt: LLVM 23 toolchain experiment"
kind: reference
scope: system
status: historical
last_verified: null
verified_on: [asus-b5402]
---

> **Historical document:** this is the original prompt used to organize the
> LLVM 23 experiment. It is retained as provenance for the decisions made and
> the reasoning process. Experiment A and B are already complete; the
> instructions to “create documents,” “start Gate A1,” and the other steps
> below are not current next steps. For the current experiment status, see
> [README.md](../); for the actual results, see [results.md](../results/).

Work in the `vovanbl411/gentoo-mydocs` repository, branch
`docs/llvm23-toolchain-experiment`.

Before drawing any conclusions, read:

- `DOCUMENTATION_POLICY.md`
- `CONTRIBUTING.md`
- `CHECKPOINT.md`
- `systems/asus-b5402/system/boot-and-portage.md`
- `experiments/llvm23-toolchain/index.md`

## Context

The reference machine is an ASUS ExpertBook B5402, Intel Core i7-1260P, using
the Gentoo hardened systemd profile.

> **Historical baseline:** the values below were recorded before the experiment
> and do not describe the current system state today.

Live baseline before the experiment:

```text
CC=clang
CXX=clang++
AR=llvm-ar
NM=llvm-nm
RANLIB=llvm-ranlib

Clang 22.1.8

CFLAGS/CXXFLAGS:
-march=alderlake -O3 -flto=thin -pipe
-mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk

LDFLAGS:
-Wl,-O1 -Wl,--as-needed -fuse-ld=lld

Portage linker = LLD
Bare clang default linker = GNU ld.bfd
C++ stdlib = GCC 15 libstdc++
rtlib = libgcc
unwindlib = libgcc/libgcc_s
```

The following was also verified:

```text
LLVM 23.1.1 installed
LLD 23.1.1 installed

/etc/clang/23/gentoo-linker.cfg:
-fuse-ld=bfd

/etc/clang/23/gentoo-rtlib.cfg:
--rtlib=libgcc

/etc/clang/23/gentoo-stdlib.cfg:
--stdlib=libstdc++

/etc/clang/23/gentoo-unwindlib.cfg:
--unwindlib=libgcc
```

The following `package.env` snapshot also belongs to the preparation stage of
the experiment. The word “now” in the original prompt means the time of that
snapshot, not the current Portage state.

The `package.env` audit found 111 rules related to
`gcc-fallback|problem-llvm|llvm-22|no-lto-llvm`, but this does NOT mean there
are 111 packages incompatible with LLVM.

An explicit `gcc-fallback` currently applies only to nine packages:

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

Most of the remaining rules are `no-lto-llvm` or other targeted exceptions.

## Overall goal

Do not try to “make the system as LLVM as possible” as an end in itself.

Four independent hypotheses must be checked separately:

> This is the original set of hypotheses. Experiment A and B were subsequently
> completed, while Experiment C remains NOT STARTED. The hypotheses below have
> not been rewritten retrospectively.

1. **LLVM 23 migration**\
   How safe is it to move the main compiler/linker stack from Clang/LLD 22 to
   Clang/LLD 23 while retaining the GNU C++/runtime stack?

2. **Optimization policy**\
   How justified is global `-O3` compared with `-O2` under
   `-march=alderlake + ThinLTO`?

3. **LLVM runtimes**\
   After LLVM 23 is stabilized, is there a practical reason to replace
   `libgcc + libgcc_s` with `compiler-rt + libunwind`?

4. **C++ stdlib**\
   Treat `libstdc++ -> libc++` as a separate later investigation with increased
   ABI risk. Do not include it in the first phases.

## Document the analysis first

The original documentation instructions are retained below. They have already
been carried out, but explain the provenance and structure of the documents
created.

Before the first change to the live system, create the following documents in
`experiments/llvm23-toolchain/`.

### 1. `toolchain-primer.md`

Explain the five independent layers in plain but technically accurate language:

```text
compiler   → GCC / Clang
linker     → GNU ld.bfd / LLD
C++ stdlib → libstdc++ / libc++
rtlib      → libgcc / compiler-rt
unwinder   → libgcc_s / libunwind
```

You must explain:

- the role of each layer;
- why Clang works perfectly normally with `libstdc++ + libgcc`;
- why “building world with Clang” does not mean “switching to libc++”;
- how the Portage-selected LLD differs from Clang’s own default linker;
- what these Gentoo USE flags change:
  `default-lld`, `libcxx`, `default-libcxx`,
  `compiler-rt`, `default-compiler-rt`, `llvm-libunwind`;
- why `libc++` is a separate ABI decision;
- the configuration the current machine actually has.

Do not turn the document into an LLVM encyclopedia. Its purpose is to give the
owner a clear mental model specifically for the subsequent experiment.

### 2. `optimization-o2-o3.md`

Record a separate hypothesis:

```text
current:
-O3 global + ThinLTO

candidate:
-O2 global + ThinLTO
and -O3 only for packages where a useful effect has been measured
```

Explain:

- that `-O3` is a more aggressive optimization level, not a guaranteed faster
  mode;
- that modern LLVM already supports vectorization beyond it being a unique
  property of `-O3`;
- why more aggressive inlining/unrolling can increase `.text`;
- why increased code size can worsen instruction-cache locality;
- why `-O3 + ThinLTO` must be assessed with measurements;
- why LLVM 22→23 and O3→O2 cannot both be changed in the first pilot:
  otherwise result causality is lost.

Record the following future standalone A/B experiment:

```text
LLVM 23 + -O2 + ThinLTO
vs
LLVM 23 + -O3 + ThinLTO
```

Minimum metrics:

- wall-clock build time;
- linker time, where it can be isolated;
- ELF `.text` / code size;
- a runtime benchmark with a reproducible workload;
- peak memory, if it is convenient to measure;
- errors/warnings and the need for exceptions.

Do not declare `-O2` or `-O3` the winner in advance.

### 3. Results

Create `results.md` as the experiment log.

For every gate, record:

- date;
- initial configuration;
- the exact variable being changed;
- commands;
- relevant output;
- PASS/FAIL;
- what has been proven;
- what has NOT been proven;
- rollback/residual changes;
- the next minimum gate.

Do not copy enormous build logs in full. Record reproducible commands and
material results.

## Experiment rules

1. Do not change several independent variables at once.
2. Do not remove LLVM 22.
3. Do not change the global compiler/runtime stack in the first pilot.
4. Do not remove existing `gcc-fallback` and `no-lto-llvm` rules en masse.
5. Do not treat `LLVM_COMPAT` as a direct list of allowed Clang versions:
   check exactly what it controls in the specific ebuild/eclass.
6. Do not bypass ebuild constraints without separate analysis.
7. Do not change `default-libcxx`, `default-compiler-rt`,
   `llvm-libunwind`, or `default-lld` in the first phase.
8. Do not change `-O3` to `-O2` during the LLVM 22→23 pilot.
9. The owner performs commands that change the live system.
10. After every step, give a short conclusion: what has been proven, what has
    not been proven, and the next minimum gate.
11. Move confirmed results into `systems/asus-b5402/` only after the
    corresponding gate is complete.
12. Do not update `last_verified` based on plans or assumptions.

## Experiment A — LLVM 22 vs LLVM 23

The original Experiment A plan is retained below. The actual results are in
[results.md](../results/); Experiment A has status COMPLETE.

### Gate A0 — baseline

The baseline has already been captured and is given above. Check the
documentation against the user's actual output and record it in `results.md`.

### Gate A1 — one small package

First candidate: `media-libs/libde265`.

Goal:

```text
before:
Clang 22 + LLD 22 + -O3 + ThinLTO
+ libstdc++ + libgcc + libgcc_s

pilot:
Clang 23 + LLD 23 + -O3 + ThinLTO
+ libstdc++ + libgcc + libgcc_s
```

Only the compiler/linker changes.

Use absolute LLVM 23 paths for the pilot:

```text
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
AR=/usr/lib/llvm/23/bin/llvm-ar
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib
```

Before emerge, first prove with a separate harmless command that:

```text
/usr/lib/llvm/23/bin/clang++ + -fuse-ld=lld
→ /usr/lib/llvm/23/bin/ld.lld
```

Also prove that the defaults remain:

```text
stdlib    = libstdc++
rtlib     = libgcc
unwindlib = libgcc
```

Only after this, prepare a one-time pilot build without creating a permanent
`env/llvm-23`.

Retain the current:

```text
-march=alderlake
-O3
-flto=thin
```

After the build, check:

- the package's VDB environment;
- compiler provenance;
- linker provenance;
- ELF dynamic dependencies;
- `.text`/ELF size;
- a basic package smoke test, where applicable.

Do not proceed to permanent `env/llvm-23` until Gate A1 is closed.

### Gate A2 and later

After a successful A1, expand the sample gradually:

- a small C library;
- a C++ library;
- a package with ThinLTO;
- a package from `no-lto-llvm`;
- a larger desktop/system package.

Do not use Firefox as an early pilot.

## Experiment B — O2 vs O3

Do not start until the LLVM 23 compiler/linker baseline is stabilized.

Compare:

```text
LLVM 23 + -O2 + ThinLTO
LLVM 23 + -O3 + ThinLTO
```

on identical packages and workloads.

The purpose is to test the hypothesis for the future policy:

```text
-O2 global
-O3 selective only where measured useful
```

Make the decision from measurements, not theory.

Subsequent Experiment B materials:

- [Hypothesis and decision record](../optimization-o2-o3/);
- [Benchmark methodology](../benchmark-methodology/);
- [B1–B4 data](../o2-o3-benchmarks/).

## Experiment C — runtimes

According to the current README, Experiment C has status NOT STARTED. Its
original plan is retained below; do not create a new plan in this document.

Only after A and B, investigate separately:

```text
libgcc   -> compiler-rt
libgcc_s -> libunwind
```

Do not combine this migration with `libc++`.

## Final criterion

The experiment must end with a measured and maintainable policy for this
specific Gentoo machine, not with the phrase “maximally pure LLVM”:

- which Clang/LLD to use by default;
- `-O2` or `-O3` globally;
- where package-specific exceptions are justified;
- whether `compiler-rt + libunwind` is needed;
- which packages objectively require GCC/LLVM22/no-LTO;
- which exceptions turned out to be historical and can be removed.

## Related records

- [README.md](../) — current experiment status;
- [results.md](../results/) — gate journal and actual results;
- [optimization-o2-o3.md](../optimization-o2-o3/) — decision record;
- [o2-o3-benchmarks.md](../o2-o3-benchmarks/) — benchmark data.
