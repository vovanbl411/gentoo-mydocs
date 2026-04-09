# Файрвол: nftables
nftables заменяет старый стек iptables, предлагая более простую логику правил и меньшую нагрузку на процессор.
### 1. Базовый конфиг (Stateful Firewall)
Мы настраиваем классический «десктопный» вариант: разрешаем всё исходящее, блокируем всё входящее, кроме уже установленных соединений.
Файл: /etc/nftables.conf
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Разрешить loopback (localhost)
        iif "lo" accept

        # Разрешить уже установленные соединения
        ct state established,related accept

        # Разрешить ICMP (пинг)
        ip protocol icmp accept
        ip6 nexthdr icmpv6 accept

        # Опционально: разрешить SSH (если нужно)
        # tcp dport 22 accept
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}

### 2. Применение
doas systemctl enable --now nftables
