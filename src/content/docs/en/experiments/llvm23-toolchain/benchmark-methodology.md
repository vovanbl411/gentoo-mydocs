---
title: "Optimization benchmark methodology (Experiment B)"
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

This is the canonical Experiment B methodology for `-O2` vs `-O3` A/B
comparisons. The rules were fixed before results were interpreted and did not
change after data was obtained. B1–B4 are complete, and this document remains
a reference record of how the results were obtained.

Actual data is in [o2-o3-benchmarks.md](../o2-o3-benchmarks/), the detailed
decision record is in [optimization-o2-o3.md](../optimization-o2-o3/), and the
gate journal is in [results.md](../results/).

## 0. Separating facts and conclusions

Throughout the experiment documentation, these are distinguished:

```text
raw facts      — measured values (raw samples, ELF sizes, provenance)
derived metrics — means, medians, CV, percentages, normalized metrics
interpretation — qualitative conclusions from derived metrics, including limitations
decision       — a production-policy change; a separate owner step
```

Example fixed before the production rollout and left without retrospective
updates:

```text
FACT:          O3 libcrypto .text +2.62%
FACT:          AES throughput difference -0.17%
INTERPRETATION: AES — effectively a tie within observed variation
DECISION:       production optimization policy does not change yet
```

## Rules

### Rule 1 — one variable changes

For an O2/O3 comparison, package version, compiler, linker, CPU target, USE
flags, dependencies, LTO policy, runtime libraries, and benchmark workload are
identical. Only `-O2` ↔ `-O3` changes.

### Rule 2 — Clang 23 is fixed

The compiler is Clang 23 and the linker is LLD 23 (slot 23 absolute paths).
Experiment B is not an LLVM 22 vs LLVM 23 benchmark.

### Rule 3 — preserve package-native policy

If an ebuild disables LTO itself (for example, OpenSSL `filter-lto`), do not
re-enable LTO. If package-specific policy disables LTO, preserve it identically
for O2 and O3. The benchmark represents real Gentoo build policy, not an
artificial configuration.

### Rule 4 — buildpkgonly

Where possible, build through `--buildpkgonly` in separate PKGDIRs:

```text
/tmp/<package>-o2-pkgs
/tmp/<package>-o3-pkgs
```

The live system does not change, both builds are retained simultaneously, and
side-by-side analysis is possible.

### Rule 5 — provenance before the benchmark

Before the runtime test, confirm from binpkg metadata/environment: `CC`,
`CXX`, `AR`, `NM`, `RANLIB`, `CFLAGS`, `CXXFLAGS`, `LDFLAGS`, and LTO state. Do
not trust only the emerge launch command line.

### Rule 6 — isolated runtime trees

Run unpacked O2/O3 builds with their own libraries through `LD_LIBRARY_PATH`
(check `ldd` or equivalent). Do not allow an “O2 executable + system/O3
library” situation.

### Rule 7 — correctness before performance

Before the benchmark: smoke test; round-trip / decode verification /
deterministic result where applicable; both builds must be functionally
correct. A benchmark of a broken binary is meaningless.

### Rule 8 — one physical core

Pin single-thread benchmarks with `taskset -c <same P-core>`. The standard for
this machine is CPU 2 (P-core), unless there is a separate reason to select
another. Do not mix P-core and E-core samples.

### Rule 9 — warm-up

Before measured samples, warm up both builds (not part of the measurement).
Goals: stabilize filesystem/page cache, load libraries, warm branch
predictor/code, and reduce cold-start effects. Warm-up does not fully remove
thermal and system noise; that is not claimed.

### Rule 10 — symmetric order

The standard order of measured runs:

```text
O2, O3, O3, O2, O3, O2, O2, O3
```

4 samples of each variant. Goals: reduce temporal bias, distribute both
levels over the benchmark session, and avoid running all O2 then all O3. For a
noisy workload, increase samples while retaining a balanced/interleaved order.

### Rule 11 — sufficiently long workloads

A measured run must be long enough that the expected runtime difference exceeds
startup noise. Avoid short synthetic microbenchmarks unless necessary.

### Rule 12 — fixed-work vs fixed-time

- Fixed-work workload (same input and operations): compare `task-clock`,
  `cycles`, and `instructions` directly.
- Fixed-time workload (`openssl speed` and similar): raw totals must NOT be
  compared directly between branches — the faster variant processes more data
  in the same time. Normalization is mandatory: `cycles/byte`,
  `instructions/byte`, `branches/byte`; processed bytes come from
  throughput/operation count.

### Rule 13 — code-size metrics

Minimum for each build: ELF `.text`, file size, and where useful binpkg size.
Use `size` and `stat`, not only `ls -lh`.

### Rule 14 — build-cost metrics

Use `/usr/bin/time -v`: user/system/wall time, Maximum RSS, filesystem
inputs/outputs, CPU utilization. One build run is not sufficient evidence for a
compile-time-performance conclusion; if build timing becomes a decision factor,
use repeated controlled builds.

### Rule 15 — runtime metrics

Minimum: task-clock or throughput, cycles, instructions, IPC. Where useful,
also branches, branch misses, cache counters, and domain-specific metrics.

### Rule 16 — frequency sanity check

Calculate `cycles / task-clock` to check whether different average CPU
frequency explains the result. This is not complete thermal validation.

### Rule 17 — variability

For samples calculate at minimum mean, median, and CV (relative variation). Do
not draw a strong conclusion from a difference inside ordinary observed noise.

### Rule 18 — no predetermined winner

The goal is not to prove “O2 is better” or “O3 is better,” but to determine a
measured trade-off among speed / code size / stability for particular workloads.

## Interpretation framework

Result classifications (a framework, not hard numeric thresholds):

- **Strong O3 candidate**: a clear repeatable runtime benefit, noticeably
  larger than measurement noise; a code-size cost acceptable for the workload.
- **Weak / questionable O3 candidate**: a ~0–2% benefit, substantial code
  growth, benefit at the boundary of benchmark variation.
- **O2-favored workload**: no meaningful benefit or a regression, while O3
  increases code size.

## Interpretation limits

- Generic cache events on an Intel hybrid PMU are comparatively noisy, and
  Experiment B benchmarks were not designed to isolate particular cache
  hierarchies: do not make strong causal conclusions about cache behavior. The
  central decision relies primarily on throughput, cycles/byte,
  instructions/byte, and code size.
- Record each gate's scope explicitly (algorithms, buffers, core, versions,
  hardware, compiler), and do not automatically generalize beyond it.
- Overclaiming is prohibited: statements such as “O2 is universally faster,”
  “O3 is useless,” “O3 breaks cache performance,” “LLVM 23 prefers O2,” or
  “OpenSSL O3 is broken” are unsupported and are not used.
- `.text` growth creates a potential instruction-cache trade-off, but without
  direct isolation of i-cache effects, the causal claim “O3 is slower because
  of i-cache” is not made.

## Related records

- [Decision record: `optimization-o2-o3.md`](../optimization-o2-o3/)
- [Measurement record: `o2-o3-benchmarks.md`](../o2-o3-benchmarks/)
- [Gate journal: `results.md`](../results/)
- [Experiment overview: `README.md`](../)
