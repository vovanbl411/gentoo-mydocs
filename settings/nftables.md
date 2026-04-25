# Решение конфликта маршрутизации: Docker + Libvirt (nftables)

## Описание проблемы

При одновременном использовании Docker (через iptables-nft) и Libvirt (QEMU/KVM) на хосте с Gentoo Linux, сетевой трафик виртуальных машин блокируется. Пакеты доходят до сетевого стека хоста, но не пересылаются во внешнюю сеть, несмотря на включенный ip_forward.

### Причина (Root Cause)

В архитектуре nftables несколько таблиц могут подписываться на один и тот же хук (hook).
 1. Docker создает таблицу ip filter с цепочкой FORWARD, имеющей priority 0 и policy drop.
 2. Libvirt создает свои таблицы, которые разрешают (accept) трафик.
 3. В nftables вердикт DROP является окончательным и приоритетным. Даже если Libvirt разрешил пакет, "молчаливое" правило policy drop в таблице Docker уничтожает его на том же хуке.

## Архитектурное решение

Вместо изменения правил, которыми управляет демон Docker (что чревато их затиранием), мы создаем отдельную независимую таблицу gentoo_bridge_fix с отрицательным приоритетом.
В nftables цепочки с меньшим числовым значением приоритета обрабатываются раньше. Установив приоритет -10, мы перехватываем пакеты до того, как они попадут под фильтры Docker.

## Реализация (/etc/nftables.conf)

Добавьте следующий блок в конфигурацию вашего фаервола:

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

### Почему это работает:

 * Изоляция: Мы не трогаем цепочку DOCKER-USER, оставляя её полностью под управление Docker.
 * Приоритет: Наш accept срабатывает раньше, чем Docker увидит пакет.
 * Перманентность: В Gentoo nftables подхватывает этот конфиг при старте системы через OpenRC (rc-service nftables start).

## Верификация

После применения конфигурации проверьте наличие правил и прохождение пакетов:

 1. Просмотр правил:
  
```bash
   doas nft list table ip gentoo_bridge_fix
```   
   
 2. Тест связи из ВМ:

```bash
   ping -c 4 1.1.1.1
   curl -I https://google.com
```
   
 3. Проверка DNS:
  
```bash
   dig +short gentoo.org @8.8.8.8
```   
   
Заметки по системе:

 * Kernel: 6.x (Alder Lake optimized, Clang/LLVM + ThinLTO)
 * Firewall Backend: nftables 1.1.x
 * Infrastructure: Docker (MinIO State), Libvirt (k8s nodes)
