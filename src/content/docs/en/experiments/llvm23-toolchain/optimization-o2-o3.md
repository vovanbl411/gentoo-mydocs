---
title: "Hypothesis: global -O2 vs global -O3 (Experiment B)"
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

## Status and adopted decision

Experiment B is **COMPLETE**: B1–B4 are complete, and the optimization-policy
decision was recorded on 2026-09-20 — global `-O2` + selective
benchmark-proven `-O3`. The policy was applied to `/etc/portage` 2026-09-20;
the full rebuild completed 2026-09-21.

Measurement results are in [o2-o3-benchmarks.md](../o2-o3-benchmarks/); the
journal and decision are in [results.md](../results/).

The rest of this document preserves the original hypothesis and predefined
experimental design used to make the decision. It is a decision/experiment
record; the current production configuration is in the [system documentation](../../../systems/asus-b5402/system/boot-and-portage/).

## 1. Original question and experimental baseline

The original Experiment B question: should the system's global optimization
baseline remain `-O3`, or is global `-O2` with package-specific `-O3` only
where it delivers a measured benefit more reasonable?

| | Production baseline at experiment start | Candidate policy |
|--|-----------------------------------------|------------------|
| CFLAGS/CXXFLAGS | global `-O3` | global `-O2` |
| LTO | global ThinLTO where supported | ThinLTO unchanged |
| Targeted exceptions | `package.env` unchanged | `-O3` only for packages with a measured benefit |

Under the predefined design, production policy did not change before
measurements were complete, a decision was made, and it was applied separately.

## 2. Why -O3 is not guaranteed to be faster

- `-O3` is not a different set of optimizations, but more aggressive thresholds
  for the same transformations: higher inlining thresholds, more aggressive
  loop unrolling, and bolder vectorization parameters. The cost is code size.
- Vectorization is no longer exclusive to `-O3`: since LLVM 17 the loop
  vectorizer is enabled at `-O2`, and SLP vectorization is active at `-O2` in
  current LLVM as well. For most codebases, the difference “vectorized or not”
  between the levels has disappeared.
- Aggressive inlining and unrolling expand `.text`. Each hot function occupies
  more i-cache lines; leaving its bounds increases misses, lowers useful
  instruction density, and worsens prefetch behavior.
- ThinLTO multiplies the effect: cross-module inlining pulls in code from other
  TUs, then `-O3` thresholds unroll it further. The joint code growth can
  substantially exceed the sum of the individual effects.
- An additional cost is compilation time: more inlining means more IR to
  optimize and link.

These arguments support only one conclusion: `-O3` benefit usually occurs in
compute-bound kernels, while for typical system and desktop code it is often
neutral or negative. But this is theory, not a result — test it by measurement
on this machine.

## 3. A/B design

The main principle: exactly the optimization level changes in each A/B. The
compiler (Clang 23), linker (LLD 23), CPU target (`-march=alderlake`), LTO mode,
runtime libraries, package version, and benchmark workload remain identical.

Conditions:

- Experiment A (LLVM 23 compatibility) completed 2026-09-20 — the prerequisite
  “first stabilize the compiler/linker baseline” was met; B1 was measured with
  Clang 23 + LLD 23.
- The same package versions in both branches.
- Builds use `--buildpkgonly` in separate PKGDIRs; the live system does not
  change.
- Measured builds are either without ccache, or with an equally cold or cleared
  cache; otherwise wall-clock time is not comparable.
- Repeat or interleave runs to separate the effect from warm-up (page cache,
  tmpfs, ccache).

Canonical measurement and interpretation rules are in
[benchmark-methodology.md](../benchmark-methodology/); this document adds no
new methodology rules.

## 4. Metrics

| Metric | How to collect it |
|--------|-------------------|
| build user/system/wall time | `/usr/bin/time -v` with `--buildpkgonly` |
| peak RSS | `/usr/bin/time -v` (Maximum resident set size) |
| `.text` and ELF size | `size`, `stat` |
| binpkg size | `ls -l` in PKGDIR |
| runtime task-clock / cycles / instructions / IPC | `perf stat` on a pinned core |
| branches / branch misses / cache refs+misses | `perf stat` |
| errors/warnings | counters from the build log; new `package.env` exceptions |

Where applicable, use additional domain-specific workload metrics.

## 5. Plan and package-selection criteria

### Completed gates and rollout

| Gate | Workload class | Status |
|------|----------------|--------|
| B1 | compute-heavy codec (`media-libs/libde265-1.1.3`) | COMPLETE |
| B2 | compression/decompression (`app-arch/zstd-1.5.7-r1`) | COMPLETE |
| B3 | crypto (`dev-libs/openssl-3.5.8`, without LTO by ebuild policy) | COMPLETE |
| B4 | large desktop/graphics workload (`media-libs/mesa-26.2.2`) | COMPLETE |
| — | final B1–B3 review | COMPLETE (2026-09-20) |
| — | optimization policy decision | COMPLETE (2026-09-20) |
| — | applying policy to `/etc/portage` | COMPLETE (2026-09-20) |
| — | full `@world` rebuild with `-O2` | COMPLETE (2026-09-21) |

B4 is the final Experiment B gate; no new gates (B5) are planned.

