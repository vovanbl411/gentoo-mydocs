---
title: "`-march=alderlake` vs `-march=x86-64-v3`"
kind: reference
scope: system
status: historical
last_verified: "2026-10-10"
verified_on: [asus-b5402]
---

## Current decision and result

The ASUS B5402 keeps the userspace target `-march=alderlake`. The
`gentoo-builder-01`, which produces portable userspace binpkgs, uses
`-march=x86-64-v3`.

No practically significant runtime regression from V3 was found in the three
tested workload classes: compression/decompression, cryptography, and Mesa
shader compilation. These results support the builder policy, but do not prove
that the targets are equivalent for all packages or justify changing the
workstation target.

## Question

How significant is the runtime performance penalty of using portable
`-march=x86-64-v3` instead of workstation-specific `-march=alderlake` for
binpkgs produced by a separate build host?

## Why this was tested

The builder needs a portable userspace target, while the ASUS B5402 continues
to build packages for its Alder Lake CPU. The comparison checked runtime
behavior across representative workloads on that processor.

## Experimental setup

The tested packages were `app-arch/zstd-1.5.7-r1`, OpenSSL 3.5.8, and Mesa
26.2.4. Builds were compared on an ASUS ExpertBook B5402CBA with an Intel Core
i7-1260P; Mesa used the Alder Lake-P GT2 / Iris Xe integrated graphics.
Workload-specific parameters are listed below.

The owner supplied the comparison and results on 2026-10-10. This document
records the empirical evidence and accepted policy; it is not a new audit of
the current configuration.

## Methodology

Builds using `-march=alderlake` and `-march=x86-64-v3` were compared. OpenSSL
and Mesa used interleaved runs. Mesa was warmed up before measurement, with
the shader cache disabled. Run counts, CPU affinity, commands, and other
caveats vary by workload and are listed with the detailed results.

## Results

| Workload | Observation |
|----------|-------------|
| zstd compression/decompression | Alder Lake was about 0.35% and 0.33% faster, respectively; no practically significant V3 loss was found. |
| OpenSSL crypto | Differences ranged from ≈ 0.04% to ≈ 0.55%; sub-percent results do not establish an advantage for either target. |
| Mesa shader-db | V3 had about 4.37% lower mean wall time and 6.93% lower median; the small number of runs and higher Alder Lake variability do not let us attribute the advantage to the CPU target. |

### zstd

Median compression and decompression speeds differed by about 0.35% and
0.33% in favor of Alder Lake; no practically significant V3 loss was found.

### OpenSSL

Differences across the three crypto workloads were sub-percent and do not
establish an advantage for either target.

### Mesa

V3 had lower mean and median wall times, but the small number of runs and
Alder Lake variability do not support confidently attributing this to the CPU
target.

## Interpretation

V3 showed no practically significant runtime regression in any of the three
tested workloads. Differences in zstd and OpenSSL were small. Mesa shader-db
was faster with V3, but Alder Lake runs were considerably more variable and
the sample was small; the advantage cannot confidently be attributed to the
CPU target.

The conclusion is limited to these packages, versions, and workloads. Within
the available evidence, it supports `x86-64-v3` for the accepted builder
policy; it does not establish universal equivalence between the targets.

## Decision

```text
ASUS B5402 workstation:
    -march=alderlake

gentoo-builder-01 portable userspace binpkg:
    -march=x86-64-v3
```

The workstation keeps its Alder Lake target. Portable V3 is used for
userspace binpkgs produced by the separate build host.

## Limitations

- Only zstd 1.5.7-r1, OpenSSL 3.5.8, Mesa 26.2.4, and the workloads listed
  below were tested.
- Measurements ran on an ASUS B5402CBA with an i7-1260P; they do not represent
  every runtime workload or hardware platform.
- OpenSSL differences were below one percent. The small number of runs and
  Mesa variability do not support confidently attributing small differences
  to a specific CPU target.
- The results do not prove that `-march=alderlake` and
  `-march=x86-64-v3` are equivalent in general and do not justify changing
  the workstation target.

## Detailed results

### zstd 1.5.7-r1 — compression and decompression

Both builds are `app-arch/zstd-1.5.7-r1`: the workstation target is
`-march=alderlake`, the builder target is `-march=x86-64-v3`; the other
material production policy is comparable. The execution host is an ASUS
ExpertBook B5402CBA, Intel Core i7-1260P, pinned to CPU 1 via `taskset`.
Input: `Rocky-8.10-x86_64-boot.iso`, 1086324736 bytes; `zstd -b3 -e3`,
6 runs per variant. The table reports median speeds.

| Workload | `-march=alderlake`, MB/s | `-march=x86-64-v3`, MB/s | Observed difference |
|----------|-------------------------|-------------------------|---------------------|
| Compression | 815.5 | 812.7 | Alder Lake ≈ +0.35% |
| Decompression | 5746.7 | 5728.0 | Alder Lake ≈ +0.33% |

No practically significant loss from portable V3 was found for this workload.

### OpenSSL 3.5.8 — cryptography

Both builds are OpenSSL 3.5.8. The execution host is the same i7-1260P,
CPU 1; 3 interleaved runs per variant, `openssl speed`, 16384-byte blocks,
a 5-second window. The OpenSSL runtime CPU capability mask was identical.
The table reports median throughput.

| Workload | `-march=alderlake`, kB/s | `-march=x86-64-v3`, kB/s | Observed difference |
|----------|-------------------------|-------------------------|---------------------|
| SHA-256 | 1,056,758 | 1,057,178 | V3 ≈ +0.04% |
| AES-256-GCM | 3,321,747 | 3,340,073 | V3 ≈ +0.55% |
| ChaCha20 | 1,869,817 | 1,866,987 | Alder Lake ≈ +0.15% |

Sub-percent differences do not establish a real advantage for either build.
No practically significant V3 regression was found in any of the three crypto
workloads.

### Mesa 26.2.4 — shader compilation

Mesa 26.2.4 builds were compared using Mesa shader-db on real Intel
Alder Lake-P GT2 / Iris Xe hardware with the real iris userspace driver.
CPU 2, `-j1`, shader cache disabled; warm-up preceded the measured runs.
Separate Mesa trees were selected via `LD_LIBRARY_PATH` /
`LIBGL_DRIVERS_PATH`. There were 3 interleaved measured runs per variant;
each run compiled 8539 shaders.

| Wall time | `-march=alderlake`, s | `-march=x86-64-v3`, s |
|-----------|----------------------|----------------------|
| Run 1 | 113.494 | 103.311 |
| Run 2 | 104.167 | 107.721 |
| Run 3 | 113.034 | 105.198 |
| Mean | ≈ 110.232 | 105.410 |
| Median | 113.034 | 105.198 |

V3 showed ≈ 4.37% lower mean wall time and ≈ 6.93% lower median wall time.
This does not prove that V3 is faster: the Alder Lake runs vary considerably
more, and the sample is small. `x86-64-v3` showed no runtime regression in
this shader-db workload; the observed V3 advantage cannot confidently be
attributed to the CPU target.
