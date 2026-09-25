---
title: -O2 vs -O3 benchmarks (Experiment B)
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

This is the measurement record for Experiment B. It preserves the raw data,
derived metrics, methodological notes, and limitations for B1–B4.

> **Status**:
>
> - B1–B4 — COMPLETE;
> - final review — COMPLETE;
> - optimization policy decision — COMPLETE;
> - the policy was applied to `/etc/portage` on 2026-09-20;
> - the full `@world` rebuild with `-O2` completed on 2026-09-21;
> - post-rebuild boot/runtime were verified.

Source-of-truth boundaries:

- the current production state of the system is in
  [`../../systems/asus-b5402/system/boot-and-portage.md`](../../../systems/asus-b5402/system/boot-and-portage/);
- the detailed decision record is in
  [optimization-o2-o3.md](../optimization-o2-o3/);
- the canonical methodology is in
  [benchmark-methodology.md](../benchmark-methodology/);
- the gate journal is in [results.md](../results/).

B1–B4 are benchmark results, not validation gates. “PASS” is not used here:
neither optimization level is a “test success”.

## 1. Measurement principle

Each A/B changes exactly one optimization level. The compiler (Clang 23),
linker (LLD 23), `-march=alderlake`, LTO mode under the package/ebuild policy
(ThinLTO in B1/B2, no LTO in B3/B4), libstdc++/libgcc/libgcc_s, package
version, and workload remain unchanged.

## 2. Build methodology

- Both versions are built with `--buildpkgonly` into separate PKGDIRs; the
  live system is unaffected.
- The toolchain is called only through absolute paths from slot 23
  (`/usr/lib/llvm/23/bin/...`).
- During the design/checkpoint stage before the rollout decision, a permanent
  `env/llvm-23` was not created: rollout was deferred until the optimization
  baseline was decided.

## 3. Runtime measurement methodology (B1)

Fixed HEVC benchmark:

```text
/tmp/libde265-bench.hevc
~21 MB, 1920x1080, 60 fps source, 30 seconds
```

Invocation:

```text
dec265 -q -t 1
```

- decoding without display output;
- exactly one decoder thread.

CPU affinity:

```text
CPU 2 — P-core (core 1), max frequency 4.7 GHz; SMT-sibling — CPU 3
```

The process is pinned to CPU 2 with `taskset`. The counters are from `perf stat`:
task-clock, cycles, instructions, branches, branch-misses, cache-references,
cache-misses.

Order of measured runs (both versions completed warm-up beforehand):

```text
1 O2, 2 O3, 3 O3, 4 O2, 5 O3, 6 O2, 7 O2, 8 O3
```

A total of 4 samples per level.

On a hybrid Intel PMU, lines such as `cpu_atom/... <not counted>` are expected:
the process is pinned to a P-core. The valid counters are `cpu_core/*` with 100%
measured time.

## 4. B1 — libde265-1.1.3

Why it was chosen: a compute-heavy C++ codec, suitable for a real runtime
benchmark; supports a fixed HEVC bitstream; allows a single-thread benchmark;
small enough for repeatable builds.

### 4.1 Build cost (raw timings)

| Metric | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| User time | 67.89 s | 69.84 s | +2.87% |
| System time | 10.63 s | 11.26 s | +5.93% |
| Wall time | 27.42 s | 28.32 s | +3.28% |
| Max RSS | 182716 KiB | 184740 KiB | +1.11% |

> ⚠️ **Important nuance**: these build-time figures are auxiliary and do not
> constitute a robust benchmark: one build run was performed for each variant
> with differing filesystem-cache state (`File system inputs`: O2 = 9720,
> O3 = 0). The conclusion “O2 compiles 3.28% faster” cannot be made. Serious
> build-time conclusions require repeated controlled builds.

### 4.2 Code size

This is the direct and reproducible result from two completed ELFs.

`libde265.so`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 576615 | 3328 | 18275 | 582808 |
| O3 | 647595 | 3328 | 21011 | 653800 |
| O3 vs O2 | +12.31% | = | — | +12.18% |

`dec265`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 16632 | 1816 | 2048 | 21504 |
| O3 | 18492 | 1816 | 192 | 23360 |
| O3 vs O2 | +11.18% | = | — | +8.63% |

binpkg:

```text
O2 = 337920 bytes, O3 = 368640 bytes → +9.09%
```

The main size observation: on this workload, `-O3` increased the `.text` of
the main library by about 12.3%. That is not itself a “problem”; code growth
is assessed together with runtime performance.

### 4.3 Raw runtime samples

O2 (runs 1, 4, 6, 7):

