---
title: "Настройка сети: NetworkManager + iwd"
kind: guide
scope: general
status: current
last_verified: "2026-09-21"
verified_on: [asus-b5402]
---

В этой конфигурации NetworkManager использует `iwd` как Wi-Fi backend.
NetworkManager остаётся верхним уровнем управления подключениями, а `iwd`
обслуживает беспроводную часть. В результате Wi-Fi-подключения по-прежнему
настраиваются и контролируются через NetworkManager.

Фактическое состояние ASUS B5402 записано в
[системном разделе](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).
Оно не является обязательной конфигурацией для других систем. Отдельная
диагностика MAC randomization находится в
[troubleshooting-документе](../../troubleshooting/networkmanager-iwd-mac-randomization/).

## 1. Когда применять и что проверить заранее

Перед настройкой проверь:

- NetworkManager собран с поддержкой `iwd`;
- в системе нет другого Wi-Fi backend или сетевого сервиса, который будет
  конфликтовать с выбранным стеком;
- временный разрыв Wi-Fi при изменении или перезапуске сетевого сервиса
  допустим.

## 2. Пример настройки Portage

Следующий `package.use` — пример конфигурации, а не универсально необходимый
набор USE-флагов.

Файл: `/etc/portage/package.use/networkmanager`

```makefile
net-misc/networkmanager -iptables -dhcpcd -wext -modemmanager -ppp -bluetooth concheck tools connection-sharing iwd audit psl
net-vpn/networkmanager-openvpn -gtk
```

## 3. Конфигурация NetworkManager

Файл задаёт три отдельные части конфигурации:

- `wifi.backend=iwd` выбирает `iwd` как Wi-Fi backend;
- `wifi.scan-rand-mac-address=yes` включает MAC randomization при сканировании;
- `wifi.cloned-mac-address=stable` и
  `ethernet.cloned-mac-address=stable` задают стабильный cloned MAC для
  подключений.

Файл: `/etc/NetworkManager/conf.d/99-wifi-backend.conf`

```ini
[main]
plugins=keyfile

[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
```

## 4. Сервисы

После проверки конфликтующих сетевых служб включи выбранный стек:

```bash
doas systemctl enable --now iwd
doas systemctl enable --now NetworkManager
```

Запуск или перезапуск этих сервисов может временно разорвать текущее
Wi-Fi-соединение.

## 5. Локальный hardening для iwd

Если для `iwd.service` создан локальный drop-in, каждая строка в секции
`[Service]` должна иметь вид `Директива=значение`. Отдельная строка с именем
capability, например `CAP_SYS_MODULE`, не является настройкой: systemd
проигнорирует её с сообщением `Missing '='`.

`CapabilityBoundingSet=` задаёт верхнюю границу capabilities процесса, а не
выдаёт ему права. Не добавляй в набор `CAP_SYS_MODULE`: iwd не загружает
модули ядра, а эта capability разрешает их загрузку и выгрузку.

> ⚠️ **Важный нюанс**: не задавай для `iwd.service`
> `ProtectKernelTunables=yes`. iwd сам управляет network sysctl
> `arp_evict_nocarrier` (IPv4) и `ndisc_evict_nocarrier` (IPv6) — в том
> числе для корректного поведения Wi-Fi roaming при потере carrier, — а
> `ProtectKernelTunables=yes` делает kernel tunables, включая `/proc/sys`,
> недоступными для записи сервису. В журнале это проявляется строками вида
> `iwd: Unable to write arp_evict_nocarrier to
> /proc/sys/net/ipv4/conf/wlan0/arp_evict_nocarrier`. Hardening должен
> учитывать реальные runtime requirements сервиса: `CapabilityBoundingSet`
> и другие совместимые ограничения при этом можно сохранять.

Файл: `/etc/systemd/system/iwd.service.d/override.conf`

```ini
[Service]
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW CAP_NET_BIND_SERVICE
```

## 6. Применение и проверка

Перед заменой существующей строки и после изменения посмотри итоговую
конфигурацию unit-файла:

```bash
doas systemctl cat iwd.service
```

Перечитай unit-файлы и проверь синтаксис:

```bash
doas systemctl daemon-reload
doas systemd-analyze verify iwd.service
```

Новые sandbox-настройки применятся при следующем запуске iwd. Чтобы не
обрывать текущее Wi-Fi-соединение, отложи применение до следующей
перезагрузки; `doas systemctl restart iwd` временно разорвёт его.

После применения проверь, что Wi-Fi работает под управлением NetworkManager,
а в журнале iwd нет ошибок, связанных с drop-in или записью
`arp_evict_nocarrier` и `ndisc_evict_nocarrier`. Эти проверки не считаются
выполненными только потому, что синтаксис unit-файла корректен.

## 7. Rollback

Если после перезапуска iwd перестал подключаться к сети, верни прежнее
содержимое локального drop-in или удали override, затем снова выполни
`doas systemctl daemon-reload`. Перезапусти iwd либо оставь применение до
следующей загрузки, если текущее соединение нельзя прерывать.

## Related docs

- [Сеть ASUS B5402](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — фактическое состояние эталонной системы.
- [Диагностика MAC randomization](../../troubleshooting/networkmanager-iwd-mac-randomization/)
  — отдельный troubleshooting-документ.

## References

- [iwd — systemd unit-файл upstream](https://git.kernel.org/pub/scm/network/wireless/iwd.git/tree/src/iwd.service.in)
- [iwd — src/station.c (управление sysctl nocarrier)](https://git.kernel.org/pub/scm/network/wireless/iwd.git/tree/src/station.c)
- [systemd.exec(5) — CapabilityBoundingSet=](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#CapabilityBoundingSet=)
- [systemd.exec(5) — ProtectKernelTunables=](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#ProtectKernelTunables=)
- [Документация ядра — ip-sysctl (`arp_evict_nocarrier`, `ndisc_evict_nocarrier`)](https://docs.kernel.org/networking/ip-sysctl.html)
- [capabilities(7) — CAP_SYS_MODULE](https://man7.org/linux/man-pages/man7/capabilities.7.html)
