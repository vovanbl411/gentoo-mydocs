# Gentoo Linux с systemd, niri, nftables и dbus-broker

## Обзор

Эта документация описывает настройку Gentoo Linux с использованием следующих компонентов:
- **systemd** — система инициализации и управления сервисами
- **niri** — Wayland compositor
- **nftables** — система фильтрации сетевых пакетов (заменяет iptables)
- **dbus-broker** — D-Bus message broker
- **iwd + NetworkManager** — управление сетевыми соединениями (вместо wpa_supplicant)

## Установка и настройка systemd

### Установка systemd

```bash
emerge --ask sys-apps/systemd
```

### Настройка USE-флагов

В файле `/etc/portage/make.conf` убедитесь, что присутствует:

```
USE="systemd"
```

### Включение systemd как PID 1

При установке Gentoo с systemd в качестве системы инициализации, убедитесь, что ядро загружается с параметром `init=/usr/lib/systemd/systemd`.

## Установка и настройка niri

### Установка niri

```bash
emerge --ask gui-wm/niri
```

### Настройка niri

Создайте файл конфигурации:

```bash
mkdir -p ~/.config/niri
```

Создайте файл `~/.config/niri/config.kdl`:

```
output "eDP-1" {
    scale 1.0
    position 0 0
    mode 1920x1080@60.000
}

input {
    xkb {
        layout "us,ru"
        variant ",winkeys"
        options "grp:alt_shift_toggle,grp_led:scroll"
    }
}

bindings {
    // Управление окнами
    "Mod+Return" run "alacritty"
    "Mod+Space" run "dmenu_run"
    "Mod+Shift+Q" close-window
    "Mod+Shift+E" run "systemctl --user start poweroff.target"

    // Управление рабочими пространствами
    "Mod+1" focus-workspace 0
    "Mod+2" focus-workspace 1
    "Mod+3" focus-workspace 2
    "Mod+Shift+1" move-window-to-workspace 0
    "Mod+Shift+2" move-window-to-workspace 1
    "Mod+Shift+3" move-window-to-workspace 2

    // Управление экранами
    "Mod+Left" focus-column-left
    "Mod+Right" focus-column-right
    "Mod+Down" focus-column-down
    "Mod+Up" focus-column-up
    "Mod+Shift+Left" move-column-left
    "Mod+Shift+Right" move-column-right
    "Mod+Shift+Down" move-column-down
    "Mod+Shift+Up" move-column-up
}
```

### Запуск niri

Чтобы запустить niri при входе в систему, создайте файл `~/.xinitrc`:

```bash
echo "exec niri" > ~/.xinitrc
```

Или настройте автозапуск через systemd:

```bash
systemctl --user enable niri
systemctl --user start niri
```

## Установка и настройка nftables

### Установка nftables

```bash
emerge --ask net-firewall/nftables
```

### Переключение с iptables на nftables

Для обеспечения совместимости с существующими скриптами и сервисами, настроим xtables для использования nftables в качестве backend:

```bash
eselect iptables list          # Проверим доступные варианты
eselect iptables set 2         # Выберем xtables-nft-multi
```

### Отключение iptables сервисов

```bash
systemctl stop iptables* ip6tables*
systemctl disable iptables* ip6tables*
systemctl mask iptables* ip6tables*    # Полная блокировка
```

### Настройка nftables.service

Создайте директорию для правил:

```bash
mkdir -p /etc/nftables/rules
```

Создайте основной файл правил `/etc/nftables/rules/main.nft`:

```nft
#!/usr/sbin/nft -f
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;
        ct state {established,related} accept
        iifname "lo" accept
        ip protocol icmp accept
        ct state invalid drop
        tcp dport {ssh, http, https} accept
        accept
    }
    chain forward { type filter hook forward priority 0; policy drop; }
    chain output { type filter hook output priority 0; policy accept; }
}
```

Загрузите правила:

```bash
nft -c -f /etc/nftables/rules/main.nft
systemctl restart nftables.service
```

### Настройка USE-флагов для совместимости

Создайте файл `/etc/portage/package.use/zzzz-iptables-off`:

```
app-containers/docker -iptables
app-emulation/libvirt -iptables
net-misc/networkmanager -iptables +nftables
sys-apps/iproute2 -iptables
sys-apps/systemd -iptables
net-firewall/nftables -xtables
```

Пересоберите пакеты:

```bash
emerge -1 app-containers/docker app-emulation/libvirt net-misc/networkmanager sys-apps/iproute2 sys-apps/systemd net-firewall/nftables
```

