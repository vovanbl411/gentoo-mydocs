---
title: Gentoo Builder VM — gentoo-builder-01
kind: system
scope: system
status: current
last_verified: "2026-10-07"
verified_on: [gentoo-builder-01]
---

## Current state

`gentoo-builder-01` — отдельная headless VM на домашнем Proxmox для будущей
сборки portable userspace binpkgs (`.gpkg`) для ASUS B5402. Это replaceable
build appliance: она должна разгружать workstation, сохраняя её независимость
от сервера. VM создана вручную, Terraform/Packer не используются;
desktop/UI не устанавливается, обязательный autostart постоянного сервиса
не предусмотрен.

**Установка не завершена.** По предоставленным владельцем проверкам от
2026-10-07, stage3 распакован и chroot работает. Остановка — сразу после
просмотра исходного `/etc/portage/make.conf`, до его изменения.

| Параметр | Подтверждённое состояние |
|----------|--------------------------|
| VM | `gentoo-builder-01`, VMID `5201`, host `pve-01` |
| Ресурсы | 16 cores, 1 socket, 16384 MiB RAM, NUMA отключена |
| CPU | Proxmox `host`; гость видит Intel Xeon E5-2696 v4 (Broadwell-EP) |
| ISA capability | `x86-64-v3` подтверждена внутри VM; `x86-64-v4` не поддерживается |
| Диск | 100 GiB, GPT; 1 MiB BIOS boot, 8 GiB active swap, около 92 GiB ext4 root |
| Install state | Stage3 extracted в `/mnt/gentoo`; chroot operational, DNS работает |
| Release | Gentoo Base System release 2.18 |
| Текущий профиль stage3 | `default/linux/amd64/23.0/hardened/systemd` |
| Final profile / build target | no-multilib и `-march=x86-64-v3` ещё **pending** |
| Private binhost / binpkg pilot | Не настроен / не начат |

> **Важно:** поддержка `x86-64-v3` гостем не означает, что пакеты уже
> собираются с `-march=x86-64-v3`. Builder policy в `make.conf` ещё не применена.

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

Это запись выполненного этапа для этой VM, а не инструкция по разметке
произвольной системы. Команды создания разделов и файловых систем здесь
не приводятся: повторная разметка уничтожит данные целевого диска.

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
   распакован в `/mnt/gentoo`. Его текущий профиль — hardened/systemd,
   без no-multilib switch.
4. Для chroot подготовлены `/proc`, `/sys`, `/dev`, `/run`; `/etc/resolv.conf`
   передан в новую систему. После входа проверены release, profile,
   mountpoints и DNS.
5. Просмотрен исходный `/etc/portage/make.conf`; изменения builder policy
   ещё не вносились.

## Исходный make.conf и pending configuration

Файл внутри chroot: `/etc/portage/make.conf`.
Подтверждённые значения на точке остановки:

```makefile
COMMON_FLAGS="-O2 -pipe"
CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"
FCFLAGS="${COMMON_FLAGS}"
FFLAGS="${COMMON_FLAGS}"

LC_MESSAGES=C.UTF-8
```

В исходном файле также есть комментарий о сборке stage с USE-флагом `bindist`.
Это не запись final builder policy.

Ещё не применены `-march=x86-64-v3`, согласованный compiler/toolchain contract,
`RUSTFLAGS`, `GOAMD64`, builder `MAKEOPTS`, совместимый `CPU_FLAGS_X86`, cache
policy, switch на `default/linux/amd64/23.0/no-multilib/hardened/systemd`
и Portage package policy workstation. Private binhost не настроен;
end-to-end binpkg pilot не начат.

Следующее действие — review/apply `make.conf` и profile policy по
[согласованному Portage/profile/toolchain contract](../asus-b5402/system/boot-and-portage/).
Workstation сохраняет Alder Lake policy и local-only kernel. Builder получает
собственную execution policy под ресурсы VM; userspace targets
`-march=native`, `-march=broadwell` и `-march=alderlake` не используются.
Обязательные проверки будущего pilot при server ON / OFF остаются pending.

## Verification

Проверки выполнены владельцем 2026-10-07. Ниже — команды для сверки состояния;
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
readlink /etc/portage/make.profile
mountpoint /proc
mountpoint /sys
mountpoint /dev
mountpoint /run
getent hosts distfiles.gentoo.org
cat /etc/portage/make.conf
```

Release — `Gentoo Base System release 2.18`; profile link —
`../../var/db/repos/gentoo/profiles/default/linux/amd64/23.0/hardened/systemd`.
Все четыре mountpoint checks и DNS lookup — PASS. Эти проверки подтверждают
достигнутый chroot, а не завершённую установку или работоспособный binhost.
