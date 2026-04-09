# Настройка сети: NetworkManager + iwd

Для работы с беспроводными сетями используется связка NetworkManager (фронтенд) и iwd (беспроводной бэкенд). Это обеспечивает максимально быстрое сканирование сетей и надежное переподключение.

## 1. Подготовка

Убедитесь, что networkmanager собран с поддержкой iwd.

Файл: `/etc/portage/package.use/networkmanager`

```makefile
net-misc/networkmanager iwd -wpa_supplicant
```

## 2. Конфигурация NetworkManager

Необходимо явно указать NetworkManager использовать iwd в качестве бэкенда для Wi-Fi.

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

## 3. Управление сервисами

Отключаем лишнее и запускаем наш стек:

```bash
doas systemctl enable --now iwd
doas systemctl enable --now NetworkManager
```
