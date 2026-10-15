---
title: "Как устроен compiler toolchain в Gentoo"
kind: reference
scope: general
status: current
last_verified: null
verified_on: []
sidebar:
  order: 2
---

Выбор Clang вместо GCC сам по себе не меняет C++ standard library и runtime.
Toolchain состоит из нескольких слоёв: их можно выбирать отдельно, если
конкретная комбинация поддерживается платформой и пакетами.

## Пять слоёв

```text
compiler   → GCC / Clang
linker     → GNU ld.bfd / LLD
C++ stdlib → libstdc++ / libc++
rtlib      → libgcc / compiler-rt
unwinder   → libgcc_s / libunwind
```

| Слой | Что делает |
|------|------------|
| Compiler | Переводит C/C++ в объектные файлы; compiler driver также может вызвать linker |
| Linker | Объединяет `.o`/`.a` в ELF, разрешает символы; при LTO координирует обработку промежуточного представления |
| C++ stdlib | Реализует `std::`: контейнеры, строки, iostream |
| rtlib | Предоставляет вспомогательные функции компилятора, например integer builtins (`__udivti3`); compiler-rt также содержит sanitizer runtimes |
| unwinder | Раскручивает стек, в том числе для исключений C++ |

Это разные задачи. Оптимизация (`-O2`, `-O3`, ThinLTO) — ещё одна настройка,
которая не определяет выбор stdlib или unwinder.

## Clang с libstdc++ и libgcc

На GNU/Linux Clang может компилировать C++ с `libstdc++` и использовать GNU
runtime `libgcc/libgcc_s`. Для совместимой платформы Clang и GCC поддерживают
общий C++ ABI; смена compiler не требует автоматически менять библиотеки.

Выбор разделён:

- `--stdlib=libstdc++` или `--stdlib=libc++` — C++ standard library;
- `--rtlib=libgcc` или `--rtlib=compiler-rt` — compiler runtime;
- `--unwindlib=libgcc` или `--unwindlib=libunwind` — unwinder.

Builtins и unwinding — разные роли, даже если GNU stack предоставляет их
вместе. Выбор `compiler-rt` сам по себе не означает выбор `libunwind`.

### «Собрать world Clang'ом» не означает «перейти на libc++»

Сборка Clang'ом может сохранять `libstdc++`. `libc++` — другая реализация
`std::` с другим ABI: например, внутреннее представление `std::string`
не обязано совпадать. Различия символов (в том числе namespace `std::__1`
у libc++) помогают увидеть часть несовместимостей, но не гарантируют,
что linker обнаружит любую проблему на границе библиотек.

Поэтому переход на `libc++` — отдельное ABI-решение: нужно проверить C++
зависимости, границы обмена объектами и совместимость готовых бинарников;
затронутые компоненты могут требовать пересборки.

## Linker в Portage и linker bare Clang

Clang driver выбирает linker с учётом `-fuse-ld=...` и своих defaults.
Сборка через Portage и ручной вызов `clang++ test.cpp` могут получить разные
настройки:

- В Portage `LDFLAGS` из `/etc/portage/make.conf` может содержать
  `-fuse-ld=lld`. Если build system использует эти flags, linker будет LLD.
- Bare Clang без явных flags использует свои defaults. В Gentoo их может
  задавать `/etc/clang/<slot>/gentoo-linker.cfg`, например `-fuse-ld=bfd`.

Portage-selected LLD не доказывает, что bare Clang тоже выбирает LLD.
Порядок `PATH` дополнительно определяет, какая версия driver запускается.
Поэтому при проверке сборки важны фактическое окружение и compiler/linker
provenance, а не только имя `clang` в конфиге.

## Установленные runtimes и defaults

Наличие `compiler-rt` или `libc++` в системе не означает, что каждый пакет
их использует. Установка компонента и выбор его при линковке — разные действия.

Исторический пример Gentoo packaging, проверенный в VDB 2026-09-20:

| USE | Пакет | Назначение |
|-----|-------|------------|
| `default-lld` | `llvm-core/clang-linker-config` | Default linker Clang → LLD |
| `default-compiler-rt` | `llvm-runtimes/clang-rtlib-config` | Default rtlib Clang → compiler-rt |
| `default-libcxx` | `llvm-runtimes/clang-stdlib-config` | Default C++ stdlib Clang → libc++ |
| `llvm-libunwind` | `llvm-runtimes/clang-unwindlib-config` | Default unwinder → llvm-libunwind |

В том LLVM stack флаги `compiler-rt` и `libcxx` управляли сборкой самих
runtimes. `default-*` задавали defaults driver; явные flags конкретной
сборки могли их переопределить. Portage-сборка тоже может наследовать defaults,
если соответствующие flags не заданы явно. Таблица — датированный пример,
а не inventory установленных сегодня пакетов.

## Compiler version и LLVM library dependency

Пакет может использовать LLVM как библиотеку или tool dependency. Слот такой
зависимости выбирает ebuild, в частности через `LLVM_COMPAT`/`LLVM_SLOT`.
Это другая ось относительно версии Clang, которая компилирует исходники.
Нужно смотреть, что именно регулирует переменная в конкретном ebuild/eclass.

Пример из [эксперимента LLVM 23](../), Gate A3 от 2026-09-20:
`dev-util/mesa_clc-26.2.2` собран Clang 23, но
`LLVM_COMPAT=(18 19 20 21 22)` выбрал `LLVM_SLOT=22`. Исполняемый файл
использовал `libLLVM.so.22.1` и `libclang-cpp.so.22.1` вместе с GNU runtime.
Новый compiler и старые LLVM-библиотеки оказались совместимы для этого ebuild;
это не доказательство для всех пакетов Gentoo.

## Историческая иллюстрация: ASUS B5402

Gate A0 от 2026-09-20 зафиксировал смешанный stack:

| Слой | Baseline эксперимента |
|------|----------------------|
| Основной compiler | Clang 22.1.8, слот 22 раньше 23 в `PATH` |
| Параллельный compiler | Clang 23.1.1, пилот через абсолютные `/usr/lib/llvm/23/bin/...` paths |
| Linker Portage | LLD 22 через `-fuse-ld=lld` |
| Linker bare Clang | GNU ld.bfd |
| C++ stdlib | GCC 15 libstdc++ |
| rtlib / unwinder | libgcc / libgcc_s |

Конфиги `/etc/clang/22/` и `/etc/clang/23/` задавали одинаковые defaults:
`bfd`, `libstdc++`, `libgcc`, `libgcc`. Поэтому в пилоте удалось заменить
compiler/linker, сохранив GNU runtime stack.

Это иллюстрация разделения слоёв, а не текущее состояние машины.
Актуальные решения — в [системной документации](../../../systems/asus-b5402/system/boot-and-portage/),
результаты и ссылка на полный архивный record — в
[«LLVM 23: эксперимент и выводы»](../).
