---
title: Защита ядра Linux
kind: guide
scope: general
status: current
last_verified: "2026-10-31"
verified_on: [asus-b5402]
---

Проверяй hardening по слоям: настройки сборки, фактический Kconfig запущенного ядра, текущие runtime defaults и только затем дополнительные ограничения под конкретную цель. Универсального sysctl-набора для всех Gentoo-систем нет: значение может зависеть от ядра, init-системы и workload.

## 1. Gentoo kernel build

Профиль Portage, например `default/linux/amd64/23.0/no-multilib/hardened/systemd`, и USE-флаг `hardened` пакета `sys-kernel/gentoo-kernel` — разные механизмы. Профиль задаёт policy для Gentoo packages и toolchain; USE-флаг участвует в формировании Kconfig. Сам профиль не включает автоматически все kernel hardening options.

В текущем ebuild `sys-kernel/gentoo-kernel` флаг добавляет `hardened-base.config` и, если он существует, `hardened-<arch>.config`. Для GCC добавляется также `hardened-gcc-plugins.config`. Базовый hardened fragment основан на recommended settings Kernel Self-Protection Project с изменениями Gentoo.

В amd64 Fedora input config уже включены, например, `STRICT_KERNEL_RWX`, `STRICT_MODULE_RWX`, `STACKPROTECTOR_STRONG`, `HARDENED_USERCOPY`, `SLAB_FREELIST_HARDENED`, `FORTIFY_SOURCE` и `VMAP_STACK`. Hardened fragments повторяют часть этих настроек и добавляют, например, `INIT_ON_FREE_DEFAULT_ON`, `PANIC_ON_OOPS` и отключение `KEXEC`; `hardened-amd64.config` также задаёт `RANDOMIZE_BASE`. Поэтому по одному USE-флагу нельзя определить итоговый Kconfig.

`savedconfig` и версия исходников тоже влияют на результат. Источник истины для build-time protections — итоговый конфиг именно запущенного ядра. При полностью собственной конфигурации используй KSPP как справочник, а не как готовый список для слепого копирования.

## 2. Проверка Kconfig запущенного ядра

Сначала сопоставь конфиг с `uname -r`. Если ядро экспортирует `/proc/config.gz`, он содержит конфигурацию running kernel. Иначе проверь соответствующий ему `/boot/config-$(uname -r)`; не подставляй конфиг другой версии. Команда показывает только выбранные параметры, а не весь `.config`.

```bash
pattern='^(# )?CONFIG_(STRICT_KERNEL_RWX|STRICT_MODULE_RWX|STACKPROTECTOR_STRONG|HARDENED_USERCOPY|SLAB_FREELIST_RANDOM|SLAB_FREELIST_HARDENED|RANDOM_KMALLOC_CACHES|KMALLOC_PARTITION_CACHES|SHUFFLE_PAGE_ALLOCATOR|INIT_ON_ALLOC_DEFAULT_ON|INIT_ON_FREE_DEFAULT_ON|VMAP_STACK|REFCOUNT_FULL|FORTIFY_SOURCE|SECURITY_DMESG_RESTRICT|RANDOMIZE_BASE|BPF_UNPRIV_DEFAULT_OFF|KEXEC|KEXEC_FILE|PANIC_ON_OOPS|PANIC_TIMEOUT|MODULE_SIG|MODULE_SIG_FORCE)(=| is not set)'
zgrep -E "$pattern" /proc/config.gz 2>/dev/null ||
    grep -E "$pattern" "/boot/config-$(uname -r)" 2>/dev/null || true
```

Строка `# CONFIG_NAME is not set` означает, что параметр выключен. Отсутствие строки само по себе не доказывает, что опция выключена: символ мог измениться или исчезнуть в этой версии ядра. Сверяй его с исходниками соответствующей версии и проверяй итоговый конфиг после merge `savedconfig`.

## 3. Runtime policy knobs

Сначала посмотри текущее значение через `sysctl` и проверь, кто его задаёт. Меняй значение только при понятной цели и после проверки совместимости.

| Параметр | Что ограничивает | Основной trade-off |
|---|---|---|
| `kernel.kptr_restrict` | `0` оставляет минимальные ограничения и хеширует адреса; `1` ограничивает вывод через `%pK` с проверкой capabilities; `2` скрывает такие адреса независимо от прав. | kernel debugging и observability |
| `kernel.perf_event_paranoid` | Уровень `>=2` запрещает unprivileged kernel profiling; upstream описывает пороги `-1`, `>=0`, `>=1` и `>=2`. | `perf`, profilers и observability; отдельный уровень `3` не нужен как portable recommendation |
| `kernel.unprivileged_bpf_disabled` | `0` разрешает unprivileged BPF; `1` запрещает его до reboot без обратного переключения; `2` запрещает, но допускает последующее изменение. При `CONFIG_BPF_UNPRIV_DEFAULT_OFF=y` начальное значение уже `2`. | BPF workloads; переход `2 → 1` делает запрет необратимым до reboot |
| `net.core.bpf_jit_harden` | `0` выключает hardening JIT; `1` включает его для unprivileged users; `2` — для всех. | производительность; настройка имеет смысл только если knob доступен и используется BPF JIT |
| `fs.protected_fifos`, `fs.protected_regular` | `1` ограничивает `O_CREAT`-открытие уже существующих чужих FIFO или regular files в world-writable sticky directories; `2` распространяет ограничение также на group-writable sticky directories. | совместимость отдельных приложений; проверь kernel defaults и уже заданную system policy |
| `fs.suid_dumpable` | Управляет core dumps для setuid и других защищённых процессов. Upstream default — `0`, но system config может выбрать другое значение для своего collector. | диагностика аварий; не добавляй override, если текущее значение уже соответствует выбранной policy |
| `dev.tty.ldisc_autoload` | `0` запрещает обычным users автоматически загружать модули line discipline. | workloads, которым нужна автоматическая загрузка line discipline |
| `kernel.kexec_load_disabled` | Отключает `kexec_load` и `kexec_file_load`, если поддержка kexec собрана в ядро. Значение `1` необратимо до reboot. | последующий kexec или kdump; если `CONFIG_KEXEC` и `CONFIG_KEXEC_FILE` выключены, knob не нужен |

