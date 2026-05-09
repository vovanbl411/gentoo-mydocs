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

### /etc/nftables.conf

```nft
#!/usr/sbin/nft -f

flush ruleset

# === Основные правила (ваши существующие) ===
# table ip filter { ... }
# table ip nat { ... }

# === Фикс для Libvirt bridge ===
# priority -10 гарантирует выполнение ДО таблиц Docker (priority 0)
table ip gentoo_bridge_fix {
    chain forward {
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
| `gentoo_bridge_fix` | **-10** | `accept` | ✅ Пакет принят **до** Docker |
| `ip filter` (Docker) | 0 | `drop` | ❌ Не видит пакет — уже обработан |

> **Важно:** В nftables `accept` в одной цепочке не останавливает обработку полностью — пакет всё ещё проходит через другие цепочки на том же hook. Но поскольку наш `accept` срабатывает раньше (priority -10), Docker (priority 0) уже не может его дропнуть — пакет помечен как принятый.

---

## Применение (Gentoo + systemd)

### 1. Бэкап текущей конфигурации

```bash
$ doas cp /etc/nftables.conf /etc/nftables.conf.backup.$(date +%Y%m%d)
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

### 3. Настройка systemd services (актуально для nftables ≥1.1.1-r1)

Начиная с `net-firewall/nftables-1.1.1-r1` сервис разделён на два:
- `nftables-load.service` — загружает правила при старте
- `nftables-store.service` — сохраняет правила при выключении

```bash
# Создаём файл состояния (требуется для store-сервиса)
$ doas touch /var/lib/nftables/rules-save

# Включаем автозагрузку
$ doas systemctl enable --now nftables-load
$ doas systemctl enable --now nftables-store
```

### 4. Проверка и применение конфига

```bash
# Проверка синтаксиса (dry-run)
$ doas /usr/sbin/nft -c -f /etc/nftables.conf

# Применение правил без рестарта сервиса
$ doas /usr/sbin/nft -f /etc/nftables.conf

# Перезапуск сервиса (альтернатива)
$ doas systemctl restart nftables-load
```

### 5. Проверка загрузки правил

```bash
$ doas nft list table ip gentoo_bridge_fix
# Должно показать:
# table ip gentoo_bridge_fix {
#   chain forward {
#     type filter hook forward priority -10; policy accept;
#     ip saddr 192.168.122.0/24 accept
#     ip daddr 192.168.122.0/24 accept
#     ip saddr 10.0.0.0/24 accept
#     ip daddr 10.0.0.0/24 accept
#   }
# }
```

### 6. Проверка порядка обработки hook'ов

```bash
$ doas nft list ruleset | grep "hook forward"
# Должно быть:
# type filter hook forward priority -10; policy accept;  ← наш фикс
# type filter hook forward priority filter; policy drop;   ← Docker
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
$ doas nft list chain ip gentoo_bridge_fix forward -a
# counter packets 1234 bytes 567890 ip saddr 10.0.0.0/24 accept # ← счётчик растёт
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
- **Docker:** 28.x (iptables-nft backend, `DOCKER-USER` chain)
- **Libvirt:** 10.x (QEMU/KVM, default NAT network)
- **Privilege escalation:** doas

---

## Troubleshooting

### Правила не применились после рестарта

```bash
# Проверить статус юнитов
$ doas systemctl status nftables-load
$ doas systemctl status nftables-store

# Проверить, что юниты включены
$ doas systemctl is-enabled nftables-load
# Должно быть: enabled

# Если disabled — включить
$ doas systemctl enable --now nftables-load
```

### Правила применились, но трафик всё ещё блокируется

```bash
# Проверить, что таблица gentoo_bridge_fix реально перехватывает
$ doas nft list ruleset | grep -B2 -A5 "priority -10"
# Должно быть: type filter hook forward priority -10

# Если priority 0 — опечатка в конфиге, nftables проигнорировал -10
# или правила загружены не из /etc/nftables.conf

# Проверить, что Docker не перехватывает раньше
$ doas nft list ruleset | grep "hook forward"
# gentoo_bridge_fix: priority -10
# filter (Docker): priority 0
# libvirt_network: priority 0
```

### Конфликт с firewalld

Если установлен `firewalld` — он тоже лезет в nftables. На Gentoo с systemd это редкость, но если есть:

```bash
$ doas systemctl stop firewalld
$ doas systemctl disable firewalld
$ doas emerge -C firewalld
```

### Docker не стартует после изменений

```bash
# Проверить, что nftables-load загрузился до Docker
$ doas journalctl -u docker.service -b | grep -i nftables

# Если Docker стартовал раньше — добавить зависимость
$ doas mkdir -p /etc/systemd/system/docker.service.d/
$ doas tee /etc/systemd/system/docker.service.d/nftables-dependency.conf << 'EOF'
[Unit]
After=nftables-load.service
Wants=nftables-load.service
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

