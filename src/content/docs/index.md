---
title: Gentoo Linux Documentation
kind: reference
scope: repository
status: current
last_verified: "2026-11-01"
verified_on: []
---

Практическая документация по Gentoo Linux: общие руководства, состояние
эталонной системы ASUS ExpertBook B5402, решения конкретных проблем и
результаты экспериментов. Основные темы — hardened/systemd Gentoo,
compiler/toolchain, Wayland desktop, systemd-boot и UKI, Btrfs и Snapper,
Secure Boot и TPM 2.0.

## Что здесь находится

- **Общие руководства** — повторяемые инструкции; примеры конфигурации могут
  требовать адаптации под другое оборудование и задачи.
- **Состояние ASUS B5402** — конфигурация и решения для одной конкретной
  машины в [системном разделе](./systems/asus-b5402/).
- **Troubleshooting** — диагностика и восстановление после конкретных проблем.
- **Эксперименты** — измерения и результаты проверок, на которых основаны
  отдельные решения. Эти материалы могут описывать прошлое состояние и не
  обязательно совпадают с текущей конфигурацией.

## С чего начать

- [Ручная установка Gentoo amd64](./installation/gentoo-installation/) —
  проверенный здесь вариант BIOS + GPT + GRUB; вариант UEFI в этом руководстве
  не проверен.
- [Базовая настройка системы](./installation/base-system/) — пример
  конфигурации Portage и toolchain, который нужно адаптировать под свою систему.
- [Umbriel и Noctalia](./desktop/umbriel/) — текущее Wayland-окружение;
  [Niri](./desktop/niri/) остаётся запасной сессией.
- [ASUS ExpertBook B5402](./systems/asus-b5402/) — текущее документированное
  состояние эталонной системы.

Policy, contributing guide и archive находятся в
[репозитории на GitHub](https://github.com/vovanbl411/gentoo-mydocs), а не на
сайте документации.