### Проверка работоспособности

```bash
systemctl status nftables iptables-*          # nftables: active, iptables: masked
nft list ruleset                              # Правила загружены
iptables -L                                   # Работает через nftables
```

## Установка и настройка dbus-broker

### Установка dbus-broker

```bash
emerge --ask sys-apps/dbus-broker
```

### Замена dbus на dbus-broker

```bash
emerge --deselect sys-apps/dbus
emerge --ask sys-apps/dbus-broker
```

### Включение dbus-broker

```bash
systemctl disable dbus
systemctl enable dbus-broker
systemctl restart dbus-broker
```

## Установка и настройка iwd + NetworkManager

### Установка iwd

```bash
emerge --ask net-wireless/iwd
```

### Установка NetworkManager

```bash
emerge --ask net-misc/networkmanager
```

### Настройка USE-флагов для NetworkManager

В файле `/etc/portage/package.use/zzzz-networkmanager` добавьте:

```
net-misc/networkmanager +nftables -wpa_supplicant +iwd
```

Пересоберите NetworkManager:

```bash
emerge -1 net-misc/networkmanager
```

### Включение iwd

```bash
systemctl enable iwd
systemctl start iwd
```

### Включение NetworkManager

```bash
systemctl enable NetworkManager
systemctl start NetworkManager
```

### Настройка NetworkManager для использования iwd

Создайте файл `/etc/NetworkManager/conf.d/wifi_backend.conf`:

```
[device]
wifi.backend=iwd
```

### Настройка D-Bus для NetworkManager

В файле `/etc/dbus-1/system.d/NetworkManager.conf` убедитесь, что разрешены права для группы wheel:

```xml
<policy group="wheel">
    <allow send_destination="org.freedesktop.NetworkManager"/>
    <allow send_interface="org.freedesktop.NetworkManager"/>
    <allow receive_sender="org.freedesktop.NetworkManager"/>
</policy>
```

## Настройка регулятора частоты (regulatory domain)

Для корректной работы Wi-Fi в диапазоне 5 ГГц необходимо установить регулятор частоты:

```bash
emerge --ask net-wireless/crda
```

В файле `/etc/iwd/main.conf` добавьте:

```
[General]
EnableNetworkConfiguration=true
NetworkConfigurationMethod=route
RegulatoryDomain=YOUR_COUNTRY
```

## Проверка конфигурации

### Проверка состояния сервисов

```bash
systemctl status systemd
systemctl status niri
systemctl status nftables
systemctl status dbus-broker
systemctl status iwd
systemctl status NetworkManager
```

### Проверка соединения сетью

```bash
nmcli device wifi list
nmcli device wifi connect "название_сети" password "пароль"
```

### Проверка работы nftables

```bash
nft list ruleset
```

### Проверка D-Bus

```bash
busctl list
```

## Устранение неполадок

### Проблемы с Wi-Fi

Если сеть 5 ГГц не видна:
1. Убедитесь, что в настройках роутера отключен TKIP
2. Проверьте, что регулятор частоты установлен правильно
3. Убедитесь, что NetworkManager использует iwd как бэкенд

### Проблемы с niri

Если niri не запускается:
1. Проверьте конфигурационный файл на синтаксические ошибки
2. Убедитесь, что ваша видеокарта поддерживается
3. Проверьте права доступа к /dev/dri/

### Проблемы с nftables

Если правила не применяются:
1. Проверьте синтаксис файла правил
2. Убедитесь, что nftables.service запущен
3. Проверьте, что iptables сервисы отключены и замаскированы

## Полезные команды

### Управление сервисами

```bash
systemctl status <service>    # Проверка статуса сервиса
systemctl start <service>     # Запуск сервиса
systemctl stop <service>      # Остановка сервиса
systemctl restart <service>   # Перезапуск сервиса
systemctl enable <service>    # Включение автозапуска
systemctl disable <service>   # Отключение автозапуска
```

### Управление сетью

```bash
nmcli device wifi list        # Просмотр доступных Wi-Fi сетей
nmcli device status           # Статус сетевых устройств
nmcli connection show         # Просмотр подключений
```

### Управление nftables

```bash
nft list ruleset             # Просмотр всех правил
nft add table inet filter    # Добавить таблицу
nft add chain inet filter input # Добавить цепочку
```

### Управление D-Bus

```bash
busctl list                  # Просмотр доступных сервисов
busctl call <service> ...    # Вызов метода сервиса
```