`net.ipv4.conf.*.rp_filter` — network/routing policy, а не общая рекомендация по hardening ядра. Strict mode может нарушить asymmetric или policy routing, multihoming и VPN; anti-spoofing настраивай с учётом topology.

`kernel.core_pattern` задаёт обработку core dumps. Значение `|/bin/false` отбрасывает дампы и может отключить `systemd-coredump` и диагностику приложений. Выбор collector — отдельная policy. `kernel.panic_on_oops` и `kernel.panic` задают failure/recovery behavior: например, timeout меняет решение о перезагрузке после panic. Это не универсальный hardening preset.

Не смешивай подпись модулей, Secure Boot и runtime запрет загрузки. `CONFIG_MODULE_SIG_FORCE` задаёт enforcement подписей ядром; Secure Boot проверяет цепочку загрузки. `kernel.modules_disabled=1` запрещает загружать и выгружать модули до reboot. Это high-impact решение: сначала проверь, что все нужные hardware и workload modules уже доступны. Автозагрузка модулей тоже может быть нужна системе и не равна явной загрузке.

## 4. Применение выбранного значения

Пример показывает порядок действий, а не рекомендацию выставить именно `kernel.kptr_restrict=2`.

1. Запиши текущее значение: `sysctl kernel.kptr_restrict`.
2. Проверь, как изменение повлияет на нужные инструменты и workloads.
3. Если параметр обратим, при необходимости временно проверь его:

   ```bash
   doas sysctl -w kernel.kptr_restrict=2
   ```

4. После проверки сохрани только выбранное значение.

   Файл: `/etc/sysctl.d/90-local-hardening.conf`

   ```ini
   kernel.kptr_restrict = 2
   ```

5. Загрузи только этот файл и проверь результат:

   ```bash
   doas sysctl -p /etc/sysctl.d/90-local-hardening.conf
   sysctl kernel.kptr_restrict
   ```

Перед обратимым изменением запиши предыдущее значение. Для отката верни его командой `doas sysctl -w <key>=<previous-value>`, затем исправь или удали local entry.

Значения `kernel.unprivileged_bpf_disabled=1`, `kernel.kexec_load_disabled=1` и `kernel.modules_disabled=1` нельзя отменить записью другого значения до reboot. Не проверяй их случайным live-переключением: сначала проверь Kconfig и current state, определи recovery path, затем принимай отдельное policy-решение. Если значение уже сохранено в persistent sysctl configuration, сначала удали или исправь эту запись, затем перезагрузи систему и проверь фактическое значение.

## 5. Проверка после изменения

Проверяй каждый слой отдельно:

- **Build-time:** `uname -r` и соответствующие строки running Kconfig в `/proc/config.gz` или matching `/boot/config-$(uname -r)`.
- **Runtime:** фактические значения выбранных ключей через `sysctl <key>`.
- **Persistent source:** только относящиеся к выбранным ключам записи в `/etc/sysctl.conf`, `/etc/sysctl.d/`, `/run/sysctl.d/` и `/usr/lib/sysctl.d/`.
- **Boot parameters:** `cat /proc/cmdline`.
- **Workload:** проверь именно затронутую функцию — например, perf/profilers, BPF, kexec/kdump, core-dump collector, networking или загрузку hardware modules.

Проверяй системные данные и затронутый workload; внешний scanner используй только как дополнительный инструмент.

## Источники

- [Linux Kernel Self-Protection](https://docs.kernel.org/security/self-protection.html)
- [Gentoo `sys-kernel/gentoo-kernel` ebuild](https://github.com/gentoo/gentoo/tree/master/sys-kernel/gentoo-kernel)
- [Gentoo `hardened-base.config`](https://github.com/gentoo/gentoo-kernel-config/blob/master/hardened-base.config) и [`hardened-amd64.config`](https://github.com/gentoo/gentoo-kernel-config/blob/master/hardened-amd64.config)
- Linux kernel [kernel sysctl](https://docs.kernel.org/admin-guide/sysctl/kernel.html), [filesystem sysctl](https://docs.kernel.org/admin-guide/sysctl/fs.html), [network sysctl](https://docs.kernel.org/admin-guide/sysctl/net.html) и [IP sysctl](https://docs.kernel.org/networking/ip-sysctl.html)
