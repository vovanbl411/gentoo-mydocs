---
title: "Experiment log: LLVM 23 toolchain"
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
---

This is the canonical chronological log of the LLVM 23 experiment. For each
gate, it records the date, initial configuration, exact variable changed,
commands, relevant output, PASS/FAIL, evidence, limitations, rollback, and
the next minimal gate. Full build logs are not copied; only reproducible
commands and material results are included.

The recorded outcome of the log is: Experiment A — COMPLETE, Experiment B —
COMPLETE, Experiment C — NOT STARTED. The optimization policy was applied and
the full rebuild completed; the limited LLVM 23 rollout was still NOT STARTED
at the latest checkpoint in this log.

The experiment record is kept here. The current production state of the
machine is described separately in
[`../../systems/asus-b5402/system/boot-and-portage.md`](../../../systems/asus-b5402/system/boot-and-portage/);
the historical values below are not an inventory of the current system.

Numbering: A — LLVM 22→23 (compatibility), B — -O2 vs -O3 (optimization),
C — runtimes. The plan is in [README.md](../), the conceptual model of the
layers is in [toolchain-primer.md](../toolchain-primer/), and the methodology
and B data are in [o2-o3-benchmarks.md](../o2-o3-benchmarks/).

## Statuses

| Experiment | Question | Status |
|-------------|----------|--------|
| A — LLVM 22 → 23 | compatibility of Clang/LLD 23 with the runtime architecture baseline from the experimental period | **COMPLETE** |
| B — -O2 vs -O3 | selecting the global optimization baseline | **COMPLETE** |
| C — runtimes | `libgcc → compiler-rt`, `libgcc_s → libunwind` | NOT STARTED |

| Gate | Status | Gate | Status |
|------|--------|------|--------|
| A1 libde265 | PASS | B1 libde265 | COMPLETE |
| A2 libunistring | PASS | B2 zstd | COMPLETE |
| A3 mesa_clc | PASS | B3 openssl | COMPLETE |
| A4 mesa | PASS | Final B1–B3 review | COMPLETE |
| — | — | B4 mesa | COMPLETE |
| — | — | Optimization policy decision | COMPLETE |
| — | — | Applying the policy to `/etc/portage` | COMPLETE (2026-09-20) |
| — | — | Portage no-LTO exception cleanup | COMPLETE (2026-09-21) |
| — | — | Full `@world` rebuild (O2/LTO policy) | COMPLETE (2026-09-21) |

B1 is a benchmark result, not a validation gate: the status “PASS” is not
used for O2/O3.

## Gate A0 — baseline

> **Historical baseline recorded on 2026-09-20**: this section describes the
> state at the start of the experiment, not the machine’s current inventory.

- **Date**: 2026-09-20.
- **Variable changed**: none. State was recorded and the documentation was
  checked against the live system.

### Initial configuration

Recorded by the owner while preparing the experiment (see
[agent-prompt.md](../agent-prompt/)):

```text
CC=clang CXX=clang++ AR=llvm-ar NM=llvm-nm RANLIB=llvm-ranlib
Clang 22.1.8
CFLAGS/CXXFLAGS = -march=alderlake -O3 -flto=thin -pipe
                  -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld

Portage linker = LLD (slot 22)
Bare clang default linker = GNU ld.bfd
C++ stdlib = libstdc++ (GCC 15)
rtlib = libgcc
unwindlib = libgcc / libgcc_s
LLVM 23.1.1 + LLD 23.1.1 installed in parallel
```

### Gate 0 commands

```bash
portageq envvar CC CXX AR NM RANLIB CFLAGS CXXFLAGS LDFLAGS
clang --version
/usr/lib/llvm/23/bin/clang --version
/usr/lib/llvm/23/bin/ld.lld --version
```

### Verification run (2026-09-20, read-only)

```text
/usr/lib/llvm: слоты 22, 23
clang (bare) → 22.1.8; /usr/lib/llvm/23/bin/clang → 23.1.1;
/usr/lib/llvm/23/bin/ld.lld → LLD 23.1.1

portageq: CC=clang CXX=clang++ AR=llvm-ar NM=llvm-nm RANLIB=llvm-ranlib;
CFLAGS/CXXFLAGS и LDFLAGS совпадают с baseline слово в слово.

/etc/clang/22 и /etc/clang/23 (идентичны):
gentoo-linker.cfg    → -fuse-ld=bfd
gentoo-rtlib.cfg     → --rtlib=libgcc
gentoo-stdlib.cfg    → --stdlib=libstdc++
gentoo-unwindlib.cfg → --unwindlib=libgcc

PATH: /usr/lib/llvm/22/bin стоит раньше /usr/lib/llvm/23/bin (env.d) →
bare clang/ld.lld = слот 22; Clang 23 — только по абсолютному пути.
```

