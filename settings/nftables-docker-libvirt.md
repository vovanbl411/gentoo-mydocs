# Решение конфликта маршрутизации: Docker + Libvirt на Gentoo (nftables)

## Проблема

При совместной работе Docker (iptables-nft backend) и Libvirt (QEMU/KVM) на Gentoo Linux трафик из виртуальных машин не выходит наружу. Пакеты доходят до сетевого стека хоста, но `ip_forward` не срабатывает — VM "висят" в своей подсети.

### Root Cause

В nftables несколько таблиц могут подписываться на один hook. Docker и Libvirt оба цепляются на `forward` с priority `filter` (0):

- **Docker** создаёт `table ip filter` → `chain FORWARD` с `priority 0; policy drop;`
- **Libvirt** создаёт `table ip libvirt_network` → `chain forward` с `priority 0; policy accept;`

В nftables вердикт **DROP терминален**. Даже если Libvirt разрешил пакет, policy drop в таблице Docker (обработанный в той же точке hook'а) уничтожает пакет.

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

---

## Решение: отдельная таблица с приоритетом выше Docker

Вместо ковыряния `DOCKER-USER` (Docker пересоздаёт свои цепочки при рестарте) создаём **независимую таблицу** с **отрицательным приоритетом**.

В nftables меньшее число priority = раньше обработка. `priority -10` срабатывает **до** Docker (`priority 0`), принимая пакет раньше, чем тот его дропнет.

### Файл конфигурации

В Gentoo с systemd canonical путь для nftables конфига:

```
/etc/nftables/rules/main.nft
```

Это единственный файл, который загружает `nftables.service` при старте системы (проверяется через `ConditionPathExists=/etc/nftables/rules/main.nft`).

### Содержимое `/etc/nftables/rules/main.nft`

```nft
#!/usr/sbin/nft -f

flush ruleset

# === Основные правила (ваши существующие) ===
# table ip filter { ... }
# table ip nat { ... }

# === Фикс для Libvirt bridge ===
# priority -10 гарантирует выполнение ДО таблиц Docker (priority 0)
table ip gentoo_bridge_libvirt {
    chain bypass_docker {
        type filter hook forward priority -10; policy accept;

        # Libvirt default network
        ip saddr 192.168.122.0/24 accept
        ip daddr 192.168.122.0/24 accept

        # Кастомные сети (k8s, gitlab lab и т.д.)
        ip saddr 10.0.0.0/24 accept
        ip daddr 10.0.0.0/24 accept

        # Логирование для отладки (раскомментировать при необходимости)
        # counter log prefix "nft-bridge-drop: " drop
    }
}
```

### Почему это работает

| Таблица | Priority | Policy | Результат |
|---------|----------|--------|-----------|
| `gentoo_bridge_libvirt` | **-10** | `accept` | ✅ Пакет принят **до** Docker |
| `ip filter` (Docker) | 0 | `drop` | ❌ Не видит пакет — уже обработан |

> **Важно:** В nftables `accept` в одной цепочке не останавливает обработку полностью — пакет всё ещё проходит через другие цепочки на том же hook. Но поскольку наш `accept` срабатывает раньше (priority -10), Docker (priority 0) уже не может его дропнуть — пакет помечен как принятый.

---

## Применение (Gentoo + systemd)

### 1. Бэкап текущей конфигурации

```bash
$ doas mkdir -p /etc/nftables/rules
$ doas cp /etc/nftables/rules/main.nft /etc/nftables/rules/main.nft.backup.$(date +%Y%m%d) 2>/dev/null || true
$ doas nft list ruleset > ~/nftables-ruleset-backup.txt
```

### 2. Установка nftables (если ещё не установлен)

```bash
# Проверка профиля
$ eselect profile show | grep systemd
# Должно содержать: default/linux/amd64/23.0/systemd (или новее)

# Установка
$ doas emerge -av net-firewall/nftables
```

### 3. Создание конфигурации

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

### 4. Проверка синтаксиса и применение

```bash
# Проверка синтаксиса (dry-run)
$ doas /usr/sbin/nft -c -f /etc/nftables/rules/main.nft

# Применение правил
$ doas /usr/sbin/nft -f /etc/nftables/rules/main.nft

# Альтернатива — через systemd
$ doas systemctl restart nftables
```

### 5. Включение автозагрузки

```bash
# Проверяем, что юнит видит файл
$ doas systemctl status nftables
# Должно быть: ConditionPathExists=/etc/nftables/rules/main.nft met

# Включаем автозагрузку
$ doas systemctl enable --now nftables
```

### 6. Проверка загрузки правил

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

> **Примечание:** `nft` отображает `priority -10` как `priority filter - 10`. Это нормально — `filter` это базовый приоритет (0), `- 10` означает "минус 10 от базового".

### 7. Проверка порядка обработки hook'ов

```bash
$ doas nft list ruleset | grep "hook forward"
# Должно быть:
# type filter hook forward priority filter - 10; policy accept;  ← наш фикс
# type filter hook forward priority filter; policy drop;         ← Docker
```

---

## Верификация

### До фикса (ожидаемый результат)

```bash
# С хоста — VM пингуется
$ ping 10.0.0.80  # OK

# Из VM — наружу не выходит
$ ssh vladimir@10.0.0.80
$ ping -c 3 1.1.1.1
# ping: connect: Network is unreachable
# или 100% packet loss
```

### После фикса

```bash
# Из VM
$ ping -c 3 1.1.1.1        # OK
$ curl -I https://docker.io # HTTP/2 401 (это норма, значит доходит)
$ dig +short gentoo.org     # Возвращает IP

# Проверка счётчиков nftables
$ doas nft list chain ip gentoo_bridge_libvirt bypass_docker -a
# counter packets 1234 bytes 567890 ip saddr 10.0.0.0/24 accept # ← счётчик растёт
```

---

## Расширение конфигурации

### Добавление новых сетей

Если появляются новые подсети (например, для k8s):

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

### Разделение по файлам (для сложных конфигураций)

```
/etc/nftables/
└── rules/
    ├── main.nft          # Точка входа
    ├── base.nft          # Базовые правила
    └── libvirt.nft       # Фикс для Libvirt
```

**`main.nft`:**
```nft
#!/usr/sbin/nft -f

flush ruleset

include "/etc/nftables/rules/base.nft"
include "/etc/nftables/rules/libvirt.nft"
```

---

## Альтернативы (не рекомендуются)

| Способ | Почему плохо |
|--------|--------------|
| `iptables -I DOCKER-USER -i virbr+ -j ACCEPT` | Docker пересоздаёт цепочки при рестарте — правило слетит. К тому же в нативном nftables backend Docker (29.0+) `DOCKER-USER` **не существует** |
| `docker daemon --iptables=false` | Сломает port mapping для всех контейнеров |
| `echo 1 > /proc/sys/net/ipv4/ip_forward` | Уже включено, проблема не в нём |

---

## Environment

- **OS:** Gentoo Linux, profile `default/linux/amd64/23.0/systemd`
- **Kernel:** 6.x (Alder Lake, Clang/LLVM + ThinLTO)
- **Init:** systemd
- **Firewall:** nftables 1.1.x (net-firewall/nftables)
- **Docker:** 28.x (iptables-nft backend)
- **Libvirt:** 10.x (QEMU/KVM, default NAT network)
- **Privilege escalation:** doas

---

## Troubleshooting

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

Если установлен `firewalld` — он тоже лезет в nftables:

```bash
$ doas systemctl stop firewalld
$ doas systemctl disable firewalld
$ doas emerge -C firewalld
```

### Docker не стартует после изменений

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

---

## References

- [Gentoo Wiki: Nftables](https://wiki.gentoo.org/wiki/Nftables)
- [Gentoo News: nftables systemd service change](https://wwwtest.gentoo.org/support/news-items/2025-05-24-nftables-service.html)
- [Docker: Firewall with nftables](https://docs.docker.com/engine/network/firewall-nftables/)
- [ServerFault: Understanding nftables jumping](https://serverfault.com/questions/1126278/understanding-how-does-jumping-work-in-nftables)
- [dzx.fr: Nftables, Docker, and a default drop policy](https://dzx.fr/blog/nftables-docker-drop-policy/)

