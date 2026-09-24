---
title: "Решение конфликта маршрутизации: Docker + Libvirt на Gentoo (nftables)"
kind: troubleshooting
scope: general
status: current
last_verified: "2026-09-22"
verified_on: [asus-b5402]
---

## 1. Symptom

Виртуальная машина доступна с хоста, но не получает ожидаемый внешний доступ.
На хосте одновременно используются Docker, Libvirt и nftables, а проблема
проявляется при обработке forwarded traffic из подсети VM.

## 2. Когда применять

- Подсеть `10.0.0.0/24` ниже приведена как пример. Для другой сети правила
  нужно адаптировать.
- Не копируй правила в другой production firewall без резервной копии,
  dry-run и доступного способа отката.
- До изменения проверь backend и версию Docker, а также текущий nftables
  ruleset.
- Убедись, что наблюдаемый симптом соответствует описанию выше.

> **Примечание для Docker 29:** нативный nftables backend по-прежнему
> включается только явно. Если после обновления `docker.service` падает с
> ошибкой `iptables not found`, см.
> [отдельную инструкцию](../docker-29-iptables-missing/).

## 3. Cause

В описанном случае пакеты доходят до сетевого стека хоста, но `ip_forward` не
срабатывает — VM остаются в своей подсети.

В nftables несколько таблиц могут подписываться на один hook. Docker и Libvirt
оба цепляются на `forward` с priority `filter` (0):

- **Docker** создаёт `table ip filter` → `chain FORWARD` с
  `priority 0; policy drop;`;
- **Libvirt** создаёт `table ip libvirt_network` → `chain forward` с
  `priority 0; policy accept;`.

В nftables вердикт **DROP терминален**. Даже если Libvirt разрешил пакет,
policy drop в таблице Docker, обработанный в той же точке hook, уничтожает
пакет.

## 4. Fix

Решение использует независимую nftables table с отрицательным приоритетом
вместо изменения `DOCKER-USER`, цепочки которого Docker пересоздаёт при
рестарте.

В приведённом примере меньшее число priority означает более раннюю обработку:
`priority -10` срабатывает до Docker (`priority 0`) и принимает трафик VM
раньше, чем Docker его блокирует.

| Таблица | Priority | Policy | Результат |
|---------|----------|--------|-----------|
| `gentoo_bridge_libvirt` | **-10** | `accept` | Пакет принят **до** Docker |
| `ip filter` (Docker) | 0 | `drop` | Не видит пакет — уже обработан |

> **Важно:** В nftables `accept` в одной цепочке не останавливает обработку
> полностью — пакет всё ещё проходит через другие цепочки на том же hook. Но
> поскольку наш `accept` срабатывает раньше (priority -10), Docker (priority
> 0) уже не может его дропнуть — пакет помечен как принятый.

### Generic example

Полная процедура ниже создаёт generic layout example в
`/etc/nftables/rules/main.nft`. Подсети и совместимость с остальным ruleset
нужно проверить до применения.

### Reference system: ASUS B5402

Решение проверялось на ASUS B5402. Фактическая структура, текущие версии и
подтверждённое состояние находятся в
[системном документе](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).
Текущее состояние эталонной системы здесь не дублируется.

## 5. Verification

До фикса ожидаемый симптом выглядит так: VM доступна с хоста, но проверка
внешнего соединения из VM завершается ошибкой или потерей пакетов.

После фикса нужно проверить:

- наличие table `ip gentoo_bridge_libvirt` и chain `bypass_docker`;
- порядок hook priorities относительно Docker;
- внешний доступ из VM;
- DNS и HTTP;
- рост nftables counters для трафика нужной подсети.

Команды и ожидаемые примеры вывода приведены в безопасном порядке применения
ниже. Они не означают, что проверка уже выполнена в другом окружении.

## 6. Rollback / recovery

Если правила нарушили сетевую доступность, верни backup `main.nft`, созданный
до изменения. Подставь фактическую дату файла резервной копии вместо
`YYYYMMDD`:

```bash
$ doas cp /etc/nftables/rules/main.nft.backup.YYYYMMDD /etc/nftables/rules/main.nft
$ doas /usr/sbin/nft -c -f /etc/nftables/rules/main.nft
$ doas /usr/sbin/nft -f /etc/nftables/rules/main.nft
# Альтернатива для загрузки через сервис
$ doas systemctl restart nftables
```

После возврата прежнего ruleset проверь, что ожидаемая сеть восстановилась.

## 7. Установка nftables, если пакет отсутствует

```bash
# Проверка профиля
$ eselect profile show | grep systemd
# Должно содержать: default/linux/amd64/23.0/systemd (или новее)

# Установка
$ doas emerge -av net-firewall/nftables
```

## 8. Safe application flow

В этом документе для Gentoo с systemd используется путь:

```text
/etc/nftables/rules/main.nft
```