Both Gate A1 pre-flight checks were also taken (`-###` executes nothing):

```bash
/usr/lib/llvm/23/bin/clang++ -### -x c++ /dev/null -fuse-ld=lld 2>&1 | tail -n1
/usr/lib/llvm/23/bin/clang++ -### -x c++ /dev/null 2>&1 | tail -n1
```

```text
С -fuse-ld=lld: линкер = /usr/lib/llvm/23/bin/ld.lld        ✓
Без флагов:     линкер = /usr/bin/x86_64-pc-linux-gnu-ld.bfd ✓
Библиотеки:     -lstdc++ -lgcc_s -lgcc; CRT из /usr/lib/gcc/x86_64-pc-linux-gnu/15 ✓
```

### PASS/FAIL

**PASS** — the baseline was recorded, is reproducible, and agrees with the
experiment documentation and system sections.

### Rollback/residual changes

None required: the system was not changed.

## Gate A1 — libde265 (one small package)

- **Date**: 2026-09-20 (after A0).
- **Variable changed**: compiler and linker 22 → 23 through LLVM 23 absolute
  paths; flags, runtimes, and package.env were unchanged.

### Pilot configuration

```text
Compiler: Clang 23 (absolute paths)
Linker:   LLD 23
CFLAGS/CXXFLAGS: -march=alderlake -O3 -flto=thin -pipe
                 -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk
C++ stdlib: libstdc++
Runtime/unwinder: libgcc + libgcc_s
```

### Recording commands (owner)

```bash
bzcat /var/db/pkg/media-libs/libde265-1.1.3/environment.bz2 | grep -aE '^(CC|CXX|AR|NM|RANLIB|CFLAGS|CXXFLAGS|LDFLAGS)='
readelf -d /usr/lib64/libde265.so.0.2.3 | grep NEEDED
size /usr/lib64/libde265.so.0.2.3
dec265 --help
```

### Results

The VDB confirmed the build environment:

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -flto=thin ...
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld
```

Runtime dependencies (`NEEDED`):

```text
libstdc++.so.6
libgcc_s.so.1
libc.so.6
libm.so.6
```

Size of `/usr/lib64/libde265.so.0.2.3`:

```text
text = 647595
data = 3328
bss  = 21011
```

Smoke test: `dec265 --help`, exit status 0.

### PASS/FAIL

**PASS**.

### What is proven

- `libde265` builds successfully with Clang 23;
- LLD is used through the current Portage policy;
- ThinLTO is retained;
- GNU `libstdc++ + libgcc/libgcc_s` are retained;
- the installed executable starts.

### What is NOT proven

- LLVM 23 is faster than LLVM 22;
- `-O3` is better than `-O2`;
- binary size is better or worse than with LLVM 22.

> **Note**: the size is not compared with `libde265-1.0.16`; it is a different
> version, so the comparison would be invalid. The full upstream test suite
> was not run.

### Rollback/residual changes

The package was installed normally; runtimes and the global policy were not
changed. No separate rollback is required.

## Gate A2 — libunistring (existing no-lto-llvm policy)

- **Date**: 2026-09-20 (after A1).
- **Variable changed**: only compiler/toolchain binaries 22 → 23. The
  package optimization policy was unchanged.

### Initial package policy

```text
dev-libs/libunistring no-lto-llvm
```

`no-lto-llvm` sets:

```text
-O3
-fno-lto
-fuse-ld=lld
```

### Recording commands (owner)

```bash
bzcat /var/db/pkg/dev-libs/libunistring-1.4.2/environment.bz2 | grep -aE '^(CC|CXX|AR|NM|RANLIB|CFLAGS|CXXFLAGS|LDFLAGS)='
readelf -d /usr/lib64/libunistring.so.5 | grep NEEDED
size /usr/lib64/libunistring.so.5
```

### Results

VDB after the build:

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang
CXX=/usr/lib/llvm/23/bin/clang++
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -fno-lto ...
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld -fno-lto
```

