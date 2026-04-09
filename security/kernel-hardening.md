# Защита ядра Linux

Данный раздел описывает меры по усилению безопасности ядра Linux.

## Основные направления защиты

### 1.hardened gentoo-sources

Ядро собирается с дополнительными мерами защиты:
- PIE (Position Independent Executable)
- Stack Protector
- RELRO (Relocation Read-Only)

### 2. sysctl параметры

Настройка в `/etc/sysctl.d/99-security.conf`:

```conf
# Защита от спуфинга
net.ipv4.conf.all.rp_filter=1
net.ipv6.conf.all.accept_source_route=0

# Защита от ICMP redirect
net.ipv4.conf.all.accept_redirects=0
net.ipv6.conf.all.accept_redirects=0

# Защита от IP spoofing
net.ipv4.conf.all.send_redirects=0

# Игнорирование ping
net.ipv4.icmp_echo_ignore_all=0

# Защита памяти
kernel.dmesg_restrict=1
kernel.kptr_restrict=2
```

### 3. Module Silencing

Отключение загрузки неиспользуемых модулей и ограничение доступа к информации о модулях.

## Инструменты проверки

- `hardened-gentoo-hardened-check` — проверка статуса защиты
- `lynis` — аудит безопасности
- `aide` — обнаружение вторжений