Процедура исходит из того, что этот файл загружает `nftables.service` при
старте системы; это проверяется через
`ConditionPathExists=/etc/nftables/rules/main.nft`. Варианты с другим layout
в этой процедуре не рассматриваются.

### 1. Backup

```bash
$ doas mkdir -p /etc/nftables/rules
$ doas cp /etc/nftables/rules/main.nft /etc/nftables/rules/main.nft.backup.$(date +%Y%m%d) 2>/dev/null || true
$ doas nft list ruleset > ~/nftables-ruleset-backup.txt
```

### 2. Configuration

Этот блок создаёт generic example. Он не описывает фактическое имя
system-specific файла ASUS B5402.

```bash
# Создаём директорию (если её нет)
$ doas mkdir -p /etc/nftables/rules

# Пишем конфиг
$ doas tee /etc/nftables/rules/main.nft << 'EOF'
#!/usr/sbin/nft -f

flush ruleset

table ip gentoo_bridge_libvirt {
    chain bypass_docker {
        type filter hook forward priority -10; policy accept;
        ip saddr 10.0.0.0/24 accept
        ip daddr 10.0.0.0/24 accept
        ip saddr 192.168.122.0/24 accept
        ip daddr 192.168.122.0/24 accept
    }
}
EOF

# Права на файл
$ doas chmod 644 /etc/nftables/rules/main.nft
```

### 3. Syntax / dry-run check

Проверка синтаксиса не загружает ruleset:

```bash
$ doas /usr/sbin/nft -c -f /etc/nftables/rules/main.nft
```

### 4. Pre-fix verification / baseline

Проверь ожидаемый источник блокировки до применения фикса:

```bash
# До фикса — Docker блокирует весь forward-трафик
$ doas nft list ruleset | grep -A 5 "chain FORWARD"
# table ip filter {
#   chain FORWARD {
#     type filter hook forward priority filter; policy drop;
#     ...
#   }
# }
```

До фикса ожидаемый симптом:

```bash
# С хоста — VM пингуется
$ ping 10.0.0.80  # OK

# Из VM — наружу не выходит
$ ssh vladimir@10.0.0.80
$ ping -c 3 1.1.1.1
# ping: connect: Network is unreachable
# или 100% packet loss
```

### 5. Apply

> ⚠️ **Важный нюанс**: `flush ruleset` удаляет уже загруженные правила, а
> загрузка нового файла может немедленно изменить сетевую доступность.

```bash
# Применение правил
$ doas /usr/sbin/nft -f /etc/nftables/rules/main.nft

# Альтернатива — через systemd
$ doas systemctl restart nftables
```

### 6. Post-fix verification

После применения проверь наличие table и chain:

```bash
$ doas nft list table ip gentoo_bridge_libvirt
# Должно показать:
# table ip gentoo_bridge_libvirt {
#   chain bypass_docker {
#     type filter hook forward priority filter - 10; policy accept;
#     ip saddr 10.0.0.0/24 accept
#     ip daddr 10.0.0.0/24 accept
#   }
# }
```

`nft` отображает `priority -10` как `priority filter - 10`. В существующем
объяснении `filter` — базовый приоритет (0), а `- 10` означает «минус 10 от
базового».

Проверь порядок обработки hook:

```bash
$ doas nft list ruleset | grep "hook forward"
# Должно быть:
# type filter hook forward priority filter - 10; policy accept;  ← наш фикс
# type filter hook forward priority filter; policy drop;         ← Docker
```

Затем проверь подключение из VM, DNS, HTTP и counters:

```bash
# Из VM
$ ping -c 3 1.1.1.1        # OK
$ curl -I https://docker.io # HTTP/2 401 (это норма, значит доходит)
$ dig +short gentoo.org     # Возвращает IP

# Проверка счётчиков nftables
$ doas nft list chain ip gentoo_bridge_libvirt bypass_docker -a
# counter packets 1234 bytes 567890 ip saddr 10.0.0.0/24 accept # ← счётчик растёт
```

### 7. Enable persistence

После проверки результата убедись, что unit видит файл, и включи
автозагрузку:

```bash
# Проверяем, что юнит видит файл
$ doas systemctl status nftables
# Должно быть: ConditionPathExists=/etc/nftables/rules/main.nft met

# Включаем автозагрузку
$ doas systemctl enable --now nftables
```

## 9. Extensions

### Добавление новых сетей

Если появляются новые подсети, например для k8s, дополни generic example:

```nft
table ip gentoo_bridge_libvirt {
    chain bypass_docker {
        type filter hook forward priority -10; policy accept;

        # Существующие сети
        ip saddr 10.0.0.0/24 accept
        ip daddr 10.0.0.0/24 accept
        ip saddr 192.168.122.0/24 accept
        ip daddr 192.168.122.0/24 accept

        # Новая сеть для k8s
        ip saddr 10.244.0.0/16 accept
        ip daddr 10.244.0.0/16 accept
    }
}
```

После изменения:

```bash
$ doas /usr/sbin/nft -f /etc/nftables/rules/main.nft
$ doas systemctl restart nftables
```