| Counter | Run 1 | Run 4 | Run 6 | Run 7 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 21731.69 | 22003.41 | 21839.04 | 21814.05 |
| cycles | 46690276038 | 47255483294 | 46910346329 | 46946088203 |
| instructions | 141635129334 | 141635236109 | 141635425518 | 141635431312 |
| branches | 19642874220 | 19642888401 | 19642915757 | 19642910961 |
| branch-misses | 239842775 | 240134715 | 239459934 | 241801223 |
| cache-references | 942489409 | 950215150 | 943852950 | 948821984 |
| cache-misses | 687022658 | 693481193 | 691350274 | 692593020 |

O3 (runs 2, 3, 5, 8):

| Counter | Run 2 | Run 3 | Run 5 | Run 8 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 21588.60 | 21463.31 | 21698.80 | 21596.33 |
| cycles | 46461951992 | 46110277119 | 46614916994 | 46438829343 |
| instructions | 139073672292 | 139073298961 | 139072953284 | 139073137924 |
| branches | 20039257780 | 20039212216 | 20039168892 | 20039191967 |
| branch-misses | 236171520 | 236463037 | 237613644 | 237622513 |
| cache-references | 934415295 | 939829363 | 949502531 | 944262287 |
| cache-misses | 684544511 | 686057321 | 693593821 | 690624986 |

### 4.4 Derived values (means of 4 runs)

| Metric | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| task-clock | 21.847 s | 21.587 s | -1.19% |
| cycles | 46.95 B | 46.41 B | -1.16% |
| instructions | 141.64 B | 139.07 B | -1.81% |
| IPC | ~3.017 | ~2.997 | -0.66% |
| branches | 19.64 B | 20.04 B | +2.02% |
| branch miss rate | ~1.223% | ~1.183% | slightly better |
| cache references | ~946.3 M | ~942.0 M | -0.46% |
| cache miss rate | ~73.03% | ~73.11% | virtually unchanged |

Sample variation (task-clock): O2 CV ≈ 0.52%, O3 CV ≈ 0.45%.

Mean effective frequency (cycles / task-clock): O2 ≈ 2.149 GHz,
O3 ≈ 2.150 GHz, virtually the same. The measured difference therefore does
not appear to result from a systematically different average frequency.

### 4.5 Interpretation

Key factual result:

```text
O3 runtime improvement ≈ 1.2%
O3 instructions        ≈ -1.8%
O3 libde265 .text      ≈ +12.3%
```

> For this specific single-thread libde265 HEVC decode workload, `-O3` yielded
> a small but reproducible runtime gain of about 1.2%, while increasing the
> `.text` of the main library by about 12.3%.

Observations:

- O3 executes fewer instructions and uses slightly fewer cycles;
- O3 IPC is slightly lower; branch count is higher, but branch miss rate is
  slightly better;
- cache miss rate is virtually unchanged;
- mean effective CPU frequency is the same.

> ⚠️ **Important nuance**: do not treat the `.text` growth as proof that it
> worsened the instruction cache; the available perf counters did not prove it.

### 4.6 Meaning for the optimization policy

B1 strengthens the `global -O2 + selective -O3` hypothesis: on a compute-heavy
codec, O3 buys a small runtime gain at the cost of a noticeably larger machine
code footprint. One codec workload is insufficient to change the system-wide
optimization policy.

At the checkpoint after B1, there were no changes to `make.conf`, `package.env`,
or the production policy; a package-specific `-O3` rule for libde265 was not
created, because at that stage this was only an experimental result. The owner
still selected the packages for the following gates (criteria in
[optimization-o2-o3.md](../optimization-o2-o3/)).

## 5. B2 — app-arch/zstd-1.5.7-r1

Workload class: compression/decompression, C, a real-world compression library,
and CLI.

Why it was chosen: a fundamentally different workload from codec B1; it has
real compression and decompression paths; uses the same corpus; its runtime is
easy to measure single-threaded; and the package is small and cheap to rebuild.

Both builds use Clang 23 + LLD 23 + `-march=alderlake` + ThinLTO + the same
runtime stack, package version, and USE/dependencies. The only intentional
difference is `-O2` ↔ `-O3`. Builds use `--buildpkgonly` into separate PKGDIRs:
`/tmp/zstd-o2-pkgs` and `/tmp/zstd-o3-pkgs`.

### 5.1 Build cost (auxiliary observation)

| Metric | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| User time | 91.75 s | 95.73 s | +4.34% |
| System time | 14.25 s | 14.58 s | +2.32% |
| Wall time | 38.08 s | 36.69 s | -3.65% |
| Max RSS | 204724 KiB | 216836 KiB | +5.92% |

