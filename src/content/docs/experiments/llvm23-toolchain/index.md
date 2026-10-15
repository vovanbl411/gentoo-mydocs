---
title: "LLVM 23: эксперимент и выводы"
kind: reference
scope: system
status: current
last_verified: null
verified_on: [asus-b5402]
sidebar:
  order: 1
---

**Experiment A — LLVM 23 compatibility: COMPLETE. A1–A4: PASS.**
Проверяли, можно ли заменить Clang/LLD 22 на 23, сохранив GNU runtime stack:
`libstdc++ + libgcc/libgcc_s`. На выбранных пакетах такая сборка работала;
для Mesa проверена сборка binpkg, без установки и runtime-теста.

Эксперимент не доказал:

- преимущество LLVM 23 по производительности перед LLVM 22;
- совместимость всего `@world` и отсутствие package-specific исключений;
- необходимость глобального userspace rollout LLVM 23.

По [актуальной системной документации](../../systems/asus-b5402/system/boot-and-portage/#toolchain)
и [CHECKPOINT](https://github.com/vovanbl411/gentoo-mydocs/blob/main/CHECKPOINT.md)
(записи на 2026-10-10), основной production userspace toolchain —
**LLVM/Clang/LLD 22**, глобально **`-O2` + ThinLTO**, GNU runtime ABI.
LLVM 23.1.1 намеренно используется для ядра через `env/kernel-llvm`;
перевод остальных пакетов на LLVM 23 не начат. Успех A1–A4 не означает
принятия LLVM 23 как глобального userspace toolchain.

Из исследования optimization policy (Experiment B) в production принято
глобальное `-O2`; selective `-O3` допускается только при benchmark evidence.
Это отдельное решение, а не результат сравнения версий LLVM.

## Что меняли и почему разделили проверки

Experiment A от 2026-09-20 менял compiler/linker: Clang 22.1.8 → 23.1.1 и
LLD 22 → 23.1.1. GNU C++ stdlib, compiler runtime и unwinder сохранялись.
Исторический baseline использовал `-O3`; ThinLTO либо отключение LTO
сохранялись по исходной политике каждого пакета. Это не текущая global policy.

```text
compiler/linker
≠ optimization policy
≠ C++ stdlib
≠ compiler runtime
≠ unwinder
```

Смена `-O2`/`-O3`, переход на `compiler-rt + libunwind` и выбор `libc++`
разделены, чтобы результат можно было связать с конкретной переменной.
Объяснение слоёв и настроек Gentoo — в
[«Как устроен compiler toolchain в Gentoo»](toolchain-primer/).

## Experiment A: совместимость LLVM 23

Все четыре проверки выполнены 2026-09-20 на ASUS B5402.

| Gate / пакет | Зачем выбран | Что проверял | Результат |
|-------------|--------------|--------------|-----------|
| A1 — `media-libs/libde265-1.1.3` | Небольшой обычный C++ codec | Clang/LLD 23 + ThinLTO, сохранение GNU runtime | **PASS**; `dec265 --help` — exit 0 |
| A2 — `dev-libs/libunistring-1.4.2` | C library с исходной `no-lto-llvm` policy | Новый compiler/linker при сохранении `-fno-lto` | **PASS**; сборка и VDB/ELF проверены |
| A3 — `dev-util/mesa_clc-26.2.2` | Пакет с LLVM library dependency | Clang 23 + ThinLTO при `LLVM_SLOT=22` | **PASS**; `mesa_clc --help` — exit 0 |
| A4 — `media-libs/mesa-26.2.2` | Крупный graphics stack | Clang/LLD 23, исходная no-LTO policy, LLVM libraries 22 | **PASS**; только `--buildpkgonly`, установленная Mesa не заменена |

В A3 версия компилятора и слот LLVM-библиотек различались:
`mesa_clc` собран Clang 23, но использовал `libLLVM.so.22.1` и
`libclang-cpp.so.22.1`. `LLVM_COMPAT`/`LLVM_SLOT` здесь регулируют dependency
slot, а не автоматически допустимую версию Clang. Вывод относится к проверенному
ebuild и не переносится без проверки на все пакеты Gentoo.

Размеры ELF и binpkg зафиксированы как evidence, но не дают сравнения LLVM
22 vs 23. Время сборки A4 достоверно не записано; runtime-поведение этого
Mesa binpkg не проверялось.

## Experiment B: отдельный вопрос оптимизации

Сравнение `-O2` и `-O3` выделено в
[самостоятельный controlled experiment](../compiler-optimization/o2-vs-o3/).
Clang/LLD 23 в нём были фиксированным baseline, а не переменной сравнения.

Результат: global `-O2` с ThinLTO там, где это допускает package/ebuild policy;
selective `-O3` — только после package-specific benchmark. По результатам B
selective rules не создавались. Политика применена 2026-09-20, полный rebuild
`@world` завершён 2026-09-21 с проверкой загрузки и основных сервисов.
Методика, измерения и ограничения остаются в отдельном отчёте.

## Experiment C: граница runtime-эксперимента

Исторический статус `compiler-rt + libunwind` — **NOT STARTED**; системная
документация сохраняет GNU runtime ABI. Это отдельный эксперимент, который
не входит в результат A. Наличие установленных LLVM runtimes не означает
их использования по умолчанию.

`libstdc++ → libc++` — ещё одно самостоятельное ABI-решение с повышенным риском;
оно не входило в A и не включено в C.

## Полный record

[Экспериментальный журнал и raw evidence](https://github.com/vovanbl411/gentoo-mydocs/blob/main/archive/llvm23-toolchain/results.md)
сохранены в repository archive: baseline, команды, VDB environment,
compiler/linker provenance, `NEEDED`, размеры, smoke tests, ограничения и
rollback. Исторические инструкции и next steps в архиве не являются текущей
процедурой.