Runtime dependencies:

```text
libc.so.6
```

The absence of `libstdc++`/`libgcc_s` is expected: this is a pure C library.

Size of `/usr/lib64/libunistring.so.5`:

```text
text = 1980090
data = 15760
bss  = 4496
```

### PASS/FAIL

**PASS**.

### Main conclusion

> The existing package-specific `no-lto-llvm` policy is compatible with using
> Clang 23 without needing to change the optimization policy at the same time.

### Future audit item

`RUSTFLAGS` inside the `no-lto-llvm` env file contains the hardcoded
`/usr/lib/llvm/22/bin/clang`. This was deliberately not corrected at Gate A2:
Rust is not involved for `libunistring`, and changing the env file is a
separate live-system change outside the gate's scope. Check it at the next
`/etc/portage` audit.

### Rollback/residual changes

None required.
## Gate A3 — mesa_clc (LLVM as a library dependency)

- **Date**: 2026-09-20 (after A2).
- **Variable changed**: compiler/toolchain binaries 22 → 23; the LLVM_SLOT
  ebuild policy was not changed.

Package:

```text
dev-util/mesa_clc-26.2.2
```

Important case: the ebuild contains

```text
LLVM_COMPAT=(18 19 20 21 22)
```

and selected `LLVM_SLOT=22`, while the package itself was successfully compiled
with Clang 23.

### Recording commands (owner)

```bash
bzcat /var/db/pkg/dev-util/mesa_clc-26.2.2/environment.bz2 | grep -aE '^(CC|CXX|AR|NM|RANLIB|LLVM_SLOT|LLVM_COMPAT)='
readelf -d /usr/bin/mesa_clc | grep NEEDED
size /usr/bin/mesa_clc
mesa_clc --help
```

### Results

VDB:

```text
AR=/usr/lib/llvm/23/bin/llvm-ar
CC=/usr/lib/llvm/23/bin/clang-23
CXX=/usr/lib/llvm/23/bin/clang++-23
NM=/usr/lib/llvm/23/bin/llvm-nm
RANLIB=/usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -flto=thin ...
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld

LLVM_COMPAT=(18 19 20 21 22)
LLVM_SLOT=22
```

Actual dynamic dependencies:

```text
libLLVM.so.22.1
libclang-cpp.so.22.1
libLLVMSPIRVLib.so.22.1
libstdc++.so.6
libgcc_s.so.1
```

Size of `/usr/bin/mesa_clc`:

```text
text = 107159
data = 2848
bss  = 8056
```

Smoke test: `mesa_clc --help`, exit status 0.

### PASS/FAIL

**PASS**.

### Main conclusion

> For this ebuild, `LLVM_COMPAT`/`LLVM_SLOT` describe the supported LLVM
> dependency slot and are not automatically a restriction on the Clang version
> that can compile the package's C/C++ source code.

The following configuration has been demonstrated:

```text
Clang 23
   ↓ compile
mesa_clc
   ↓ runtime/link dependencies
LLVM 22 libraries
   +
libstdc++ / libgcc_s
```

This is precisely the “two axes” from
[toolchain-primer.md](../toolchain-primer/): compiler version and LLVM library
slot are independent.

> ⚠️ **Important nuance**: this has been demonstrated for this specific ebuild
> and must not be generalized automatically to all Gentoo packages.

### Rollback/residual changes

Not required.

## Gate A4 — mesa (large production package, --buildpkgonly)

- **Date**: 2026-09-20, build completed at 15:50:03 +03 (BUILD_TIME 1789908603).
- **Variable changed**: compiler/toolchain binaries 22 → 23.
- **Status**: **PASS** — final status confirmed by the owner.

### Goal

```text
large production package
Clang 23 + LLD 23
-O3
-fno-lto (existing policy)
LLVM libraries slot 22
```

Existing package policy:

```text
media-libs/mesa no-lto-llvm ssd
```

The build was run as `emerge --buildpkgonly ...` — the experiment did not
install a new Mesa on the live system.

> ⚠️ **Important nuance**: the build time of this `--buildpkgonly` run was not
> recorded reliably. Older `qlop` timings belong to previous Mesa builds and
> must not be used as the A4 timing. No value is substituted.

### Artifact

