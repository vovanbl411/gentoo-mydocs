# Защита ядра Linux

Данный раздел описывает меры по усилению безопасности ядра Linux.

## Основные направления защиты

### 1. Hardened gentoo-sources

Ядро собирается с дополнительными мерами защиты:

- PIE (Position Independent Executable)
- Stack Protector
- RELRO (Relocation Read-Only)

### 2. sysctl параметры

Настройка в `/etc/sysctl.d/99-security.conf`:

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

### 3. Module Silencing

Отключение загрузки неиспользуемых модулей и ограничение доступа к информации о модулях.

## Инструменты проверки

- `hardened-gentoo-hardened-check` — проверка статуса защиты
- `lynis` — аудит безопасности
- `aide` — обнаружение вторжений
