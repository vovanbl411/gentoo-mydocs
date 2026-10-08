---
title: Gentoo Builder VM — gentoo-builder-01
kind: system
scope: system
status: current
last_verified: "2026-10-08"
verified_on: [gentoo-builder-01]
---

## Current state

`gentoo-builder-01` — отдельная headless VM на домашнем Proxmox для будущей
сборки portable userspace binpkgs (`.gpkg`) для ASUS B5402. Это replaceable
build appliance: она должна разгружать workstation, сохраняя её независимость
от сервера. VM создана вручную, Terraform/Packer не используются;
desktop/UI не устанавливается, обязательный autostart постоянного сервиса
не предусмотрен.

**No-multilib bootstrap завершён; установка в целом ещё не завершена.**
По предоставленным владельцем проверкам от 2026-10-08, текущая VM работает
с описанным ниже baseline. Stage3/chroot bootstrap повторно пройден;
`make.conf` настроен на `x86-64-v3`, профиль переключён на no-multilib,
пересборка завершилась успешно. Final resolver — `Total: 0 packages`.
Следующий этап — production LLVM/Clang/LLD builder policy.

| Параметр | Подтверждённое состояние |
|----------|--------------------------|
| VM | `gentoo-builder-01`, VMID `5201`, host `pve-01` |
| Ресурсы | 16 cores, 1 socket, 16384 MiB RAM, NUMA отключена |
| CPU | Proxmox `host`; гость видит Intel Xeon E5-2696 v4 (Broadwell-EP) |
| ISA capability | `x86-64-v3` подтверждена внутри VM; `x86-64-v4` не поддерживается |
| Диск | 100 GiB, GPT; 1 MiB BIOS boot, 8 GiB active swap, около 92 GiB ext4 root |
| Install state | Stage3 extracted в `/mnt/gentoo`; chroot operational, DNS работает |
| Release | Gentoo Base System release 2.18 |
| Активный профиль | `default/linux/amd64/23.0/no-multilib/hardened/systemd` |
| Build target / ABI | `-march=x86-64-v3 -O2 -pipe`; `ABI_X86=64`; GCC multilib list — только `.;` |
| Rebuild / resolver | Пересборка после смены профиля завершена; final resolver — `Total: 0 packages` |
| Production toolchain policy | LLVM/Clang/LLD ещё не настроены |
| Private binhost / binpkg pilot | Не настроен / не начат |

> **Важно:** применён минимальный CPU target для bootstrap. Это ещё не
> production toolchain и не завершённая execution policy builder.

## VM baseline

Подтверждённая Proxmox configuration после подготовки:

| Параметр | Значение |
|----------|----------|
| Agent | `agent: 1` — настройка Proxmox, не подтверждение работающего guest agent |
| Boot order | Installation ISO first, затем `scsi0` / `net0` |
| CPU / RAM | `cpu: host`, `cores: 16`, `sockets: 1`, `memory: 16384`, `numa: 0` |
| Диск | Storage `vm-nvme`, 100 GiB, VirtIO SCSI Single |
| Disk options | `discard=on`, `iothread=1`, `ssd=1` |
| Сеть | VirtIO, bridge `vmbr0`, VLAN `20`, `firewall=1` |
| Tags | `build`, `gentoo` |

Установочный образ — Gentoo amd64 Minimal Installation CD; локальное имя
в Proxmox — `gentoo-hardened-systemd-minimal.iso`. ISO использован только
как installer/live environment. Загрузка live environment — BIOS / SeaBIOS,
не UEFI.

## Выполненная подготовка до точки остановки

Stage3/chroot bootstrap повторно пройден 2026-10-08. Общая процедура — в
[руководстве по ручной установке Gentoo](../../installation/gentoo-installation/);
ниже остаются результаты для этой VM.

1. VM загружена с Minimal ISO. В госте подтверждена physical CPU model
   Intel Xeon E5-2696 v4; glibc loader показал поддержку `x86-64-v3` и
   `x86-64-v2`, но не `x86-64-v4`.
2. На `/dev/sda` (100 GiB, QEMU HARDDISK) создан GPT layout:

   | Раздел | Размер | Назначение / filesystem |
   |--------|--------|-------------------------|
   | `/dev/sda1` | 1 MiB | BIOS boot, `bios_grub`; filesystem отсутствует и не нужен |
   | `/dev/sda2` | 8 GiB | swap, label `gentoo-swap` |
   | `/dev/sda3` | Около 92 GiB | ext4, label `gentoo-root`, будущий `/` |

   Swap активирован; `/dev/sda3` смонтирован в `/mnt/gentoo`.
   LVM, Btrfs, отдельный `/boot` и дополнительные filesystem layers
   не вводились: builder остаётся простым и replaceable, thin provisioning
   уже предоставляет Proxmox storage layer.
