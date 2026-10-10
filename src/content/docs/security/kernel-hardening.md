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

`sys-kernel/gentoo-sources` предоставляет Linux sources с Gentoo patchset.
Использование `gentoo-sources` само по себе не означает конкретный набор
hardening-опций: для самостоятельно собираемого ядра hardening определяется
прежде всего его Kconfig.

У `sys-kernel/gentoo-kernel` есть local USE flag `hardened`, который включает
подборку hardening-опций, рекомендованных Kernel Self Protection Project.

`PIE`, ELF `RELRO` и подобные механизмы — это userspace toolchain hardening,
отдельный уровень защиты, который не следует смешивать с kernel Kconfig
hardening.

## 3. Пример sysctl policy

Файл: `/etc/sysctl.d/99-hardened-kernel.conf`

Ниже приведён пример политики hardening. Это не рекомендация для произвольной
системы и не описание применённой конфигурации конкретного компьютера; значения
и комментарии нужно проверять и адаптировать под окружение.

```conf
# Reverse Path Filtering: 1 — strict mode (защита от IP-спуфинга)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# --- Защита файловой системы ---
# Ограничения на FIFO и обычные файлы в sticky-директориях (/tmp)
fs.protected_fifos = 2
fs.protected_regular = 2

# --- Скрытие указателей и ограничение perf ---
kernel.kptr_restrict = 2
kernel.perf_event_paranoid = 3

# --- Харденинг BPF ---
kernel.unprivileged_bpf_disabled = 1
net.core.bpf_jit_harden = 2

# --- Целостность системы и дампы ---
kernel.kexec_load_disabled = 1
fs.suid_dumpable = 0

# Ограничение TTY
dev.tty.ldisc_autoload = 0

# Core dump передаётся userspace-хелперу через stdin (/bin/false его отбрасывает)
kernel.core_pattern = |/bin/false

# panic_on_oops = 1: kernel oops/BUG превращается в panic
# panic = 10: перезагрузка через 10 секунд после panic
kernel.panic_on_oops = 1
kernel.panic = 10
```

### Пояснения к отдельным параметрам

**rp_filter.** `1` — strict reverse-path filtering: лучший reverse route для
входящего source-адреса должен использовать тот же interface, через который
пришёл пакет. Strict mode может мешать asymmetric routing, policy routing,
multihoming и некоторым сетевым конфигурациям (например, VPN); для таких
окружений иногда лучше подходит loose mode (`2`).

**fs.protected_fifos / fs.protected_regular.** `1` ограничивает `O_CREAT` для
чужих объектов в world-writable sticky-директориях; `2` распространяет эту
защиту также на group-writable sticky-директории.

**kernel.unprivileged_bpf_disabled.** `1` отключает unprivileged `bpf()`:
после установки в `1` вернуть значение в `0` нельзя до reboot. Значение `2`
тоже отключает unprivileged BPF, но остаётся reversible.

**net.core.bpf_jit_harden.** `2` включает JIT hardening для всех users; у
такого режима есть performance cost, и он имеет смысл только при реально
используемом BPF JIT.

**kernel.kexec_load_disabled.** Отключает syscalls `kexec_load` и
`kexec_file_load`; переход в `1` необратим до следующего boot. Уменьшает
возможность подменить или загрузить новое kernel image через kexec, но
несовместим с обычным последующим использованием kexec и может влиять на
kdump/crash-kernel workflows. Параметр не обязателен для Secure Boot, UKI или
systemd-boot.

**kernel.core_pattern.** Строка, начинающаяся с `|`, означает, что kernel
передаёт core dump в userspace helper через stdin. `|/bin/false` фактически
направляет core stream в `/bin/false`, который его отбрасывает.

> ⚠️ **Важный нюанс**: такой setting заменяет обычный core-dump collector и
> может мешать crash diagnostics и системной обработке coredump. Применяй его,
> только если действительно хочешь отказаться от userspace core dumps.

**fs.suid_dumpable = 0** отдельно запрещает core dumps для setuid и других
защищённых процессов в стандартном режиме.

**kernel.panic_on_oops / kernel.panic.** `panic_on_oops = 1` превращает kernel
oops/BUG в panic; `panic = 10` перезагружает систему через 10 секунд после
panic. Это availability/recovery policy, а не защита от cold boot attacks или
RAM remanence. Trade-off: fail-fast может быть полезнее, чем продолжать работу
на повреждённом kernel state, но автоматический reboot может мешать
crash-dump/debugging workflows и при постоянной причине panic способен
приводить к reboot loop.

## 4. Module loading considerations

Ограничение загрузки модулей (полный запрет, blacklisting, требования подписи)
— отдельная policy с возможными compatibility consequences для оборудования и
workloads. В этом документе конкретные правила не задаются.

## 5. Проверка

После изменения проверь фактические runtime values, убедись, что нужный
sysctl-файл загружается, и протестируй workloads, на которые могут влиять
ограничения. Этот документ не фиксирует результаты таких проверок.

## 6. Инструменты проверки

Следующие инструменты перечислены как возможные средства проверки; документ
не утверждает, что они установлены, присутствуют в Gentoo repository или уже
использовались:

- `kernel-hardening-checker` — внешний инструмент для проверки Kconfig,
  kernel command line и sysctl;
- `lynis` — общий аудит безопасности.

## 7. Rollback

До изменения сохрани прежнюю sysctl policy. Если возникнет регрессия, верни
предыдущие значения и повторно проверь затронутый workload.
