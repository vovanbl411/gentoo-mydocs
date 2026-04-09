# Оптимизация CPU: Intel Alder Lake (i7-1260P)

Процессоры Alder Lake используют гибридную архитектуру (P-cores и E-cores). Для их эффективной работы требуется современное ядро (6.6+) и специфичные флаги сборки.

## 1. Флаги компиляции и инструкции

В make.conf мы используем `-march=alderlake`. Это включает поддержку специфичных инструкций, за исключением тех, что могут быть аппаратно заблокированы (например, AVX-512).

Набор инструкций (CPU_FLAGS_X86):

```makefile
# Оптимальный набор для i7-1260P
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"
```

## 2. Binary Optimization (BOLT)

Для критически важных компонентов (LLVM, Clang) мы применяем BOLT (Binary Optimization and Layout Tool). Это переупорядочивает код внутри бинарных файлов на основе профилей производительности, что дает прирост скорости до 10-15% на архитектуре Alder Lake.

## 3. Планировщик и Intel Thread Director

Для корректного распределения задач между P и E ядрами:

- Убедитесь, что в ядре включен `CONFIG_INTEL_ITD=y`.
- Используется драйвер `intel_pstate` в режиме active.