> ⚠️ **Important nuance**: these build-time results are not a robust benchmark:
> `File system inputs` differed (O2 = 15560, O3 = 0), as did CPU utilization
> (O2 ≈ 278%, O3 ≈ 300%). Neither “O3 builds faster” nor “O2 builds faster”
> can be written as a robust conclusion; this is only an auxiliary observation.

### 5.2 Code size

`zstd` CLI:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 197973 | 4800 | 4032 | 205808 |
| O3 | 203330 | 4800 | 6864 | 211168 |
| O3 vs O2 | +2.71% | = | — | +2.60% |

`libzstd.so.1.5.7`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 832540 | 2424 | 4000 | 837784 |
| O3 | 909186 | 2408 | 1088 | 914424 |
| O3 vs O2 | +9.21% | ≈ | — | +9.15% |

The main B2 size result: `-O3` increased the `.text` of the primary
`libzstd.so` by about 9.2%.

### 5.3 Corpus and isolation

Real corpus from the sources of the current Linux kernel tree:

```text
/usr/src/linux → include, kernel, mm, fs included
/tmp/zstd-bench-kernel.tar      ~53 MB (tar)
/tmp/zstd-bench-kernel.tar.zst  ~11 MB (compressed reference, zstd -3 -T1)
```

Both experimental versions ran with their own libraries via `LD_LIBRARY_PATH`;
it was confirmed that the O2 executable uses O2 `libzstd` and O3 uses O3
`libzstd`. Accidental use of the installed system `libzstd` was excluded. The
record did not preserve a sha256 of the results, so no value is substituted.

### 5.4 Runtime methodology

As in B1: CPU 2 (P-core), `taskset -c 2`, `perf stat`, warm-up of both
versions, and measured-run order `1 O2, 2 O3, 3 O3, 4 O2, 5 O3, 6 O2, 7 O2,
8 O3`, giving 4 samples per level. Counters: `cpu_core/*` (task-clock,
cycles, instructions, branches, branch-misses, cache-references, cache-misses).

Repetitions within one measured run:

```text
compression:   zstd -3 -T1, 50 repetitions
decompression: zstd -d,      150 repetitions
```

Compression and decompression were measured separately.

### 5.5 Raw compression samples

O2 (runs 1, 4, 6, 7):

| Counter | Run 1 | Run 4 | Run 6 | Run 7 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 18286.78 | 18497.96 | 18374.85 | 18439.38 |
| cycles | 35530101132 | 35956814961 | 35790875150 | 35897949117 |
| instructions | 71524689048 | 71799279991 | 71711122335 | 71583323202 |
| branches | 7409139778 | 7474375647 | 7453762900 | 7422987741 |
| branch-misses | 279061831 | 279023257 | 279036896 | 279302147 |
| cache-references | 1219579285 | 1171009639 | 1194789038 | 1265494373 |
| cache-misses | 172547809 | 185006451 | 182128247 | 170231124 |

O3 (runs 2, 3, 5, 8):

| Counter | Run 2 | Run 3 | Run 5 | Run 8 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 18077.36 | 17227.58 | 19000.05 | 18116.24 |
| cycles | 35274746771 | 34422881748 | 36839070554 | 35149848483 |
| instructions | 70085531557 | 69838802299 | 69806564589 | 69172273018 |
| branches | 7241342218 | 7181959381 | 7174395814 | 7022218791 |
| branch-misses | 278028365 | 277749107 | 278357603 | 278082232 |
| cache-references | 1241326989 | 1206209761 | 1193935364 | 1242888787 |
| cache-misses | 163883144 | 173585391 | 207527397 | 168301335 |

### 5.6 Derived compression values (means of 4 runs)

| Metric | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| task-clock | ~18.400 s | ~18.105 s | ~-1.60% |
| median task-clock | ~18.407 s | ~18.097 s | ~-1.69% |
| cycles | ~35.79 B | ~35.42 B | ~-1.04% |
| instructions | ~71.65 B | ~69.73 B | ~-2.69% |
| IPC | ~2.002 | ~1.968 | ~-1.67% |
| branches | ~7.440 B | ~7.155 B | ~-3.83% |
| branch miss rate | ~3.75% | ~3.89% | slightly worse |
| cache miss rate | ~14.63% | ~14.60% | virtually unchanged |

Sample variation (task-clock): O2 CV ≈ 0.49%, O3 CV ≈ 4.00%.

> Compression with `-O3` is about 1–2% faster for this workload, but variation
> in O3 samples is noticeably greater than in O2 (mainly because of run 5), so
> the exact gain should not be overstated.

Observations: O3 executes fewer instructions and uses fewer cycles; IPC is
slightly lower; branch count is lower; branch miss rate is slightly worse;
cache miss rate is effectively unchanged.