```text
/var/cache/binpkgs/media-libs/mesa/mesa-26.2.2-1.gpkg.tar
size: 24360960 bytes (~23.2 MiB)
BUILD_TIME: 1789908603 = 2026-09-20 15:50:03 +03
```

The format is gpkg (GLEP 78): an uncompressed outer tar containing
`metadata.tar.zst` and `image.tar.zst`.

### Build environment (from binpkg metadata)

```text
CC  = /usr/lib/llvm/23/bin/clang-23
CXX = /usr/lib/llvm/23/bin/clang++-23
AR  = /usr/lib/llvm/23/bin/llvm-ar
NM  = /usr/lib/llvm/23/bin/llvm-nm
RANLIB = /usr/lib/llvm/23/bin/llvm-ranlib

CFLAGS/CXXFLAGS = -march=alderlake -O3 -fno-lto -pipe
                  -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk
LDFLAGS = -Wl,-O1 -Wl,--as-needed -fuse-ld=lld -fno-lto

LLVM_COMPAT=(18 19 20 21 22)
LLVM_SLOT=22
USE (relevant): llvm llvm_slot_22 opencl vaapi video_cards_intel
                video_cards_zink vulkan zstd
```

LLVM dependencies inside the binpkg:

```text
libgallium-26.2.2.so
  NEEDED libLLVM.so.22.1

libRusticlOpenCL.so.1.0.0
  NEEDED libLLVM.so.22.1
  NEEDED libclang-cpp.so.22.1
  NEEDED libLLVMSPIRVLib.so.22.1
```

Plus `libstdc++.so.6` and `libgcc_s.so.1` — the GNU runtime is retained.

### ELF baseline sizes

| ELF | text |
|-----|------|
| libgallium-26.2.2.so | 33902507 |
| libRusticlOpenCL.so.1.0.0 | 27278236 |
| libvulkan_intel.so | 25886606 |
| libvulkan_intel_hasvk.so | 19691023 |

Total package SIZE: 124338330 bytes.

Method for inspecting the binpkg (standard tar + zstd, everything in /tmp,
without installation):

```bash
mkdir -p /tmp/mesa-a4 /tmp/mesa-a4/meta /tmp/mesa-a4/img
cp /var/cache/binpkgs/media-libs/mesa/mesa-26.2.2-1.gpkg.tar /tmp/mesa-a4/
tar xf /tmp/mesa-a4/mesa-26.2.2-1.gpkg.tar -C /tmp/mesa-a4
tar xf /tmp/mesa-a4/mesa-26.2.2-1/metadata.tar.zst --zstd -C /tmp/mesa-a4/meta
tar tvf /tmp/mesa-a4/mesa-26.2.2-1/image.tar.zst --zstd | grep -E '\.so' | sort -k3 -rn | head -12
```

Metadata is extracted into flat VDB-like files (`CC`, `CFLAGS`, `USE`,
`NEEDED.ELF.2`, `environment.bz2`). For older `.xpak` binpkgs, use
`qtbz2 -s` + `qxpak` instead.

### Live system unchanged (confirmation)

```text
installed: /var/db/pkg/media-libs/mesa-26.2.2, BUILD_TIME = 1789260539
           (2026-09-13 03:49 +03)
binpkg:    BUILD_TIME = 1789908603 (2026-09-20 15:50:03 +03)
→ the values differ; the installed Mesa was not replaced
```

**Observation at the Gate A4 checkpoint (2026-09-20)**: `/etc/portage/env/`
records 7 files
(`bfd gcc-fallback kernel-llvm no-ccache no-lto-llvm p-cores ssd`) — this
conflicts both with the old list in `boot-and-portage.md` (11 names, state as
of 2026-09-12) and with CHECKPOINT (8 files, audit 2026-09-14). There are no
temporary `llvm-23-pilot` remnants. Investigate at the next
`/etc/portage` synchronization.

### What has been proven

- Mesa 26.2.2 builds with Clang 23 + LLD 23 under the existing
  `no-lto-llvm + ssd` policy;
- `-O3 -fno-lto` and `-fuse-ld=lld` are confirmed from binpkg metadata;
- LLVM library slot 22 is confirmed (`LLVM_SLOT=22`, `USE llvm_slot_22`,
  `libLLVM.so.22.1`);
- the installed Mesa was not replaced.

### What has NOT been proven

