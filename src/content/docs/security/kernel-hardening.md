---
title: Защита ядра Linux
kind: guide
scope: general
status: draft
last_verified: null
verified_on: []
---

Документ рассматривает несколько уровней kernel hardening: защитные свойства
сборки ядра, runtime-параметры sysctl, ограничение модулей и инструменты
проверки. Приведённые значения образуют пример политики hardening, а не
универсально безопасную конфигурацию для любой системы.

Некоторые ограничения могут нарушить работу существующих workloads. Перед
применением их нужно сопоставить с конкретным окружением и проверить его после
изменения.

## 1. Область применения и риски

Hardening-параметры sysctl могут влиять на:

- networking;
- debugging и perf;
- BPF workloads;
- kexec;
- crash dumps;
- panic/recovery behaviour.

Сохрани предыдущую policy и заранее определи, какие workloads нужно проверить
после изменения.

## 2. Kernel build hardening

### Hardened gentoo-sources

Ядро собирается с дополнительными мерами защиты:

- PIE (Position Independent Executable);
- Stack Protector;
- RELRO (Relocation Read-Only).

Формулировка про Hardened gentoo-sources во время структурной миграции не
проверялась и не заменялась новыми техническими утверждениями.

## 3. Пример sysctl policy

Файл: `/etc/sysctl.d/99-hardened-kernel.conf`

Ниже сохранён существующий пример политики hardening. Конкретные значения и
комментарии нужно проверять и адаптировать под окружение; в рамках этой
редакторской миграции они не исправлялись.

```conf
# Включаем Reverse Path Filtering (защита от IP-спуфинга)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# --- Защита файловой системы ---
# Ограничения на работу с FIFO и обычными файлами в sticky-директориях (/tmp)
# Значение 2 — максимально строгий режим (Full)
fs.protected_fifos = 2
fs.protected_regular = 2

# --- Скрытие указателей и ограничение perf ---
kernel.kptr_restrict = 2
kernel.perf_event_paranoid = 3

# --- Харденинг BPF ---
kernel.unprivileged_bpf_disabled = 1
net.core.bpf_jit_harden = 2

# --- Целостность системы и дампы ---
# Критично для связки Secure Boot + UKI
kernel.kexec_load_disabled = 1
fs.suid_dumpable = 0

# Ограничение TTY
dev.tty.ldisc_autoload = 0

# Ограничение на создание дампов памяти
kernel.core_pattern = |/bin/false

# Защита от атаки через перезагрузки (Cold boot attack)
kernel.panic = 10
kernel.panic_on_oops = 1
```

## 4. Module Silencing

Отключение загрузки неиспользуемых модулей и ограничение доступа к информации
о модулях.

## 5. Проверка

После изменения проверь фактические runtime values, убедись, что нужный
sysctl-файл загружается, и протестируй workloads, на которые могут влиять
ограничения. Этот документ не фиксирует результаты таких проверок.

## 6. Инструменты проверки

Следующие инструменты перечислены как возможные средства проверки; документ
не утверждает, что они установлены или уже использовались:

- `hardened-gentoo-hardened-check` — проверка статуса защиты;
- `lynis` — аудит безопасности;
- `aide` — обнаружение вторжений.

## 7. Rollback

До изменения сохрани прежнюю sysctl policy. Если возникнет регрессия, верни
предыдущие значения и повторно проверь затронутый workload.