### 5.7 Raw decompression samples

O2 (runs 1, 4, 6, 7):

| Counter | Run 1 | Run 4 | Run 6 | Run 7 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 13789.92 | 13712.38 | 14209.12 | 13798.00 |
| cycles | 26384291959 | 26267484060 | 27120061864 | 26308901048 |
| instructions | 94824041918 | 94824066908 | 94824061984 | 94824022872 |
| branches | 10298262278 | 10298257328 | 10298266523 | 10298261676 |
| branch-misses | 223569056 | 222822396 | 223932994 | 223363940 |
| cache-references | 311863508 | 300013735 | 307793287 | 314804547 |
| cache-misses | 53753848 | 52540086 | 71666073 | 48958518 |

O3 (runs 2, 3, 5, 8):

| Counter | Run 2 | Run 3 | Run 5 | Run 8 |
|---------|-------|-------|-------|-------|
| task-clock, ms | 13774.02 | 14057.35 | 14809.65 | 13895.89 |
| cycles | 26449476930 | 26881085468 | 28257910205 | 26537616338 |
| instructions | 94756939397 | 94756946738 | 94756932413 | 94756893507 |
| branches | 10262609884 | 10262605340 | 10262609410 | 10262605615 |
| branch-misses | 234970867 | 234680362 | 234907628 | 234483988 |
| cache-references | 316081454 | 310299468 | 318353459 | 317565939 |
| cache-misses | 48256530 | 60574041 | 90462898 | 50120655 |

### 5.8 Derived decompression values (means of 4 runs)

| Metric | O2 | O3 | O3 vs O2 |
|---------|-----|-----|----------|
| task-clock | ~13.877 s | ~14.134 s | ~+1.85% |
| median task-clock | ~13.794 s | ~13.977 s | ~+1.32% |
| cycles | ~26.52 B | ~27.03 B | ~+1.93% |
| instructions | ~94.824 B | ~94.757 B | ~-0.07% |
| IPC | ~3.576 | ~3.505 | ~-1.96% |
| branches | ~10.298 B | ~10.263 B | ~-0.35% |
| branch miss rate | ~2.17% | ~2.29% | worse |
| cache metrics | noisy | noisy | no reliable conclusion |

> Decompression with `-O3` is about 1–2% slower, with an almost unchanged
> instruction count.

Main observation: O3 did not reduce the decompression instruction count by a
meaningful amount, but required more cycles; IPC is lower, branch miss rate is
worse, and measured runtime is slower. The decompression cache counters are
noticeably noisy, so no deep conclusion is drawn from them.

### 5.9 Frequency sanity check

Mean effective frequency (cycles / task-clock):

```text
Compression:   O2 ≈ 1.945 GHz, O3 ≈ 1.956 GHz
Decompression: O2 ≈ 1.911 GHz, O3 ≈ 1.912 GHz
```

> Runtime differences are not explained by a systematic O2/O3 difference in
> mean frequency.

### 5.10 Central B2 result

```text
libzstd .text:  O3 ≈ +9.2%
compression:    O3 ≈ 1–2% faster
decompression:  O3 ≈ 1–2% slower
```

> `-O3` substantially increased the code footprint of the primary library,
> while producing mixed runtime results: a small compression improvement and a
> small decompression degradation.

This result matters more than any individual perf counter.

### 5.11 Interpretation

B2 demonstrated an important point:

> Even within one package, `-O3` can improve one hot path and worsen another.

Therefore, even package-specific `-O3` cannot automatically be considered the
ideal policy solely because a package is “performance-sensitive”. The converse,
“O3 is always bad” or “O2 is always better,” is also false. The correct
conclusion is:

> An optimization level must be assessed from the actual workload mix and the
> measured trade-off, not from an assumption that a higher optimization level
> is automatically better.

> ⚠️ **Important nuance**: larger `.text` creates a potential instruction-cache
> trade-off, but this benchmark did not directly isolate instruction-cache
> effects; the causal conclusion “O3 is slower because of a larger i-cache
> footprint” is not proven.

## 6. B3 — dev-libs/openssl-3.5.8

Class: cryptography; C / assembly-heavy; production crypto implementation.
B3 adds a third workload class to the study: codec (B1),
compression/decompression (B2), crypto (B3).

### 6.1 Gentoo OpenSSL build-policy characteristic

The Gentoo OpenSSL ebuild itself runs `filter-lto` and removes ThinLTO from the
build flags: upstream OpenSSL does not consider LTO a normally supported and
regularly tested configuration. Therefore:

