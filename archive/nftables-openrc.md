---
kind: troubleshooting
scope: general
status: historical
last_verified: null
verified_on: []
---

# Решение конфликта маршрутизации: Docker + Libvirt (nftables)

> **Архив:** документ относится к старому OpenRC setup. Для текущего systemd
> flow используй действующее руководство
> [`troubleshooting/docker-libvirt-nftables.md`](../src/content/docs/troubleshooting/docker-libvirt-nftables.md).
> Команды и конфигурация OpenRC ниже сохранены только как historical reference.

## 1. Historical context и применимость

Материал описывает прежнюю конфигурацию Gentoo с OpenRC, Docker через
iptables-nft и Libvirt QEMU/KVM. Он не конвертирован в systemd и не описывает
current setup.

## 2. Симптом

При одновременном использовании Docker через iptables-nft и Libvirt QEMU/KVM
на хосте с Gentoo Linux сетевой трафик виртуальных машин блокировался. Пакеты
доходили до сетевого стека хоста, но не пересылались во внешнюю сеть, несмотря
на включённый `ip_forward`.

## 3. Причина

В историческом описании nftables несколько таблиц могли подписываться на один
и тот же hook:

1. Docker создавал таблицу `ip filter` с цепочкой `FORWARD`, имевшей
   priority 0 и policy drop.
2. Libvirt создавал свои таблицы, которые разрешали (accept) трафик.
3. В nftables вердикт DROP считался окончательным и приоритетным. Даже если
   Libvirt разрешал пакет, «молчаливое» правило policy drop в таблице Docker
   уничтожало его на том же hook.

Эти утверждения сохранены как историческое описание root cause и во время
архивной миграции не проходили technical audit.

## 4. Историческое исправление

Вместо изменения правил, которыми управлял демон Docker и которые могли быть
перезаписаны, создавалась отдельная независимая таблица
`gentoo_bridge_fix` с отрицательным приоритетом. В nftables цепочки с меньшим
числовым значением приоритета обрабатывались раньше. Приоритет `-10` должен
был перехватить пакеты до фильтров Docker с priority 0.

## 5. Конфигурация OpenRC

Файл: `/etc/nftables.conf`

```conf
#!/usr/bin/nft -f

# Очистка старой таблицы перед загрузкой (опционально)
table ip gentoo_bridge_fix {
    chain bypass_docker {
        # priority -10 гарантирует выполнение ДО таблиц Docker (priority 0)
        type filter hook forward priority -10; policy accept;

        # Разрешаем трафик для подсетей k8s и Libvirt
        ip saddr 10.0.0.0/24 accept
        ip daddr 10.0.0.0/24 accept

        # Стандартная подсеть Libvirt (default network)
        ip saddr 192.168.122.0/24 accept
        ip daddr 192.168.122.0/24 accept

        # Логирование (опционально, для отладки)
        # counter packets 0 bytes 0
    }
}
```

Этот путь и ruleset относятся к historical OpenRC configuration. Они не
заменены на systemd layout.

### Почему это работало

1. **Изоляция:** цепочка `DOCKER-USER` оставалась полностью под управлением
   Docker.
2. **Приоритет:** accept срабатывал раньше, чем Docker видел пакет.
3. **Перманентность:** в Gentoo nftables подхватывал этот конфиг при старте
   системы через OpenRC (`rc-service nftables start`).

## 6. Верификация

После применения исторической конфигурации проверялись наличие правил и
прохождение пакетов.

### Просмотр правил

```bash
doas nft list table ip gentoo_bridge_fix
```

### Тест связи из ВМ

```bash
ping -c 4 1.1.1.1
curl -I https://google.com
```

### Проверка DNS

```bash
dig +short gentoo.org @8.8.8.8
```

Документ не фиксирует новые результаты этих проверок.

## 7. Historical environment

- Kernel: 6.x (Alder Lake optimized, Clang/LLVM + ThinLTO)
- Firewall Backend: nftables 1.1.x
- Infrastructure: Docker (MinIO State), Libvirt (k8s nodes)

Это environment прежнего OpenRC setup, а не current state системы.

## 8. Related/current docs

- [Docker, Libvirt и nftables](../src/content/docs/troubleshooting/docker-libvirt-nftables.md)
  — current systemd troubleshooting guide.
- [Файрвол: nftables](../src/content/docs/networking/nftables-firewall.md) — общее действующее
  руководство по nftables.