- Runtime behavior of the built Mesa: the binpkg was not installed or run;
- build time and performance relative to LLVM 22 (there are no measurements).

### Rollback/residual changes

Rollback is trivial: remove the binpkg with one owner command. The live system
and `/etc/portage` were not changed.
## Experiment A outcome — COMPLETE

Experiment A question:

> Can Clang/LLD 23 be used on the baseline system of the experimental period
> without simultaneously changing libc++, compiler-rt, libunwind, and the rest
> of the runtime architecture?

Answer from tests of this baseline:

```text
YES — for the tested package classes.
```

| Gate | Package | Class | LTO | LLVM dependency | Result |
|------|---------|-------|-----|-----------------|--------|
| A1 | libde265-1.1.3 | C++ codec | ThinLTO | n/a | PASS |
| A2 | libunistring-1.4.2 | C library | disabled | n/a | PASS |
| A3 | mesa_clc-26.2.2 | C/C++ LLVM-dependent | ThinLTO | LLVM 22 | PASS |
| A4 | mesa-26.2.2 | large graphics stack | disabled | LLVM 22 | PASS |

Conclusion:

> Experiment A showed that Clang/LLD 23 builds several substantially different
> package classes on this machine while preserving the baseline GNU C++ runtime
> architecture and, where applicable, dependencies on LLVM 22.

Scope limits:

> Experiment A is a compatibility result, not a performance comparison of LLVM
> 22 and LLVM 23.

The result does not prove that the entire `@world` is compatible with LLVM 23,
and it does not prove the absence of package-specific exceptions. Statements
“LLVM 23 is faster,” “LLVM 23 is better,” and “LLVM 23 is ready for the entire
@world” are unsupported and are not used in the documentation.

## Experiment B — COMPLETE

Objective:

> Should the system's global optimization baseline remain `-O3`, or is it more
> reasonable to use global `-O2` and enable package-specific `-O3` only where
> it provides a measurable benefit?

Working hypothesis (not an adopted decision):

```text
-O2 global + ThinLTO
-O3 package-specific where benchmark proves a meaningful benefit
```

Main principle: exactly the optimization level changes in each A/B; compiler,
linker, CPU target, LTO mode, runtimes, package version, and workload are the
same.

### B1 — libde265 controlled A/B: COMPLETE

The only intended difference: `-O2` ↔ `-O3` with Clang 23 + LLD 23 +
`-march=alderlake` + ThinLTO + GNU runtime. Builds use `--buildpkgonly` in
separate PKGDIRs. Key figures (methodology and complete data are in
[o2-o3-benchmarks.md](../o2-o3-benchmarks/)):

```text
O3 runtime ≈ 1.2% faster (task-clock -1.19%, 4+4 runs, P-core)
O3 instructions ≈ 1.8% fewer
O3 libde265 .text ≈ 12.3% larger
```

Interpretation: B1 strengthens the `global -O2 + selective -O3` hypothesis,
but one codec workload is insufficient to change global optimization policy.
At the B1 checkpoint, `make.conf`, `package.env`, and production policy had
not changed; no package-specific `-O3` rule was created for libde265.

### B2 — zstd controlled A/B: COMPLETE

`app-arch/zstd-1.5.7-r1`, compression/decompression, C. The same scheme: only
`-O2` ↔ `-O3` changes with Clang 23 + LLD 23 + `-march=alderlake` + ThinLTO +
GNU runtime; builds use `--buildpkgonly` in separate PKGDIRs; corpus is kernel
sources (include/kernel/mm/fs, ~53 MB tar → ~11 MB `.zst`); libraries are
isolated with `LD_LIBRARY_PATH` (the O2 version uses O2 `libzstd`, O3 uses O3
`libzstd`). Key figures (complete data is in
[o2-o3-benchmarks.md](../o2-o3-benchmarks/)):

```text
O3 libzstd .text ≈ 9.2% larger
O3 compression   ≈ 1–2% faster
O3 decompression ≈ 1–2% slower
```

Interpretation: a mixed result — `-O3` notably increased the main library's
code footprint, improving one hot path and worsening another. Therefore, even
package-specific `-O3` is not selected automatically because a package is
“performance-sensitive”; evaluate the optimization level from the real
workload mix and measured trade-off. At the B2 checkpoint, production policy
had not changed.

### B3 — OpenSSL controlled A/B: COMPLETE