```text
B1: ThinLTO
B2: ThinLTO
B3: no LTO — under the ebuild policy, the same for both branches
```

This is not a deficiency in the experiment: B3 tests O2/O3 in another real
production configuration (Rule 3 of the methodology: package-native policy is
preserved).

### 6.2 Controlled-variable design

Identical in both branches: `dev-libs/openssl-3.5.8`; Clang 23; LLD 23;
`-march=alderlake`; runtime/dependencies; package configuration; LTO disabled
by the ebuild. The only intentional difference is `-O2` ↔ `-O3`.

### 6.3 Provenance

Both builds use `--buildpkgonly`:

```text
O2: /tmp/openssl-o2-pkgs/dev-libs/openssl/openssl-3.5.8-1.gpkg.tar
O3: /tmp/openssl-o3-pkgs/dev-libs/openssl/openssl-3.5.8-1.gpkg.tar
```

Environment for both branches (the difference is only the optimization level):

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS = -march=alderlake -O2|-O3 -pipe -mno-kl -mno-pconfig
         -mno-sgx -mno-widekl -mshstk -Qunused-arguments
         -fno-strict-aliasing -Wa,--noexecstack
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld
```

> ⚠️ **Important nuance**: `-flto=thin` is absent from both branches under the
> ebuild policy. B3 is a clean O2/O3 comparison without LTO.

### 6.4 Build cost (auxiliary observation)

| Metric | O2 | O3 |
|---------|----|----|
| User time | 751.77 s | 751.57 s |
| System time | 256.78 s | 256.22 s |
| Wall time | 5:21.60 | 4:23.87 |
| Max RSS | 153008 KiB | 153228 KiB |
| CPU usage | 313% | 381% |

```text
O2: filesystem inputs 5160, outputs 105216
O3: filesystem inputs 3120, outputs 800
```

> ⚠️ **Important nuance**: O3’s smaller wall-clock time does NOT prove that O3
> compiles faster. User time and system time are virtually identical, CPU
> utilization and filesystem state/outputs differed substantially, and one
> build run was performed for each variant. Build-time data remains auxiliary.

### 6.5 Code size

`openssl` CLI:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 998556 | 108000 | 22056 | 1109584 |
| O3 | 1012212 | 108000 | 20728 | 1123232 |
| O3 vs O2 | +1.37% | = | — | +1.23% |

`libcrypto.so.3`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 5489884 | 496424 | 14904 | 5989928 |
| O3 | 5633716 | 496296 | 14376 | 6133816 |
| O3 vs O2 | +2.62% | ≈ | — | +2.40% |

`libssl.so.3`:

| | text | data | bss | file size |
|--|------|------|------|-----------|
| O2 | 985286 | 53116 | 3120 | 1041264 |
| O3 | 1027022 | 53084 | 2368 | 1082976 |
| O3 vs O2 | +4.24% | ≈ | — | +4.01% |

Comparison of the main B1–B3 libraries:

```text
B1 libde265:  O3 main-library .text ≈ +12.3%
B2 libzstd:   O3 main-library .text ≈ +9.2%
B3 libcrypto: O3 main-library .text ≈ +2.6%
```

The magnitude of code growth depends on the package/workload; the conclusion
“O3 always increases `.text` by the same amount” would be incorrect.

### 6.6 Isolation

Both versions ran with their own libraries through `LD_LIBRARY_PATH`:

```text
O2: libssl.so.3, libcrypto.so.3
    → /tmp/openssl-o2-image/image/usr/lib64/
O3: libssl.so.3, libcrypto.so.3
    → /tmp/openssl-o3-image/image/usr/lib64/