### Reusable criteria for future package-specific benchmarks

The following list is not a roadmap for an unfinished B5. It specifies criteria
for selecting packages for possible future package-specific `-O3` benchmarks:

- a reproducible runtime workload;
- the same package version in both branches;
- the same LLVM 23 toolchain, `-march=alderlake`, LTO mode, and runtime
  libraries;
- only `-O2` ↔ `-O3` changes;
- real workloads are preferable to synthetic microbenchmarks;
- the workload is long enough that benchmark noise is substantially smaller
  than the measured difference.

## 6. B1–B4 results (brief)

B1 — libde265-1.1.3, single-thread HEVC decode (4+4 runs, P-core):

```text
O3 runtime       ≈ 1.2% faster (task-clock -1.19%)
O3 instructions  ≈ 1.8% fewer
O3 libde265 .text ≈ 12.3% larger
```

B2 — zstd-1.5.7-r1, compression and decompression on one corpus (4+4 runs for
each path, P-core):

```text
O3 libzstd .text ≈ 9.2% larger
O3 compression   ≈ 1–2% faster
O3 decompression ≈ 1–2% slower
```

A mixed result: `-O3` increased code footprint, improving one hot path and
worsening another. An important limit: package-specific `-O3` is not selected
automatically merely because a package is “performance-sensitive”.

B3 — openssl-3.5.8, crypto (without LTO by ebuild `filter-lto` policy;
`openssl speed`, 4+4 samples per algorithm, P-core):

```text
AES-256-CTR:  no O3 benefit (≈ -0.17%, effectively a tie)
SHA-256:      O3 ≈ -0.5%
ChaCha20:     O3 ≈ -1%
libcrypto .text ≈ +2.62%, libssl .text ≈ +4.24%
```

> In the tested OpenSSL crypto workloads, `-O3` did not provide a measurable
> benefit over `-O2`, while continuing to increase code size.

B4 — mesa-26.2.2, shader-db on a real Iris Xe (without LTO by package policy;
4+4 runs, P-core):

```text
runtime: no measurable O3 benefit (mean ≈ -0.30% at CV O2 ≈ 4%)
libgallium .text ≈ +5.23%, libvulkan_intel ≈ +4.79%, hasvk ≈ +4.92%
binpkg ≈ +5.31%
```

The pattern after four workload classes (codec, compression/decompression,
crypto, desktop/graphics):

> `-O3` increased code footprint in every tested class, while runtime benefit
> was small, workload-specific, absent, or negative.

On this basis, the optimization-policy decision was made (2026-09-20) — see
“Decision criterion” below and [results.md](../results/).

The B1–B4 summary table, measurement methodology (canonical rules and
interpretation framework), and complete data are in
[benchmark-methodology.md](../benchmark-methodology/) and
[o2-o3-benchmarks.md](../o2-o3-benchmarks/).

The policy was applied to `/etc/portage` 2026-09-20: `make.conf` and env files
were changed to `-O2`, the resolver succeeds; the full `@world` rebuild with
`-O2` completed 2026-09-21 (post-rebuild boot/runtime checked). No selective
`-O3` rules were created. At this checkpoint `env/llvm-23` did not exist; this
is experiment-checkpoint state, not a claim about the current system.

## 7. Predefined decision criterion

This criterion was formulated before B1–B4 outcomes were available and is
separate from the adopted decision below.

The candidate future policy: global `-O2`, with targeted `-O3` where a useful
effect is measured. It can be adopted only if on a representative package set
`-O2` does not materially lose at runtime while gaining in code size or build
time, and candidates for targeted `-O3` are individually confirmed by
measurement.

If measurement shows a sustained `-O3` advantage, global policy remains as it
is. Change only on data.

The experiment's goal is not to prove `-O2` or `-O3` superior in advance, but
to determine a reasonable policy for this specific machine.

### Adopted decision (2026-09-20)

The criterion was met by B1–B4: `-O2` does not materially lose at runtime on
the tested set (measured O3 benefits were small: ≈1.2% in B1 and ≈1–2% on the
compression path of B2; B2 was mixed, while O3 increased code footprint in
every gate) and consistently wins on code size; measurement identified no
candidates for targeted `-O3`.

```text
global baseline:  -O2
ThinLTO:          remains global where package/ebuild policy permits
-O3:             package-specific only after a separate benchmark shows a
                  meaningful and reproducible practical benefit
```

No selective `-O3` rules result from B1–B4: libde265 is weak/questionable
(~1.2% for ~12.3% `.text`), zstd is mixed, and OpenSSL and Mesa show no
benefit.

> The decision was applied 2026-09-20: `make.conf` and env files were changed
> to `-O2`, and the resolver succeeds. The full `@world` rebuild with `-O2`
> completed 2026-09-21; at this checkpoint the LLVM 23 rollout remained the
> next controlled step (NOT STARTED).

## Related records

- [LLVM 23 experiment status](../)
- [Canonical benchmark methodology](../benchmark-methodology/)
- [Complete B1–B4 data](../o2-o3-benchmarks/)
- [Results journal and gates](../results/)
- [Toolchain primer](../toolchain-primer/)
- [Current system source of truth](../../../systems/asus-b5402/system/boot-and-portage/)