`dev-libs/openssl-3.5.8`, cryptography, C / assembly-heavy. A special case:
the Gentoo ebuild applies `filter-lto` itself (upstream OpenSSL does not regard
LTO as a regularly tested configuration), so both branches are built without
ThinLTO — B3 tests O2/O3 in another real production configuration.
Provenance was confirmed from the binpkg: Clang 23 + LLD 23, `-O2`/`-O3` are
the only difference, and `-flto=thin` is absent from both branches. Isolation
uses `LD_LIBRARY_PATH` (each branch has its own `libssl.so.3`/`libcrypto.so.3`).

Benchmark: `openssl speed` (AES-256-CTR, SHA-256, ChaCha20; 16 KiB buffer,
10 c window; `taskset -c 2`; 4+4 symmetric samples per algorithm; warm-up;
`OPENSSL_CONF=/dev/null`). Time-based semantics: raw perf totals are
normalized per byte (methodology is in
[benchmark-methodology.md](../benchmark-methodology/)). Key figures (complete
data is in [o2-o3-benchmarks.md](../o2-o3-benchmarks/)):

```text
AES-256-CTR:  no O3 benefit (≈ -0.17%, statistical tie)
SHA-256:      O3 ≈ -0.5%
ChaCha20:     O3 ≈ -1%
libcrypto .text ≈ +2.62%, libssl .text ≈ +4.24%, CLI .text ≈ +1.37%
```

Interpretation: in the tested crypto workloads, `-O3` provided no measurable
benefit over `-O2` while continuing to increase code size. Scope is limited
(three algorithms, 16 KiB, one P-core, single-process, OpenSSL 3.5.8) — the
result does not generalize to RSA, ECDSA, TLS handshakes, smaller buffers, or
multi-threaded workloads.

The combined B1+B2+B3 picture: codec, compression/decompression, crypto;
ThinLTO and no-LTO; C and C++. The pattern: `-O3` consistently increased code
footprint (libde265 +12.3%, libzstd +9.2%, libcrypto +2.6%), while runtime
benefits were small, workload-dependent, absent, or negative. This strengthens
the `global -O2 + selective -O3` hypothesis, but the system-wide decision
remains open.

### Final B1–B3 review — COMPLETE

- **Date**: 2026-09-20.
- **Scope**: cross-checking statuses and figures among all experiment records
  and CHECKPOINT; consolidating B1–B3 evidence; assessing readiness for the
  optimization-policy decision. No new measurements (B4) were performed.

Consistency. Key B1–B3 figures match in all documents (README,
optimization-o2-o3, o2-o3-benchmarks, results, CHECKPOINT); A1–A4 and B1–B3
statuses are consistent. Two stale statuses were corrected: README “Objectives”
item 3 retained “(B1 COMPLETE)” when B1–B3 had completed; § 5 of
optimization-o2-o3.md stated “B2–B4 packages are not selected yet” when B2/B3
had completed. Both edits concern status — figures did not change.

Consolidated evidence (summary table — § 8 of
[o2-o3-benchmarks.md](../o2-o3-benchmarks/)):

- **Code size — the most consistent result**: `-O3` increased `.text` in every
  measured ELF — libraries +2.6…+12.3%, CLI +1.4…+11.2%. Direct measurements
  of finished binaries; independent of benchmark noise.
- **Runtime — every O2/O3 effect is within ≈ ±2%**: in 4 of 6 comparisons O2
  is faster or tied (B2-D, AES, SHA, ChaCha20); the best O3 results are ≈ 1.2%
  (B1) and ≈ 1–2% (B2 compression, with CV O3 up to 4%). No workload has a
  decisive O3 advantage; the magnitudes are comparable with sample variation
  (CV 0.4–4%).
- **Build time** — single-run auxiliary observations; excluded from the
  decision (Rule 14 of the methodology).
- **Frequency sanity** — passed in every gate; effects are not explained by
  different average frequency.
- **Coverage** — C and C++; ThinLTO and no-LTO; fixed-work and fixed-time;
  codec, compression/decompression, crypto; small utilities and large
  production libraries.

Match to the decision criterion (§ 7 of
[optimization-o2-o3.md](../optimization-o2-o3/)): the candidate conditions for
`global -O2 + selective -O3` are supported — O2 does not materially lose at
runtime (deficits ≈ 1.2% in B1 and ≈ 1–2% in B2 compression, both within ~2%)
and consistently wins on code size. There are no candidates for targeted
`-O3` yet: the best O3 benefit is ≈ 1.2% on one workload path (B1), B2 is
mixed within a package, B3 has no benefit — selective rules are not created.