### Разделение по файлам для сложных конфигураций

Следующая структура — generic layout example. Имя `libvirt.nft` не является
фактическим именем system-specific файла эталонной системы.

```text
/etc/nftables/
└── rules/
    ├── main.nft          # Точка входа
    ├── base.nft          # Базовые правила
    └── libvirt.nft       # Фикс для Libvirt
```

Файл: `/etc/nftables/rules/main.nft`

```nft
#!/usr/sbin/nft -f

flush ruleset

include "/etc/nftables/rules/base.nft"
include "/etc/nftables/rules/libvirt.nft"
```

## 10. Alternatives

В этой процедуре не используются следующие варианты:

| Способ | Почему не используется |
|--------|------------------------|
| `iptables -I DOCKER-USER -i virbr+ -j ACCEPT` | Docker пересоздаёт цепочки при рестарте — правило слетит. К тому же в нативном nftables backend Docker (29.0+) `DOCKER-USER` **не существует** |
| `docker daemon --iptables=false` | Сломает port mapping для всех контейнеров |
| `echo 1 > /proc/sys/net/ipv4/ip_forward` | Уже включено, проблема не в нём |

## 11. Historical context

Следующий блок описывает окружение прежней проверки и не является текущим
состоянием ASUS B5402:

- **OS:** Gentoo Linux, profile `default/linux/amd64/23.0/systemd`;
- **Kernel:** 6.x (Alder Lake, Clang/LLVM + ThinLTO);
- **Init:** systemd;
- **Firewall:** nftables 1.1.x (`net-firewall/nftables`);
- **Docker:** 29.8.0 (iptables-nft backend);
- **Libvirt:** 10.x (QEMU/KVM, default NAT network);
- **Privilege escalation:** doas.

Текущее подтверждённое состояние эталонной системы смотри в
[системном документе](../../systems/asus-b5402/networking/networkmanager-and-libvirt/).

## 12. Additional troubleshooting

### Правила не загрузились после рестарта

```bash
# Проверить, что файл существует
$ ls -la /etc/nftables/rules/main.nft

# Проверить статус юнита
$ doas systemctl status nftables
# Если: ConditionPathExists=/etc/nftables/rules/main.nft was not met
# → Файла нет или путь неправильный

# Проверить синтаксис
$ doas /usr/sbin/nft -c -f /etc/nftables/rules/main.nft
```

### Правила загружены, но трафик всё ещё блокируется

```bash
# Проверить, что таблица реально перехватывает
$ doas nft list ruleset | grep -B2 -A5 "priority filter - 10"
# Должно быть: type filter hook forward priority filter - 10

# Если priority 0 — опечатка в конфиге

# Проверить, что Docker не перехватывает раньше
$ doas nft list ruleset | grep "hook forward"
# gentoo_bridge_libvirt: priority filter - 10
# filter (Docker): priority filter
```

### Конфликт с firewalld

Следующие команды останавливают, отключают и удаляют `firewalld`. Используй их
только если выбран nftables без firewalld и подготовлен откат:

```bash
$ doas systemctl stop firewalld
$ doas systemctl disable firewalld
$ doas emerge -C firewalld
```

### Docker не стартует после изменений

Если журнал содержит `failed to create NAT chain DOCKER: iptables not found`,
проблема не в порядке запуска `nftables.service`. Используй
[инструкцию для Docker 29](../docker-29-iptables-missing/).

```bash
# Проверить, что nftables загрузился до Docker
$ doas journalctl -u docker.service -b | grep -i nftables

# Если Docker стартовал раньше — добавить зависимость
$ doas mkdir -p /etc/systemd/system/docker.service.d/
$ doas tee /etc/systemd/system/docker.service.d/nftables-dependency.conf << 'EOF'
[Unit]
After=nftables.service
Wants=nftables.service
EOF
$ doas systemctl daemon-reload
$ doas systemctl restart docker
```

## Related docs

- [Сеть ASUS B5402](../../systems/asus-b5402/networking/networkmanager-and-libvirt/)
  — текущее подтверждённое состояние и system-specific layout.
- [Docker 29: `iptables not found`](../docker-29-iptables-missing/) — отдельный
  симптом запуска Docker.
- [Минимальный nftables firewall](../../networking/nftables-firewall/) — простой
  desktop example без интеграции Docker и Libvirt.

## References

- [Gentoo Wiki: Nftables](https://wiki.gentoo.org/wiki/Nftables)
- [Gentoo News: nftables systemd service change](https://wwwtest.gentoo.org/support/news-items/2025-05-24-nftables-service.html)
- [Docker: Firewall with nftables](https://docs.docker.com/engine/network/firewall-nftables/)
- [ServerFault: Understanding nftables jumping](https://serverfault.com/questions/1126278/understanding-how-does-jumping-work-in-nftables)
- [dzx.fr: Nftables, Docker, and a default drop policy](https://dzx.fr/blog/nftables-docker-drop-policy/)
