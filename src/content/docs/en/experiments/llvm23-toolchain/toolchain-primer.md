---
title: "How the compiler toolchain works in Gentoo"
kind: reference
scope: general
status: current
last_verified: null
verified_on: []
sidebar:
  order: 2
---

Choosing Clang instead of GCC does not by itself change the C++ standard library
or runtime. A toolchain has several layers: they can be selected separately
where the platform and packages support the combination.

## Five layers

```text
compiler   → GCC / Clang
linker     → GNU ld.bfd / LLD
C++ stdlib → libstdc++ / libc++
rtlib      → libgcc / compiler-rt
unwinder   → libgcc_s / libunwind
```

| Layer | Purpose |
|-------|---------|
| Compiler | Translates C/C++ into object files; the compiler driver can also invoke the linker |
| Linker | Combines `.o`/`.a` into ELF, resolves symbols; during LTO it coordinates processing of the intermediate representation |
| C++ stdlib | Implements `std::`: containers, strings, iostream |
| rtlib | Provides compiler support functions, such as integer builtins (`__udivti3`); compiler-rt also contains sanitizer runtimes |
| unwinder | Unwinds the stack, including for C++ exceptions |

These are different tasks. Optimization (`-O2`, `-O3`, ThinLTO) is another
setting that does not determine the standard library or unwinder.

## Clang with libstdc++ and libgcc

On GNU/Linux, Clang can compile C++ with `libstdc++` and use the GNU
`libgcc/libgcc_s` runtime. For a compatible platform, Clang and GCC support a
shared C++ ABI; changing the compiler does not automatically require changing
libraries.

The choices are separate:

- `--stdlib=libstdc++` or `--stdlib=libc++` — C++ standard library;
- `--rtlib=libgcc` or `--rtlib=compiler-rt` — compiler runtime;
- `--unwindlib=libgcc` or `--unwindlib=libunwind` — unwinder.

Builtins and unwinding have different roles even when the GNU stack provides
them together. Choosing `compiler-rt` alone does not imply choosing `libunwind`.

### “Build world with Clang” does not mean “switch to libc++”

A Clang build can retain `libstdc++`. `libc++` is another implementation of
`std::` with a different ABI: for example, the internal representation of
`std::string` need not match. Symbol differences (including libc++'s
`std::__1` namespace) help expose some incompatibilities, but do not guarantee
that the linker will detect every problem at library boundaries.

Moving to `libc++` is therefore a separate ABI decision: C++ dependencies,
object exchange across boundaries, and prebuilt binary compatibility need
checking; affected components may need rebuilding.

## The linker in Portage and in bare Clang

The Clang driver selects a linker using `-fuse-ld=...` and its defaults.
A Portage build and a manual `clang++ test.cpp` invocation can receive
different settings:

- In Portage, `LDFLAGS` from `/etc/portage/make.conf` may contain
  `-fuse-ld=lld`. If the build system uses these flags, the linker will be LLD.
- Bare Clang without explicit flags uses its defaults. In Gentoo,
  `/etc/clang/<slot>/gentoo-linker.cfg` can set them, for example `-fuse-ld=bfd`.

Portage-selected LLD does not prove that bare Clang also selects LLD.
`PATH` order also determines which driver version runs. Checking a build
therefore requires its actual environment and compiler/linker provenance,
not just the name `clang` in a configuration file.

## Installed runtimes and defaults

Having `compiler-rt` or `libc++` installed does not mean every package uses
them. Installing a component and selecting it at link time are separate actions.

A historical Gentoo packaging example, checked in the VDB on 2026-09-20:

| USE | Package | Purpose |
|-----|---------|---------|
| `default-lld` | `llvm-core/clang-linker-config` | Clang default linker → LLD |
| `default-compiler-rt` | `llvm-runtimes/clang-rtlib-config` | Clang default rtlib → compiler-rt |
| `default-libcxx` | `llvm-runtimes/clang-stdlib-config` | Clang default C++ stdlib → libc++ |
| `llvm-libunwind` | `llvm-runtimes/clang-unwindlib-config` | Default unwinder → llvm-libunwind |

In that LLVM stack, `compiler-rt` and `libcxx` flags controlled building the
runtimes themselves. `default-*` set driver defaults; explicit flags for a
particular build could override them. Portage builds can also inherit defaults
when the corresponding flags are not explicitly set. This table is a dated
example, not an inventory of packages installed today.

## Compiler version and LLVM library dependency

A package may use LLVM as a library or tool dependency. The ebuild selects that
dependency's slot, including through `LLVM_COMPAT`/`LLVM_SLOT`. This is a
separate axis from the version of Clang compiling the sources. Check what the
variable controls in the specific ebuild/eclass.

An example from the [LLVM 23 experiment](../), Gate A3 on 2026-09-20:
`dev-util/mesa_clc-26.2.2` was built with Clang 23, but
`LLVM_COMPAT=(18 19 20 21 22)` selected `LLVM_SLOT=22`. The executable used
`libLLVM.so.22.1` and `libclang-cpp.so.22.1` alongside the GNU runtime.
The new compiler and older LLVM libraries were compatible for this ebuild;
this does not prove compatibility for every Gentoo package.

## Historical illustration: ASUS B5402

Gate A0 on 2026-09-20 recorded a mixed stack:

| Layer | Experiment baseline |
|-------|---------------------|
| Primary compiler | Clang 22.1.8, slot 22 ahead of 23 in `PATH` |
| Parallel compiler | Clang 23.1.1, pilot through absolute `/usr/lib/llvm/23/bin/...` paths |
| Portage linker | LLD 22 through `-fuse-ld=lld` |
| Bare Clang linker | GNU ld.bfd |
| C++ stdlib | GCC 15 libstdc++ |
| rtlib / unwinder | libgcc / libgcc_s |

The `/etc/clang/22/` and `/etc/clang/23/` configurations set identical defaults:
`bfd`, `libstdc++`, `libgcc`, `libgcc`. The pilot could therefore replace the
compiler/linker while retaining the GNU runtime stack.

This illustrates the separation of layers, not the machine's current state.
Current decisions are in the [system documentation](../../../systems/asus-b5402/system/boot-and-portage/);
results and a link to the full archived record are in
[LLVM 23: experiment and conclusions](../).