Not covered: a large desktop/graphics workload (optional B4); build-time cost
(repeated controlled builds); multi-thread, other algorithms/buffers, E-core —
outside scope (§ 6.13 o2-o3-benchmarks.md). A sample of 4+4 is reliable for
effects ≈ 2% and greater; smaller effects remain at the noise boundary.

> B1–B3 evidence is internally consistent and sufficient for an
> optimization-policy decision without new measurements. Two paths are valid:
> (1) adopt `global -O2 + selective -O3`, for now without a single selective
> rule, or (2) first conduct optional B4 — a large desktop/graphics workload as
> the final workload class. The owner decides.

The canonical methodology for future measurements (including B4) is recorded
in [benchmark-methodology.md](../benchmark-methodology/).
### B4 — Mesa controlled A/B: COMPLETE

- **Date**: 2026-09-20 (after the final B1–B3 review).
- **Variable changed**: only `-O2` ↔ `-O3`. B4 is the final benchmark in
  Experiment B; B5 and additional checks are not planned.

`media-libs/mesa-26.2.2` is a large desktop/graphics codebase that completes
Experiment B coverage with a large production package. Both builds used
`--buildpkgonly` in separate PKGDIRs: Clang 23 + LLD 23, `-march=alderlake`,
`-fno-lto` under the package policy (the same in both variants), LLVM dependency
slot 22, and the GNU runtime retained. The normalized O2/O3 metadata diff is
empty: the optimization level is the only intended difference. The production
system was not switched to O2/O3 during the benchmark; Mesa from the binpkg was
not installed.

Workload: Mesa shader-db on a fixed shader corpus; real Intel Alder Lake-P GT2
/ Iris Xe [8086:46a6], real iris userspace driver; CPU 2 (P-core), `-j1`;
shader cache disabled; separate O2/O3 Mesa trees through
`LIBGL_DRIVERS_PATH`/`LD_LIBRARY_PATH`; warm-up; order `O2, O3, O3, O2, O3,
O2, O2, O3` — 4 measured samples per variant; analysis by `cpu_core/*`.

Key figures (methodology and full data — § 7
[o2-o3-benchmarks.md](../o2-o3-benchmarks/)):

```text
runtime:                      no measurable O3 advantage
                              (task-clock mean ≈ -0.30% with CV O2 ≈ 4%;
                              mean and median have opposite signs)
instructions/cycles/branches: ~2–3% lower with O3, but did not translate
                              into a proven runtime benefit
libgallium-26.2.2.so .text:   +5.23%
libvulkan_intel.so .text:     +4.79%
libvulkan_intel_hasvk:        +4.92%
iris_dri.so .text:            ~+0.05%
binpkg:                       +5.31% (23132160 → 24360960 bytes)
```

Build observations (auxiliary, one run per variant): O2 wall 9:03.04, O3 wall
8:46.35; user/system time and Max RSS are almost identical. No conclusion that
“O3 compiles faster” is made.

One O2 task-clock sample (116.552 s, while the others were ~106 s) is notably
noisier; it was not removed after the fact, and the high O2 variation is
accounted for in the interpretation.

Interpretation: B4 found no measurable runtime advantage of `-O3` over
`-O2`; on a large production graphics codebase, `-O3` again noticeably
increases code footprint. The claims “O3 is 0.3% faster”, “O2 is 2.25%
faster”, and causal explanations based on CPU-frequency differences are not
used.

### Optimization policy decision — COMPLETE

- **Date**: 2026-09-20, based on B1–B4.
- **Type**: documented policy decision. Applied to `/etc/portage` on
  2026-09-20 (`make.conf`, `env/gcc-fallback`, `env/no-lto-llvm`;
  `env/kernel-llvm` was already `-O2`); the resolver is calculated. The full
  `@world` rebuild under `-O2` completed on 2026-09-21 (see below); the LLVM 23 rollout is NOT STARTED.

Adopted:

```text
global baseline:  -O2
ThinLTO:          remains global where package/ebuild policy
                  permits it
-O3:              package-specific only after a separate benchmark
                  demonstrates a notable, reproducible practical
                  benefit
selective rules:  none are created for any package based on B1–B4
```