```

Accidental use of the installed system OpenSSL was excluded.

### 6.7 Runtime methodology

The standard `openssl speed` benchmark. Algorithms and reasons for selection:

```text
AES-256-CTR — hardware-accelerated / heavily optimized crypto path
SHA-256     — digest workload
ChaCha20    — stream cipher, different implementation characteristics
```

Parameters: 16384-byte buffer, 10-second measurement window
(`-elapsed -seconds 10 -bytes 16384 -mr -evp <algorithm>`). Runtime
environment: `taskset -c 2` (P-core), each branch’s `LD_LIBRARY_PATH`, and
`OPENSSL_CONF=/dev/null` to reduce the influence of the system OpenSSL
configuration.

Warm-up: 2-second `openssl speed` for each algorithm and each branch (same
CPU, algorithm, and buffer size); it is not included in measured samples.

The measured-run order is symmetrical for each algorithm:

```text
1 O2, 2 O3, 3 O3, 4 O2, 5 O3, 6 O2, 7 O2, 8 O3
```

4 samples of each level for every crypto workload. The order reduces
systematic warm/cold bias and the influence of gradual thermal drift, rather
than running all samples of one level first. In parallel, `perf stat` collected
`cpu_core/*` counters (the process is pinned to a P-core; hybrid `cpu_atom`
counters are not used).

> ⚠️ **Key methodological point — time-based semantics**: `openssl speed`
> performs work for a fixed duration (10 seconds), rather than on a fixed data
> volume. The faster variant processes more data in the same 10 seconds, so raw
> cycles/instructions/branches for O2 and O3 cannot be directly compared as
> “necessary work”. Raw perf totals are used only with throughput; counters are
> normalized per processed byte (`cycles/byte`, `instructions/byte`,
> `branches/byte`), and processed bytes come from throughput/operation count.

### 6.8 Raw throughput samples

AES-256-CTR, B/s:

| Branch | s1 | s2 | s3 | s4 |
|-------|----|----|----|----|
| O2 (runs 1,4,6,7) | 4469612544.00 | 4504633344.00 | 4531491635.20 | 4533325004.80 |
| O3 (runs 2,3,5,8) | 4520530739.20 | 4528771891.20 | 4475356774.40 | 4484456448.00 |

SHA-256, B/s:

| Branch | s1 | s2 | s3 | s4 |
|-------|----|----|----|----|
| O2 (runs 1,4,6,7) | 1039613952.00 | 1043352780.80 | 1037153075.20 | 1046799974.40 |
| O3 (runs 2,3,5,8) | 1039281356.80 | 1043116851.20 | 1033946726.40 | 1028004249.60 |

ChaCha20, B/s:

| Branch | s1 | s2 | s3 | s4 |
|-------|----|----|----|----|
| O2 (runs 1,4,6,7) | 1806598144.00 | 1788937830.40 | 1810109235.20 | 1819310489.60 |
| O3 (runs 2,3,5,8) | 1810718720.00 | 1815112908.80 | 1762911846.40 | 1751713382.40 |

### 6.9 Derived throughput

AES-256-CTR:

| Metric | O2 | O3 |
|---------|----|----|
| mean | 4509765632 B/s | 4502278963 B/s |
| O3 vs O2 (mean) | ≈ -0.17% | |
| median | ≈ 4.518 GB/s | ≈ 4.502 GB/s |
| CV | ≈ 0.66% | ≈ 0.58% |

> AES-256-CTR is effectively a statistical tie at this sample size: there is no
> evidence of a material O3 advantage. “O2 is 0.17% faster” cannot be written,
> because the difference is smaller than usual observed sample variation.

SHA-256:

| Metric | O2 | O3 |
|---------|----|----|
| mean | 1041729945.6 B/s | 1036087296.0 B/s |
| O3 vs O2 (mean) | ≈ -0.54% | |
| median difference | ≈ -0.47% | |
| CV | ≈ 0.41% | ≈ 0.63% |

> O3 has no advantage on SHA-256: measured O3 throughput is about 0.5% lower,
> but the magnitude remains small.

ChaCha20:

| Metric | O2 | O3 |
|---------|----|----|
| mean | 1806238924.8 B/s | 1785114214.4 B/s |
| O3 vs O2 (mean) | ≈ -1.17% | |
| median difference | ≈ -1.19% | |
| CV | ≈ 0.70% | ≈ 1.82% |

> ChaCha20 showed the largest O3 regression among B3 workloads, about 1%, but
> variation in O3 samples is noticeably greater than in O2. “O3 is exactly
> 1.17% slower” cannot be written; “about 1% slower in this benchmark session”
> is correct.

### 6.10 perf normalization (per processed byte)

Approximate normalized values:

| Metric | AES O2 | AES O3 | SHA O2 | SHA O3 | ChaCha O2 | ChaCha O3 |
|---------|--------|--------|--------|--------|-----------|-----------|
| cycles/byte | ≈0.47883 | ≈0.47799 | ≈2.07533 | ≈2.07644 | ≈1.18964 | ≈1.20216 |
| instructions/byte | ≈1.67512 | ≈1.67512 | ≈2.73894 | ≈2.73815 | ≈3.13522 | ≈3.13523 |
| IPC | ≈3.498 | ≈3.505 | ≈1.3198 | ≈1.3187 | ≈2.635 | ≈2.608 |
| effective frequency | ≈2.172 GHz | ≈2.175 GHz | ≈2.173 GHz | ≈2.170 GHz | ≈2.172 GHz | ≈2.172 GHz |

Interpretation by algorithm:

- AES-256-CTR: O2 and O3 perform virtually identical instruction work per byte;
  compiler optimization level has very little effect on this heavily optimized
  crypto hot path.
- SHA-256: the instructions/byte difference is ≈ -0.03%, virtually absent.
- ChaCha20: instructions/byte is virtually identical; O3 cycles/byte is
  ≈ +1.05%, which agrees well with the measured throughput regression.

> ⚠️ **Important nuance**: do not claim without proof that the entire AES path
> runs exclusively in assembly. The correct wording is: OpenSSL AES
> implementations are highly optimized and often use architecture-specific
> code, which can reduce the share of hot-path work dependent on generic
> compiler optimizations. This benchmark is consistent with that possibility,
> but does not isolate it directly.

### 6.11 Frequency sanity check and cache counters

Mean effective frequency across all workloads was approximately the same
(~2.17 GHz), and O2/O3 differences were very small:

> Measured throughput differences are not explained by a systematic O2/O3 shift
> in mean CPU frequency. Thermal effects are not completely excluded.

Branch/cache counters were also collected, but generic cache-event values are
relatively noisy; B3 was not designed to isolate particular cache-hierarchy
events; and Intel hybrid-PMU semantics complicate deep interpretation of generic
cache counters. No strong causal conclusions about cache behaviour are drawn
from B3; the central decision relies primarily on throughput, cycles/byte,
instructions/byte, and code size.

### 6.12 Main B3 result

```text
AES-256-CTR: no O3 advantage (mean ≈ -0.17%, effectively a tie)
SHA-256:     O3 ≈ -0.5%
ChaCha20:    O3 ≈ -1%

libcrypto .text ≈ +2.62%
libssl    .text ≈ +4.24%
openssl CLI .text ≈ +1.37%
```

> In the tested OpenSSL crypto workloads, `-O3` provided no measurable
> performance advantage over `-O2`, while continuing to increase code size.

### 6.13 Scope limitation

B3 tested only AES-256-CTR, SHA-256, and ChaCha20; 16 KiB buffers; one P-core;
single-process `openssl speed`; OpenSSL 3.5.8; Intel Core i7-1260P; and Clang
23. The results apply to this scope and are not automatically generalized to
RSA, ECDSA, TLS handshakes, smaller buffers, multi-threaded workloads, ARM,
other OpenSSL versions, or other crypto libraries.

## 7. B4 — media-libs/mesa-26.2.2

Class: a large desktop/graphics codebase (C/C++), a production package. B4 is
the final benchmark of Experiment B: it completes coverage with a large
graphics stack after codec (B1), compression/decompression (B2), and crypto (B3).

### 7.1 Controlled-variable gate

Both Mesa versions were built with `--buildpkgonly` into separate PKGDIRs:

```text
compiler/linker:  Clang 23 + LLD 23 (absolute paths from slot 23)
CPU target:       -march=alderlake
LTO:              -fno-lto — under package policy (no-lto-llvm), identical
                  in both branches
LLVM dependency:  slot 22
runtime:          GNU (libstdc++/libgcc/libgcc_s) retained
```

The normalized O2/O3 metadata diff is empty: the only intentional difference
is `-O2` ↔ `-O3`. The production system was not moved to either level during the
benchmark; Mesa from the binpkg was not installed.

### 7.2 Build observations (auxiliary)

| Metric | O2 | O3 |
|---------|----|----|
| User time | 2047.09 s | 2029.39 s |
| System time | 237.17 s | 230.23 s |
| Wall time | 9:03.04 | 8:46.35 |
| Max RSS | 2669700 KiB | 2666704 KiB |

> ⚠️ **Important nuance**: one build run per variant. Do not claim that O3
> compiles faster; build timing remains an auxiliary observation (Rule 14 of
> the methodology).

### 7.3 Code size

Binpkg:

```text
O2 = 23132160 bytes, O3 = 24360960 bytes → +5.31%
```

ELF `.text`:

| ELF | O2 | O3 | O3 vs O2 |
|-----|----|----|----------|
| libgallium-26.2.2.so | 32216535 | 33902507 | +5.23% |
| iris_dri.so | 68826 | 68858 | ~+0.05% |
| libvulkan_intel.so | 24704045 | 25886606 | +4.79% |
| libvulkan_intel_hasvk.so | 18767275 | 19691023 | +4.92% |

On a large production graphics codebase, `-O3` again noticeably increases the
code footprint; `iris_dri.so` is virtually unchanged.

### 7.4 Runtime methodology

The workload is Mesa shader-db on a fixed shader corpus:

```text
GPU:           real Intel Alder Lake-P GT2 / Iris Xe [8086:46a6]
Driver:        real iris userspace driver
Mesa trees:    own O2/O3 builds through LIBGL_DRIVERS_PATH and
               LD_LIBRARY_PATH
CPU:           2 (P-core), -j1
Shader cache:  disabled
Warm-up:       before measured runs, not included in samples
Order:         O2, O3, O3, O2, O3, O2, O2, O3 — 4 measured samples per variant
```

Only `cpu_core/*` counters were used for analysis; `cpu_atom/*` was not used
for the final conclusion because the workload is pinned to a P-core.

### 7.5 Derived runtime

| Metric | O2 | O3 | O3 vs O2 |
|---------|----|----|----------|
| task-clock mean | 108.942 s | 108.617 s | ≈ -0.30% |
| task-clock median | 106.569 s | 108.964 s | — |
| task-clock CV | ≈ 4.04% | ≈ 1.20% | — |
| cycles | ≈ 200.78 B | ≈ 196.58 B | ≈ -2.09% |
| instructions | ≈ 500.78 B | ≈ 485.53 B | ≈ -3.04% |
| IPC | ≈ 2.494 | ≈ 2.470 | — |
| branches | ≈ 92.46 B | ≈ 89.60 B | ≈ -3.09% |
| branch miss rate | ≈ 1.718% | ≈ 1.764% | — |
| effective frequency | ≈ 1.845 GHz | ≈ 1.810 GHz | — |

Raw O2 task-clock samples: 106.453, 116.552, 106.076, 106.685 s. One sample
(116.552) is noticeably noisier than the rest. It is not removed after the
fact; the high O2 variation (CV ≈ 4%) is considered in the interpretation.

### 7.6 Interpretation

> B4 found no measurable runtime advantage of `-O3` over `-O2`.

- Mean task-clock differs by ≈ 0.3% with O2 CV ≈ 4%; the difference is deeply
  within ordinary noise, while mean and median have opposite signs.
- `-O3` executed fewer instructions, cycles, and branches, but this did not
  turn into a demonstrated runtime benefit.
- Mean effective frequency differed (O2 ≈ 1.845 GHz, O3 ≈ 1.810 GHz); this is
  an observation, not a proven cause of the result.

The wordings “O3 is 0.3% faster,” “O2 is 2.25% faster,” and causal explanations
of the result through CPU-frequency differences are not used.

### 7.7 Scope limitation

B4 tested only Mesa shader-db on one fixed shader corpus; the real iris
userspace driver on Intel Alder Lake-P GT2 / Iris Xe [8086:46a6]; one P-core
(CPU 2), `-j1`; disabled shader cache; Mesa 26.2.2 without LTO under package
policy; and Clang 23. The result is not automatically generalized to other
drivers (hasvk, zink, swrast), gaming, video, and compute workloads,
multi-thread, E-core, or other Mesa versions.

## 8. B1–B4 summary

| Gate | Workload | LTO | O3 runtime | O3 code size |
|------|----------|-----|------------|--------------|
| B1 | libde265 HEVC decode | ThinLTO | ~1.2% faster | ~+12.3% `.text` |
| B2-C | zstd compression | ThinLTO | ~1–2% faster | ~+9.2% lib `.text` |
| B2-D | zstd decompression | ThinLTO | ~1–2% slower | the same ~+9.2% |
| B3-AES | AES-256-CTR | no LTO | effectively a tie | libcrypto ~+2.6% |
| B3-SHA | SHA-256 | no LTO | ~0.5% slower | libcrypto ~+2.6% |
| B3-ChaCha | ChaCha20 | no LTO | ~1% slower | libcrypto ~+2.6% |
| B4 | Mesa shader-db | no LTO | no measurable advantage | large ELFs ~+5% `.text`, binpkg +5.31% |

Trend after four substantially different workload classes:

> `-O3` increased code footprint in all tested classes, while runtime benefit
> was small, workload-specific, absent, or negative.

This is the outcome of Experiment B. The recorded decision is in
[optimization-o2-o3.md](../optimization-o2-o3/) § 7 and [results.md](../results/).

The study covers C and C++; workloads with ThinLTO and without LTO; codec,
compression, decompression, crypto, and a large desktop/graphics codebase;
fixed-work and time-based throughput benchmarks; small/medium libraries and a
large production package. Experiment B is not a single synthetic microbenchmark.

Production-policy change: the optimization policy decision (2026-09-20) was
applied to `/etc/portage`, making `-O2` the global baseline (`make.conf` and
env files were changed and the resolver recalculated); the full `@world`
rebuild with `-O2` completed on 2026-09-21 (post-rebuild boot/runtime were
verified). No selective rules were created. At the checkpoint recorded in this
report, `env/llvm-23` did not exist; this is the experiment’s historical state,
not a statement about the current system.