3. Проверен checksum официального
   `stage3-amd64-hardened-systemd-20261004T164559Z.tar.xz`, затем stage3
   распакован в `/mnt/gentoo`. Исходный профиль stage3 —
   `default/linux/amd64/23.0/hardened/systemd`; активный профиль теперь no-multilib.
4. Для chroot подготовлены `/proc`, `/sys`, `/dev`, `/run`; `/etc/resolv.conf`
   передан в новую систему. После входа проверены release, profile,
   mountpoints и DNS.
5. Исходный `/etc/portage/make.conf` сохранён как `make.conf.stage3`;
   применён минимальный `-march=x86-64-v3 -O2 -pipe`, Gentoo repository
   синхронизирован, news просмотрены.
6. Выбран `default/linux/amd64/23.0/no-multilib/hardened/systemd`.
   Пересборка после смены профиля завершилась успешно; подтверждены
   `ABI_X86=64`, единственная строка `.;` в GCC multilib list и
   `Total: 0 packages` в final resolver.

## Текущий make.conf и pending configuration

Файл внутри chroot: `/etc/portage/make.conf`.
Подтверждённые значения на точке остановки:

```makefile
COMMON_FLAGS="-march=x86-64-v3 -O2 -pipe"
CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"
FCFLAGS="${COMMON_FLAGS}"
FFLAGS="${COMMON_FLAGS}"

LC_MESSAGES=C.UTF-8
```

Это минимальный bootstrap config, а не final builder policy.

Ещё не применены production LLVM/Clang/LLD compiler/toolchain policy,
`RUSTFLAGS`, `GOAMD64`, builder `MAKEOPTS`, совместимый `CPU_FLAGS_X86`, cache
policy, final execution policy и Portage package policy workstation.
Private binhost не настроен;
end-to-end binpkg pilot не начат.

Следующее действие — LLVM/toolchain stage по
[согласованному Portage/profile/toolchain contract](../asus-b5402/system/boot-and-portage/).
Workstation сохраняет Alder Lake policy; kernel по плану остаётся local-only
на workstation. Builder получает
собственную execution policy под ресурсы VM; userspace targets
`-march=native`, `-march=broadwell` и `-march=alderlake` не используются.
Обязательные проверки будущего pilot при server ON / OFF остаются pending.

## Verification

Проверки выполнены владельцем 2026-10-08. Ниже — команды для сверки состояния;
при обновлении документации они не запускались на живой VM.

В installer/live environment:

```bash
lscpu
lsblk -o NAME,SIZE,MODEL,FSTYPE,LABEL,MOUNTPOINTS
swapon --show
findmnt /mnt/gentoo
free -h
```

Подтверждены CPU model Broadwell-EP, доступная ext4 root, active swap 8 GiB
и примерно 16 GiB RAM. Вывод glibc loader внутри VM:

```text
x86-64-v4
x86-64-v3 (supported, searched)
x86-64-v2 (supported, searched)
```

В chroot:

```bash
cat /etc/gentoo-release
readlink -f /etc/portage/make.profile
mountpoint /proc
mountpoint /sys
mountpoint /dev
mountpoint /run
getent hosts distfiles.gentoo.org
cat /etc/portage/make.conf
portageq envvar COMMON_FLAGS CFLAGS CXXFLAGS FCFLAGS FFLAGS
eselect profile show
portageq envvar ABI_X86
gcc -print-multi-lib
emerge --pretend --verbose --update --deep --newuse --complete-graph @world
```

Release — `Gentoo Base System release 2.18`; активный профиль —
`default/linux/amd64/23.0/no-multilib/hardened/systemd`.
Все четыре mountpoint checks и DNS lookup — PASS. Portage показывает
`-march=x86-64-v3 -O2 -pipe` для всех пяти переменных; `ABI_X86=64`,
`gcc -print-multi-lib` выводит только `.;`. Пересборка завершилась успешно;
final resolver сообщает `Total: 0 packages`. Эти проверки подтверждают
завершённый no-multilib bootstrap, а не завершённую установку или
работоспособный binhost.