The basis is the combined B1–B4 result (§ 8
[o2-o3-benchmarks.md](../o2-o3-benchmarks/)): `-O3` increased code footprint
in every tested class, while the runtime benefit was small, workload-specific,
absent, or negative. Reasons not to create selective rules:

- libde265: ~1.2% runtime benefit for ~12.3% `.text` — weak/questionable;
- zstd: mixed result within one package;
- OpenSSL: no advantage;
- Mesa: no advantage.

A future candidate for a targeted `-O3` must be supported by its own benchmark
under the canonical methodology
([benchmark-methodology.md](../benchmark-methodology/)); the label
“performance-sensitive” alone is insufficient (B2 conclusion).

### Portage no-LTO exception cleanup — COMPLETE

- **Date**: 2026-09-21.
- **Baseline**: 102 local `no-lto-llvm` assignments in `package.env`, a remnant
  of the historical compatibility layer (the snapshot at the start of the
  experiment is in [README.md](../)).
- **Method**: rules were removed in controlled batches; each batch was checked
  with `emerge --buildpkgonly -1`.
- **Result**: all 102 overrides were removed; `env/no-lto-llvm`,
  `env/no-ccache` (after its last consumer disappeared), and
  `package.env/20-compatibility` were removed; `media-libs/mesa` has only `ssd`
  in `10-performance`. The resulting structure at the cleanup checkpoint on
  2026-09-21: `env/` — `gcc-fallback`, `kernel-llvm`, `p-cores`, `ssd`;
  `package.env/` — `00-toolchain`, `10-performance`, `30-gcc-fallback`.

Proven: the local `no-lto-llvm` compatibility blacklist is no longer needed:
all 102 overrides turned out to be unnecessary (for some packages the ebuild
manages LTO itself through `filter-lto`; some Go/Rust packages do not use these
C/C++ flags directly).

NOT proven (at the time of cleanup): the runtime state of the fully rebuilt
`@world`; closed by the full rebuild on 2026-09-21 — see below.

### Full `@world` rebuild — COMPLETE

- **Date**: 2026-09-21.
- **Scope**: a full rebuild of the installed `@world` after applying the
  optimization/LTO policy (`-O2` + ThinLTO; the prior step removed local no-LTO
  overrides).

Result: the rebuild completed successfully; the system booted normally, core
services work, and no new functional problems were found. Post-rebuild
analysis found no regressions related to `-O2` + ThinLTO in the logs.

> The wording is deliberately careful: it does not mean that every installed
> file was built with ThinLTO. Ebuilds may filter LTO (`filter-lto`) or not use
> the C/C++ toolchain at all.

Problems found during post-rebuild diagnostics were local configuration errors
unrelated to the optimization policy (iwd `ProtectKernelTunables`, a duplicate
polkit agent, and a transient NM/iwd race). They are recorded in the system
documentation:
[networking](../../../systems/asus-b5402/networking/networkmanager-and-libvirt/),
[desktop](../../../systems/asus-b5402/desktop/environment/).

### Decision gate: env/llvm-23 — after the optimization policy decision

The Experiment B block is removed: the study is complete, the optimization
policy was selected, applied, and checked by a full rebuild. The next
unfinished controlled step at this checkpoint is the limited `env/llvm-23`
pilot. Permanent assignment of LLVM 23 through `package.env` remains a
separate owner decision:

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
applying -O2 to /etc/portage — COMPLETE (2026-09-20)
          ↓
full O2 rebuild + validation — COMPLETE (2026-09-21)
          ↓
limited env/llvm-23 pilot —
NOT STARTED
```

The order is retained: the optimization policy is applied first, then the
controlled LLVM 23 rollout begins, not simultaneously. Experiment C
(`compiler-rt + libunwind`) is NOT STARTED.

## Related records

- [README.md](../) — experiment overview and status;
- [toolchain-primer.md](../toolchain-primer/) — conceptual model;
- [optimization-o2-o3.md](../optimization-o2-o3/) — decision record;
- [benchmark-methodology.md](../benchmark-methodology/) — canonical methodology;
- [o2-o3-benchmarks.md](../o2-o3-benchmarks/) — raw/derived benchmark record;
- [`../../systems/asus-b5402/system/boot-and-portage.md`](../../../systems/asus-b5402/system/boot-and-portage/) — current system source of truth.
