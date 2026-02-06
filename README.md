# Конфигурация Gentoo с systemd, niri, xdg-portal-desktop, nftables, dbus-broker, iwd + NetworkManager, security, gentoo-kernel, doas 

## Содержание
- [Обзор](#обзор)
- [Установка и настройка systemd](#установка-и-настройка-systemd)
- [Установка и настройка niri](#установка-и-настройка-niri)
- [Настройка xdg-desktop-portal для niri](#настройка-xdg-desktop-portal-для-niri)
- [Установка и настройка nftables](#установка-и-настройка-nftables)
- [Установка и настройка dbus-broker](#установка-и-настройка-dbus-broker)
- [Установка и настройка iwd + NetworkManager](#установка-и-настройка-iwd--networkmanager)
- [Настройка регулятора частоты (regulatory domain)](#настройка-регулятора-частоты-regulatory-domain)
- [Проверка конфигурации](#проверка-конфигурации)
- [Устранение неполадок](#устранение-неполадок)
- [Полезные команды](#полезные-команды)
- [Безопасность в Gentoo Linux с niri](#безопасность-в-gentoo-linux-с-niri)
- [Kernel Hardening](#kernel-hardening)
- [Дополнительные оптимизации для конкретных процессоров](#дополнительные-оптимизации-для-конкретных-процессоров)
- [Настройка графики для Intel Iris Xe](#настройка-графики-для-intel-iris-xe)
- [Настройка Steam и multilib](#настройка-steam-и-multilib)
- [Управление питанием](#управление-питанием)
- [Обслуживание файловой системы Btrfs](#обслуживание-файловой-системы-btrfs)
- [Расширенные полезные команды](#расширенные-полезные-команды)

## Обзор

Эта документация описывает настройку современного Gentoo Linux с использованием следующих компонентов:
- **systemd** — система инициализации и управления сервисами
- **niri** — Wayland compositor (современная альтернатива X11)
- **xdg-desktop-portal** — система для предоставления доступа к портальным функциям (скринкастинг, выбор файлов и т.д.)
- **nftables** — система фильтрации сетевых пакетов (современная замена iptables)
- **dbus-broker** — D-Bus message broker (более производительная альтернатива dbus-daemon)
- **iwd + NetworkManager** — управление сетевыми соединениями (вместо устаревшего wpa_supplicant)
- **security** - комплексная безопасность системы (обновление системы, фаервол + nftables, ssh, мониторинг, kernel hardening)
- **gentoo-kernel** - современное официальное ядро Gentoo с автоматической сборкой
- **doas** - минималистичная альтернатива sudo с меньшей поверхностью атаки
- **Оптимизации** - настройка флагов компиляции под конкретные процессоры (включая LTO)
- **Графика** - конфигурация драйверов Intel Iris Xe для аппаратного ускорения
- **Steam** - настройка multilib и особенности работы в Wayland среде
- **Управление питанием** - оптимизация энергопотребления, особенно на ноутбуках
- **Файловая система** - обслуживание Btrfs, настройка TRIM, scrub и balance

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

Сначала необходимо разрешить установку niri, добавив соответствующую строку в файл:

FILE [/etc/portage/package.accept_keywords/niri](relative/file/path.ext:line)
```
gui-wm/niri ~amd64
```

Затем установите niri:

```bash
emerge --ask gui-wm/niri
```

### Настройка niri

Создайте файл конфигурации:

```bash
mkdir -p ~/.config/niri
```

### Запуск niri

Поскольку niri - это чистый Wayland-композитор, вы можете запустить niri напрямую из терминала или настроить автозапуск через systemd.

Для запуска niri в разных системах инициализации:

- **Для systemd**:
  ```bash
  niri-session
  ```

- **Для OpenRC**:
  ```bash
  dbus-run-session niri --session
  ```

Для автозапуска при входе в систему через TTY, добавьте в `~/.bash_profile`:

```bash
# В ~/.bash_profile
if [[ -z $DISPLAY && $(tty) == /dev/tty1 ]]; then
  exec niri
fi
```

Или настройте автозапуск через systemd:

```bash
systemctl --user enable niri
systemctl --user start niri
```

#### Дополнительные сервисы для полноценного рабочего стола (noctalia-shell)

Для полноценного рабочего стола с niri рекомендуется также настроить:

1. **Установка noctalia-shell**:
     ```bash
     eselect repository enable guru
     emerge --sync guru
     ```
     Добавьте в `/etc/portage/package.accept_keywords` (или папку):
     ```
     gui-apps/noctalia-shell ~amd64
     ```
     Установите:
     ```bash
     emerge gui-apps/noctalia-shell
     ```
     Прочитайте post-install сообщения — там указаны опции активации сервиса systemd (`systemctl --user enable --now noctalia`). [docs.noctalia](https://docs.noctalia.dev/getting-started/installation/)

  2. **Зависимости для noctalia-shell**:

     **Обязательные зависимости**:
     Все перечисленные пакеты критичны и подтверждены документацией noctalia:
     - `quickshell`: фреймворк оболочки.
     - `brightnessctl`: яркость ноутбучного экрана.
     - `imagemagick`: обработка обоев.
     - `python`: шаблоны.
     - `git`: обновления и плагины.

     Команда установки с guru (добавьте флаг `--ask` для подтверждения):
     ```
     emerge gui-apps/quickshell app-misc/brightnessctl media-gfx/imagemagick dev-lang/python dev-vcs/git
     ```
     Убедитесь, что quickshell из guru (git-версия для совместимости).

     **Аппаратные зависимости**:
     - `ddcutil`: только для внешних мониторов по DDC/CI. Рискует вызвать мерцание или выключение на некоторых моделях (например, старые Dell). Тестируйте осторожно:
     ```
     emerge app-misc/ddcutil
     ```
     Добавьте пользователя в группу `video` после установки: `gpasswd -a $USER video`. [docs.noctalia](https://docs.noctalia.dev/getting-started/installation/)

     **Рекомендуемые зависимости**:
     Устанавливайте по потребности, чтобы избежать ненужного мусора:
     ```
     emerge gui-apps/cliphist media-sound/cava gui-apps/wlsunset sys-apps/xdg-desktop-portal
     ```
     - `cliphist`: история клипборда (с wl-clipboard).
     - `cava`: визуализатор аудио.
     - `wlsunset`: ночной режим (альтернатива redshift).
     - `xdg-desktop-portal`: порталы для скриншотов/записи (нужен для PipeWire).
     - `evolution-data-server`: календарь (тяжёлый, используйте если нужен GNOME-календарь; альтернатива — khal/vdirsyncer).

     Команда с guru; пропустите EDS, если не используете (`gnome-extra/evolution-data-server`).

     **Возможные проблемы**:
     - **Конфликты**: imagemagick может тянуть X11-зависимости; используйте `media-gfx/imagemagick -X`.
     - **Запуск**: Добавьте в config Niri (`~/.config/niri/config.kdl`): `spawn-at-startup "noctalia-shell"`. Или через systemd. [tonybtw](https://www.tonybtw.com/tutorial/niri/)
     - **Обновления**: ~amd64 — testing, мониторьте `emerge --pretend --update noctalia-shell`.
     - **Тестирование**: После установки: `noctalia-shell qs -c ~/.config/quickshell/noctalia` (если config скопирован). [github](https://github.com/Ly-sec/Noctalia)

     Это создаст полноценный DE с баром, лаунчером и эффектами. Если ошибки — проверьте логи `journalctl --user -u noctalia`.

#### Настройка Display Manager

Niri поддерживает большинство Display Manager'ов.

Greetd. Ниже приведен пример конфигурации с использованием Tuigreet в качестве greeter:

FILE [/etc/greetd/config.toml](relative/file/path.ext:line)
```
[terminal]
vt = 1

[default_session]
command = "tuigreet --cmd /etc/greetd/niri.sh"
user = "greeter"
```

Скрипт "niri.sh" должен содержать следующее:
FILE [/etc/greetd/niri.sh](relative/file/path.ext:line)
```
#!/bin/bash

# For systemd:
niri-session

```

При необходимости вы можете установить дополнительные переменные окружения, в зависимости от вашей системы.


## Установка и настройка nftables

### Установка nftables

```bash
emerge --ask net-firewall/nftables
```

### Переключение с iptables на nftables

Если у вас есть старые скрипты, которые используют iptables напрямую, вы можете настроить xtables для использования nftables в качестве backend:

```bash
eselect iptables list          # Проверим доступные варианты
eselect iptables set 2         # Выберем xtables-nft-multi (опционально)
```

**Примечание**: Если ваш стек (Docker, NetworkManager) уже собран с нативной поддержкой nftables, этот шаг не требуется. Современные приложения работают с nftables напрямую.

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
        ip protocol icmp limit rate 5/second accept
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

#### Пользовательская сессия dbus-broker

Для корректной работы пользовательской сессии с niri убедитесь, что у вас установлен и активирован пользовательский экземпляр dbus-broker:

```bash
# Проверьте, что пакет установлен
emerge --ask sys-apps/dbus-broker

# Активируйте пользовательский сервис
systemctl --user enable dbus-broker
systemctl --user start dbus-broker

# Убедитесь, что переменная DBUS_SESSION_BUS_ADDRESS указывает на правильный сокет
echo $DBUS_SESSION_BUS_ADDRESS
```

В большинстве случаев systemd автоматически запускает пользовательский экземпляр dbus-broker при входе в систему, но в случае проблем с D-Bus в сеансах Wayland может потребоваться ручная настройка.

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

Для дополнительной безопасности в публичных сетях добавьте настройку рандомизации MAC-адреса в файл `/etc/NetworkManager/conf.d/wifi_backend.conf`:

```
[connection]
wifi.mac-address-randomization=2

[device]
wifi.backend=iwd
wifi.scan-rand-mac-address=yes
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

## Настройка xdg-desktop-portal для niri

### Проблема с xdg-desktop-portal-gnome

Для работы скринкастинга и выбора файлов в Wayland среде, рекомендуется использовать `xdg-desktop-portal-gnome` с niri. Однако, этот пакет имеет жесткую зависимость от `nautilus`, что может вызвать проблемы:

1. При попытке открыть диалог выбора файла в приложениях (например, Thunar), система может зависать
2. Приложение ожидает работу с `nautilus`, но используется другой файловый менеджер
3. Возникают конфликты между различными реализациями порталов

### Решение: использование xdg-desktop-portal-wlr с настройкой приоритетов

Вместо `xdg-desktop-portal-gnome` рекомендуется использовать комбинацию различных реализаций порталов, настроенных через файл конфигурации.

#### Установка необходимых пакетов

```bash
emerge --ask x11-misc/xdg-desktop-portal-wlr
emerge --ask x11-misc/xdg-desktop-portal-gtk
emerge --ask x11-misc/xdg-desktop-portal-gnome  # только если нужен скринкастинг окон
emerge --ask gui-libs/xdg-desktop-portal-shm   # для передачи буферов памяти для скриншотов
```

#### Дополнительные настройки для Thunar

Если вы используете файловый менеджер Thunar, убедитесь, что gvfs собран с поддержкой необходимых бэкендов, иначе портал FileChooser может вести себя нестабильно.

#### Настройка автозапуска в niri

Добавьте в файл `~/.config/niri/config.kdl` следующие строки в секцию основной конфигурации:

```
spawn-at-startup "dbus-update-activation-environment" "--systemd" "WAYLAND_DISPLAY" "XDG_CURRENT_DESKTOP=niri"
spawn-at-startup "systemctl" "--user" "start" "xdg-desktop-portal-wlr"
```

#### Создание файла настроек порталов

Создайте файл настроек для указания приоритетов различных реализаций порталов:

```bash
mkdir -p ~/.config/xdg-desktop-portal
```

Создайте файл `~/.config/xdg-desktop-portal/niri-portals.conf` со следующим содержимым:

```
[preferred]
default=wlr;gtk;
org.freedesktop.impl.portal.Screenshot=wlr;
org.freedesktop.impl.portal.ScreenCast=gnome;wlr;
org.freedesktop.impl.portal.FileChooser=gtk;
org.freedesktop.impl.portal.AppChooser=gtk;
```

#### Объяснение настроек

- `default=wlr;gtk;` — по умолчанию использовать wlr, затем gtk реализации
- `org.freedesktop.impl.portal.ScreenCast=gnome;wlr;` — для скринкастинга использовать gnome (для окон) и wlr (для экрана)
- `org.freedesktop.impl.portal.FileChooser=gtk;` — для выбора файлов использовать gtk (работает с Thunar и другими файловыми менеджерами)
- `org.freedesktop.impl.portal.AppChooser=gtk;` — для выбора приложений использовать gtk реализацию

#### Альтернативная настройка без gnome порталов

Если не нужна функция скринкастинга окон, можно использовать только wlr и gtk порталы:

```
[preferred]
default=wlr;gtk;
org.freedesktop.impl.portal.Screenshot=wlr;
org.freedesktop.impl.portal.ScreenCast=wlr;
org.freedesktop.impl.portal.FileChooser=gtk;
org.freedesktop.impl.portal.AppChooser=gtk;
```

#### Перезапуск служб после настройки

После создания конфигурации перезапустите пользовательские службы:

```bash
systemctl --user daemon-reload
systemctl --user restart xdg-desktop-portal-wlr
systemctl --user restart xdg-desktop-portal
```

### Устранение неполадок

Если приложения все еще зависают при выборе файлов:

1. Проверьте, что XDG_CURRENT_DESKTOP установлен правильно:
   ```bash
   echo $XDG_CURRENT_DESKTOP
   ```

2. Убедитесь, что службы порталов запущены:
   ```bash
   systemctl --user status xdg-desktop-portal*
   ```

3. Проверьте логи на наличие ошибок:
   ```bash
   journalctl --user -u xdg-desktop-portal* -f
   ```

4. Если используется Thunar или другой файловый менеджер, убедитесь, что он не конфликтует с nautilus:
   ```bash
   pkill nautilus
   ```

Эта настройка позволяет использовать niri с полноценной поддержкой порталов, избегая проблем с зависимостями от nautilus.

## Безопасность в Gentoo Linux с niri

### Обзор мер безопасности

Эта секция охватывает практические меры безопасности для системы Gentoo Linux с Wayland compositor niri, фаерволом nftables и другими компонентами, описанными в этой документации. Каждый раздел включает четкие объяснения, примеры и преимущества, которые вы получите, внедряя эти меры.

### Содержание
- [Системные обновления](#системные-обновления)
- [Управление пользователями и doas](#управление-пользователями-и-doas)
- [Конфигурация фаервола с помощью nftables](#конфигурация-фаервола-с-помощью-nftables)
- [Безопасность SSH](#безопасность-ssh)
- [Мониторинг системы](#мониторинг-системы)
- [Меры безопасности для конкретного ноутбука](#меры-безопасности-для-конкретного-ноутбука)
- [Безопасность Intel Management Engine (ME)](#безопасность-intel-management-engine-me)
- [Kernel Hardening](#kernel-hardening)

### Системные обновления

#### Почему это важно
Регулярные системные обновления исправляют известные уязвимости в программных пакетах и компонентах ядра, предотвращая эксплуатацию этих дыр злоумышленниками. Устаревшие системы становятся первоочередной целью для автоматических атак, сканирующих известные уязвимости.

#### Как реализовать
1. **Ручные обновления**: Запускайте `emerge --sync && emerge -uDNav @world` регулярно (рекомендуется еженедельно или ежедневно)
   ```bash
   # Обновить дерево портежей и обновить все пакеты
   emerge --sync
   emerge -uDNav @world
   
   # Очистить неиспользуемые зависимости (необязательно, но рекомендуется)
   emerge --depclean
   ```

2. **Автоматическая очистка**: Используйте встроенные механизмы Portage для очистки старых пакетов
   ```bash
   # Установить gentoolkit для дополнительных утилит обслуживания
   emerge --ask app-portage/gentoolkit
   
   # Очистить старые версии пакетов
   eclean-dist -d
   ```

3. **Интеграция с системой резервного копирования**: Перед крупными обновлениями создавайте снимки, если используете соответствующую файловую систему
   ```bash
   # Если используете Btrfs, создайте снимок перед обновлениями
   # btrfs subvolume snapshot / /.snapshots/pre-update-$(date +%Y%m%d)
   
   # Теперь запустите обновление
   emerge --sync && emerge -uDNav @world
   ```

#### Преимущества
- **Защита от известных эксплойтов**: Патчи закрывают дыры безопасности, которыми могут воспользоваться злоумышленники
- **Автоматическое обслуживание**: Скрипты обслуживания выполняют задачи без ручного вмешательства
- **Возможность отката**: Снимки файловой системы позволяют быстро восстановить систему, если обновления вызывают проблемы
- **Спокойствие**: Регулярные обновления значительно снижают уровень угроз для вашей системы

### Управление пользователями и doas

#### Почему это важно
Следование принципу минимальных привилегий предотвращает предоставление злоумышленнику полного контроля над системой при компрометации учетной записи пользователя. Разделение обычных пользовательских учетных записей от административных привилегий ограничивает ущерб от вредоносных программ или несанкционированного доступа.

#### Как реализовать
1. **Создание стандартной учетной записи пользователя**: Создайте учетную запись пользователя для повседневного использования вместо root
   ```bash
   # Замените 'yourusername' вашим предпочтительным именем пользователя
   useradd -m -G wheel,video,input,audio yourusername
   passwd yourusername
   ```

2. **Настройка доступа через doas**: Позвольте пользователю безопасно выполнять административные задачи
   ```bash
   # Установить doas если еще не установлен (альтернатива sudo с меньшей поверхностью атаки)
   emerge --ask app-admin/doas
   
   # Создать файл конфигурации
   touch /etc/doas.conf
   
   # Добавить разрешение для группы wheel (аналог sudo %wheel)
   echo 'permit :wheel' >> /etc/doas.conf
   
   # Установить безопасные права доступа
   chmod 600 /etc/doas.conf
   chown root:root /etc/doas.conf
   ```

3. **Отключение входа root**: Предотвратите прямой вход root для дополнительной безопасности
   ```bash
   # Заблокировать пароль учетной записи root
   passwd -l root
   
   # Необязательно: Полностью отключить SSH-вход root
   # В /etc/ssh/sshd_config: PermitRootLogin no
   ```

4. **Добавление пользователя в группы оборудования**: Для аппаратного ускорения на вашем ноутбуке
   ```bash
   # Добавить пользователя в группы video, input и audio для правильного доступа к оборудованию
   usermod -a -G video,input,audio yourusername
   ```

#### Преимущества
- **Сокращенная поверхность атаки**: Doas имеет более простую кодовую базу по сравнению с sudo, что снижает вероятность уязвимостей
- **Журнал аудита**: Все административные действия регистрируются при выполнении через doas
- **Совместимость оборудования**: Правильные членства в группах обеспечивают корректную работу оборудования с Niri
- **Соответствие философии минимализма**: Doas соответствует философии минимализма, характерной для современных установок

### Конфигурация фаервола с помощью nftables

#### Почему это важно
Правильно настроенный фаервол действует как первый рубеж обороны против сетевых атак. Он контролирует, какие соединения разрешены к и от вашего ноутбука, защищая от попыток несанкционированного доступа и снижая уровень угроз.

#### Как реализовать
1. **Установка nftables**: Убедитесь, что nftables установлен и доступен (уже выполнено в предыдущих разделах)
   ```bash
   # Установить nftables, если еще не установлен
   emerge --ask net-firewall/nftables
   ```

2. **Создание базовых правил фаервола**: Настройте фундаментальные правила безопасности
   ```bash
   # Создать базовую таблицу и цепочки
   nft add table inet filter
   nft add chain inet filter input { type filter hook input priority 0 \; policy drop \; }
   nft add chain inet filter forward { type filter hook forward priority 0 \; policy drop \; }
   nft add chain inet filter output { type filter hook output priority 0 \; policy accept \; }
   ```

3. **Разрешение важных соединений**: Настройте правила для необходимого трафика
   ```bash
   # Разрешить loopback-трафик (необходим для функциональности системы)
   nft add rule inet filter input iif lo accept
   
   # Разрешить установленные и связанные соединения (ответы на исходящий трафик)
   nft add rule inet filter input ct state established,related accept
   
   # Разрешить определенные службы (настраивать по необходимости)
   nft add rule inet filter input tcp dport 22 ct state new accept  # SSH (если включен)
   nft add rule inet filter input ip protocol icmp accept          # ICMP ping
   nft add rule inet filter input ip6 nexthdr icmpv6 accept        # IPv6 ICMP
   ```

4. **Сохранение и включение службы**: Сделать правила постоянными между перезагрузками
   ```bash
   # Сохранить текущие правила в конфигурационный файл
   nft list ruleset > /etc/nftables.conf
   
   # Включить службу nftables для загрузки правил при запуске
   systemctl enable --now nftables
   ```

5. **Рассмотрение мобильного устройства**: Для использования ноутбука учитывайте интеграцию VPN
   ```bash
   # Добавить правила для портов WireGuard VPN (обычно 51820/udp)
   nft add rule inet filter input udp dport 51820 accept
   ```

#### Преимущества
- **Предотвращение сетевых атак**: Блокирует попытки несанкционированного доступа из интернета
- **Гранулярный контроль**: Позволяет точно настраивать сетевой трафик
- **Производительность**: nftables более эффективен, чем устаревший iptables
- **Безопасность ноутбука**: Критично для мобильных устройств, подключающихся к различным сетям

### Безопасность SSH

#### Почему это важно
SSH обеспечивает безопасный удаленный доступ, но может стать значительным риском безопасности, если не защищен должным образом. Злоумышленники часто сканируют открытые порты SSH и пытаются получить доступ к учетным данным методом подбора или словарных атак.

#### Как реализовать
1. **Безопасная конфигурация SSH**: Изменить настройки демона SSH
   ```bash
   # Создать резервную копию оригинальной конфигурации
   cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
   
   # Отредактировать конфигурацию SSH
   nano /etc/ssh/sshd_config
   ```
   
   В `/etc/ssh/sshd_config`, установите следующие параметры безопасности:
   ```
   # Полностью отключить вход root
   PermitRootLogin no
   
   # Отключить аутентификацию по паролю (использовать только ключи)
   PasswordAuthentication no
   PubkeyAuthentication yes
   
   # Ограничить количество попыток подключения
   MaxAuthTries 3
   
   # Установить таймаут простоя
   ClientAliveInterval 300
   ClientAliveCountMax 2
   
   # Ограничить пользователей для входа (необязательно)
   AllowUsers yourusername
   ```

2. **Генерация SSH-ключей**: Создать надежные пары ключей для аутентификации
   ```bash
   # На клиентской машине сгенерировать надежную пару ключей
   ssh-keygen -t ed25519 -C "your_email@example.com"
   
   # Скопировать открытый ключ на вашу систему Gentoo Linux
   ssh-copy-id yourusername@your-laptop-ip
   ```

3. **Установка и настройка Fail2Ban**: Добавить предотвращение вторжений
   ```bash
   # Установить fail2ban
   emerge --ask app-admin/fail2ban
   
   # Создать локальную конфигурацию
   cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
   nano /etc/fail2ban/jail.local
   ```
   
   В `/etc/fail2ban/jail.local`, настроить раздел SSH:
   ```
   [sshd]
   enabled = true
   port = 22
   filter = sshd
   logpath = /var/log/auth.log
   maxretry = 3
   bantime = 3600
   findtime = 600
   ```

4. **Интеграция с nftables**: Убедиться, что fail2ban использует nftables
   ```bash
   # Проверить, доступен ли бэкенд nftables
   fail2ban-client -i
   
   # Протестировать fail2ban
   systemctl enable --now fail2ban
   ```

#### Преимущества
- **Защита от подбора**: fail2ban блокирует повторные неудачные попытки входа
- **Безопасность на основе ключей**: Исключает риски слабых паролей
- **Контроль доступа**: Точный контроль над тем, кто может подключаться
- **Обнаружение вторжений**: Автоматическое блокирование подозрительной активности

### Мониторинг системы

#### Почему это важно
Непрерывный мониторинг обнаруживает несанкционированные изменения, инциденты безопасности и системные аномалии, которые могут указывать на компрометацию. Раннее обнаружение критически важно для минимизации ущерба от нарушений безопасности.

#### Как реализовать
1. **Установка AIDE (Advanced Intrusion Detection Environment)**: Настроить мониторинг целостности файлов
   ```bash
   # Установить AIDE
   emerge --ask app-admin/aide
   
   # Инициализировать базу данных эталонов
   aide --init
   
   # Переместить новую базу данных в правильное местоположение
   mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db
   ```

2. **Настройка AIDE**: Настроить правила мониторинга
   ```bash
   # Конфигурация AIDE находится в /etc/aide/aide.conf
   # Стандартные настройки обычно достаточны для базового мониторинга
   # Можно настроить, какие файлы и каталоги мониторить
   
   # Пример: Добавить пользовательский мониторинг важных каталогов
   echo "/etc p+i+n+u+g+s+m+b+acl+selinux+xattrs+sha256" >> /etc/aide/aide.conf
   echo "/home p+i+n+u+g+s+m+b+acl+selinux+xattrs+sha256" >> /etc/aide/aide.conf
   ```

3. **Планирование регулярных проверок**: Автоматизировать проверку целостности
   ```bash
   # Добавить задание cron для еженедельных проверок AIDE
   crontab -e
   
   # Добавить эту строку для еженедельных проверок:
   # 0 2 * * 0 /usr/bin/aide --check
   ```

4. **Установка и настройка Syslog**: Настроить комплексное логирование
   ```bash
   # Установить rsyslog для расширенного логирования (уже установлен в системе)
   emerge --ask app-admin/rsyslog
   
   # Включить службу rsyslog
   systemctl enable --now rsyslog
   
   # Настроить ротацию логов для предотвращения проблем с местом на диске
   nano /etc/logrotate.d/rsyslog
   ```
   
   Создать `/etc/logrotate.d/rsyslog` с:
   ```
   /var/log/messages
   /var/log/secure
   /var/log/maillog
   /var/log/spooler
   /var/log/boot.log
   {
       rotate 4
       weekly
       missingok
       notifempty
       compress
       delaycompress
       sharedscripts
       postrotate
           /bin/kill -HUP `cat /var/run/syslogd.pid 2>/dev/null` 2>/dev/null || true
       endscript
   }
   ```

5. **Регулярный мониторинг журналов**: Проверять события безопасности
   ```bash
   # Проверить сообщения об ошибках с последней загрузки
   journalctl -p err -b
   
   # Мониторить журналы аутентификации
   journalctl -u systemd-logind
   
   # Проверить неудачные попытки входа
   grep -i "failed" /var/log/auth.log
   ```

#### Преимущества
- **Обнаружение изменений**: Определяет несанкционированные изменения критических файлов
- **Реагирование на инциденты**: Предоставляет доказательства для анализа
- **Соответствие требованиям**: Помогает соответствовать стандартам безопасности, требующим мониторинга
- **Профилактическая безопасность**: Обнаруживает проблемы до того, как они станут серьезными

### Меры безопасности для конкретного ноутбука

#### Почему это важно
Ноутбуки сталкиваются с уникальными проблемами безопасности из-за своей мобильности, частых изменений сетей и рисков физического воздействия. Необходимы специальные соображения для безопасности оборудования, физического доступа и динамических сетевых сред.

#### Как реализовать
1. **Преимущества безопасности Wayland/Niri**: Использовать встроенные функции безопасности
   ```bash
   # Убедиться, что Pipewire правильно настроен для изоляции звука
   emerge --ask media-video/pipewire media-plugins/pipewire-alsa media-plugins/pipewire-pulse media-plugins/pipewire-jack
   
   # Проверить, что Niri работает с правильными разрешениями
   # Niri работает от вашего имени (не от root), обеспечивая лучшую изоляцию, чем X11
   echo $WAYLAND_DISPLAY  # Должно показывать вашу сессию Wayland
   ```

2. **Безопасность BIOS/UEFI**: Включить защиту на уровне оборудования
   ```bash
   # Установить sbctl для управления безопасной загрузкой
   emerge --ask sys-boot/secureboot-uefi-bin sys-boot/efibootmgr
   
   # Для Gentoo также можно использовать:
   # sys-boot/edk2-ovmf для OVMF (UEFI firmware для QEMU)
   ```

3. **Защита паролем GRUB**: Защитить загрузчик
   ```bash
   # Сгенерировать зашифрованный пароль для GRUB
   grub-mkpasswd-pbkdf2
   
   # Добавить конфигурацию суперпользователей в GRUB
   nano /etc/grub.d/40_custom
   ```
   
   Добавить в `/etc/grub.d/40_custom`:
   ```
   set superusers="yourusername"
   password_pbkdf2 yourusername [encrypted_password_from_above]
   ```
   
   Затем обновить GRUB:
   ```bash
   # Обновить конфигурацию GRUB
   grub-mkconfig -o /boot/grub/grub.cfg
   ```

4. **Меры физической безопасности**: Защита от локальных атак
   ```bash
   # Убедиться, что шифрование диска правильно настроено (если используется)
   # Для шифрования LUKS во время установки:
   # emerge --ask sys-fs/cryptsetup
   # cryptsetup luksFormat /dev/sda2
   # cryptsetup luksOpen /dev/sda2 cryptroot
   ```

5. **Безопасность сети для мобильного использования**: Адаптировать безопасность к изменяющимся сетям
   ```bash
   # Создать сетевые корректировки фаервола
   # Для публичных сетей ограничить более строго
   # Для доверенных сетей разрешить больше служб
   
   # Пример: Скрипт для настройки фаервола в зависимости от сети
   #!/bin/bash
   # if nmcli -t -f name,device connection show --active | grep -q "PublicNetwork"
   # then
   #   # Применить более строгие правила для публичных сетей
   #   nft add rule inet filter input tcp dport 22 counter drop
   # else
   #   # Применить стандартные правила для частных сетей
   #   nft add rule inet filter input tcp dport 22 ct state new accept
   # fi
   ```

#### Преимущества
- **Безопасность на уровне оборудования**: Безопасная загрузка защищает от низкоуровневых руткитов
- **Защита загрузки**: Защита GRUB паролем предотвращает несанкционированные изменения загрузки
- **Мобильная безопасность**: Адаптируется к различным уровням угроз в разных средах
- **Физическая защита**: Защищает от атак локального доступа

### Безопасность Intel Management Engine (ME)

#### Почему это важно
Intel Management Engine (ME) - это встроенный микроконтроллер в процессорах Intel, который работает независимо от основной операционной системы. ME имеет прямой доступ к памяти, сетевым интерфейсам и другим компонентам системы, что создает потенциальные риски безопасности, особенно на ноутбуках, где физический доступ может быть ограничен.

#### Возможные риски
1. **Неустранимый компонент**: ME работает даже когда компьютер выключен (в режиме S5), потребляя питание и оставаясь активным
2. **Доступ к системе**: ME имеет прямой доступ к оперативной памяти и другим компонентам, обходя основную операционную систему
3. **Уязвимости**: Исторически ME имел уязвимости, которые теоретически могли позволить удаленный доступ к системе
4. **Скрытая функциональность**: Некоторые функции ME могут быть не полностью документированы

#### Стратегии смягчения рисков
1. **Обновление прошивки**: Регулярно обновляйте BIOS/UEFI для получения последних исправлений безопасности ME
   ```bash
   # Проверить версию прошивки
   dmidecode -t bios
   
   # Обновление через BIOS или инструменты производителя
   # Используйте официальные обновления с сайта производителя
   ```

2. **Отключение ME (если возможно)**: Некоторые ноутбуки позволяют отключить ME через BIOS
   - В BIOS/UEFI настройках ищите опции, связанные с "Intel AMT", "Intel ME", "Intel CSME"
   - Отключите "Intel Active Management Technology" и связанные функции
   - Обратите внимание, что это может повлиять на некоторые функции ноутбука

3. **Использование инструментов для изменения ME**: Для опытных пользователей
    ```bash
    # ME Cleaner - инструмент для отключения ME (используйте с осторожностью!)
    # https://github.com/corna/me_cleaner
    # pip install me_cleaner
    # me_cleaner -S /path/to/bios.rom
    # ВНИМАНИЕ: Изменение прошивки может сделать систему неработоспособной!
    ```

    **ВАЖНО**: На многих современных процессорах Intel (начиная с 12-го поколения) агрессивная очистка ME может привести к тому, что система будет выключаться через 30 минут или вообще не пройдет POST. Будьте особенно осторожны при работе с ME на новых системах.

    **Альтернатива**: Вместо me_cleaner стоит рассмотреть установку HAP-бита (High Assurance Platform), что является более безопасным программным способом «усыпления» ME.

4. **Мониторинг активности**: Наблюдение за сетевой активностью и другими признаками активности ME
   ```bash
   # Мониторинг сетевой активности
   netstat -tuln
   
   # Проверка процессов, использующих сеть
   lsof -i
   ```

#### Преимущества принятия мер
- **Снижение поверхности атаки**: Уменьшение потенциальных векторов атак
- **Повышенная конфиденциальность**: Ограничение фоновой активности
- **Контроль над системой**: Больше контроля над компонентами системы

### Kernel Hardening

Для дополнительной защиты системы рекомендуется использовать hardened-ядро или параметры жесткой изоляции (LSM).

#### Использование hardened-ядра

1. **Установка современного ядра**:
     ```bash
     # Установить официальное ядро с поддержкой автоматической сборки
     emerge --ask sys-kernel/gentoo-kernel
     
     # Для hardening-настроек в Gentoo теперь используются USE-флаги
     # или переопределение конфига через /etc/kernel/config.d/
     ```

2. **Усиление (Hardening)**:
     Создайте файл `/etc/kernel/config.d/hardened.config`:
     ```bash
     # Защита от переполнения кучи и стека
     CONFIG_FORTIFY_SOURCE=y
     CONFIG_GCC_PLUGIN_STACKLEAK=y
     # Ограничение доступа к dmesg
     CONFIG_SECURITY_DMESG_RESTRICT=y
     # Включение LSM (Landlock, AppArmor и др.)
     CONFIG_LSM="landlock,lockdown,yama,loadpin,safesetid,selinux,bpf"
     ```

3. **Активация LSM-политик**:
     В файле `/etc/default/grub` добавьте параметры ядра:
     ```
     GRUB_CMDLINE_LINUX_DEFAULT="... lsm=landlock,lockdown,yama,apparmor,bpf"
     ```
     
     Затем обновите конфигурацию GRUB:
     ```bash
     grub-mkconfig -o /boot/grub/grub.cfg
     ```

4. **Обновление**:
     После изменения конфига просто пересоберите ядро: `emerge --ask sys-kernel/gentoo-kernel`.

#### Альтернативные параметры безопасности ядра

Вы можете также добавить следующие параметры в GRUB для дополнительной защиты:

```
GRUB_CMDLINE_LINUX_DEFAULT="... slab_merge=1 slub_debug=FZPU smep smap spec_store_bypass_disable=on spectre_v2=on randomize_kstack_offset=on vsyscall=none pti=on kpti=on"
```

Эти параметры обеспечивают:
- SMEP/SMAP: Защита от выполнения пользовательского кода в ядре
- PTI: Защита от атак типа Spectre/Meltdown
- SLUB_DEBUG: Обнаружение повреждений кучи
- Randomize kernel stack offset: Защита от ROP-атак

### Тестирование вашей безопасности

После реализации этих мер:
1. Проверить, что все службы работают: `systemctl status`
2. Проверить правила фаервола: `nft list ruleset`
3. Запустить проверку AIDE: `aide --check`
4. Проверить конфигурацию SSH: `sshd -t`
5. Проверить настройки doas: `doas -C /etc/doas.conf`

Этот комплексный подход гарантирует, что ваша система Gentoo с niri остается защищенной от обычных и сложных угроз, при этом сохраняя оптимальную производительность и удобность использования.

## Дополнительные оптимизации для конкретных процессоров

Для архитектур с гибридными ядрами (как Intel Alder Lake с P+E ядрами) или для ускорения работы системы можно использовать агрессивные флаги оптимизации, включая LTO (Link Time Optimization).

### Оптимизация в /etc/portage/make.conf

Ключевые моменты при настройке:
 * Использование конкретного архитектурного флага (например, `-march=alderlake` для процессоров Alder Lake)
 * Применение максимальной оптимизации (`-O3`) и LTO (`-flto=16`)
 * Локальное управление ABI_X86 (глобально отключен, управляется локально для конкретных пакетов, например, Steam)

Пример настройки COMMON_FLAGS в `/etc/portage/make.conf`:
```
COMMON_FLAGS="-march=native -O3 -flto=16 -pipe -mabm -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk --param=l1-cache-line-size=64 --param=l1-cache-size=32 --param=l2-cache-size=18432"
CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"
FCFLAGS="${COMMON_FLAGS}"
FFLAGS="${COMMON_FLAGS}"

# Ограничение нагрузки при линковке (LTO может потреблять много памяти)
MAKEOPTS="-j$(nproc) -l$(($(nproc)-4))"
RUSTFLAGS="-C target-cpu=native -C opt-level=3"

# CPU Flags (сгенерировано cpuid2cpuflags)
CPU_FLAGS_X86="aes avx avx2 avx_vnni bmi1 bmi2 f16c fma3 mmx mmxext pclmul popcnt rdrand sha sse sse2 sse3 sse4_1 sse4_2 ssse3 vpclmulqdq"

# Графика и Ввод
VIDEO_CARDS="intel iris i915"
INPUT_DEVICES="libinput"

# USE-флаги (Wayland-native, без лишнего функционала)
USE="bluetooth btrfs dbus dist-kernel gles2 gstreamer libnotify vaapi \
     networkmanager nftables pipewire policykit screencast systemd persist \
     wayland hwdata alsa vulkan v4l libinput udisks2 thunderbolt zstd wifi \
     brightness acpi pgo seatd X -elogind -consolekit"
     
# Язык и Зеркала
LC_MESSAGES=C.UTF-8
GENTOO_MIRRORS="mirrors"
```

### Обработка исключений LTO

Если какой-либо пакет не собирается с LTO, используйте `/etc/portage/package.env`:
 * Создайте `/etc/portage/env/no-lto.conf`: CFLAGS="${CFLAGS} -fno-lto"
 * Пропишите пакет в `/etc/portage/package.env`: category/package no-lto.conf

## Настройка графики для Intel Iris Xe

Для аппаратного ускорения видео (VA-API) и корректной работы GPU 12-го поколения Intel и новее.

### Драйверы и Firmware

 * Установите пакет: `media-libs/libva-intel-media-driver` (iHD) для современного драйвера VA-API
 * В ядре (GRUB): Включите GuC/HuC для управления питанием видеоядра.
   В `/etc/default/grub` добавьте к `GRUB_CMDLINE_LINUX_DEFAULT`:
   ```
   i915.enable_guc=3
   ```
 * Можете установите переменную окружения: `LIBVA_DRIVER_NAME=iHD` (можно добавить в `/etc/env.d/99local):
   ```
   LIBVA_DRIVER_NAME=iHD
   ```

### Рекомендуемая настройка VIDEO_CARDS

Для Intel Iris в Gentoo настройка VIDEO_CARDS в /etc/portage/make.conf зависит от поколения GPU, но обычно требует комбинации драйверов для полной поддержки.

Добавьте в make.conf строку:
```
VIDEO_CARDS="intel i915 iris"
```
- `intel` — базовая поддержка Intel в libdrm/Mesa.
- `i915` — kernel-драйвер (KMS) для большинства Intel GPU (с Haswell и новее Iris использует i915).
- `iris` — Gallium3D-драйвер в Mesa для Gen8+ (Broadwell+).

### Альтернатива через package.use

Если хотите избежать глобального VIDEO_CARDS (чтобы не тянуть лишние зависимости), используйте /etc/portage/package.use/video:
```
x11-libs/libdrm video_cards_intel
media-libs/mesa video_cards_intel iris
```
Это активирует нужное локально без make.conf.

### Проверка и обновление

После изменений выполните `emerge -uDN @world`, проверьте `emerge --info | grep VIDEO_CARDS` и `glxinfo | grep "OpenGL renderer"`.

## Настройка Steam и multilib

Рекомендуется использовать стратегию "Чистый 64-bit с локальным 32-bit".
 * В make.conf НЕ прописывайте ABI_X86="64 32" глобально.
 * Все 32-битные библиотеки прописывайте только для нужных пакетов в `/etc/portage/package.use/steam`.
 * Обратите внимание на возможные опечатки в конфигах.

## Управление питанием

Для оптимизации энергопотребления, особенно на ноутбуках с современными процессорами.

* Убедитесь, что используете драйвер: `intel_pstate` в режиме `active` (для Intel процессоров)
* Установите утилиту: `sys-power/power-profiles-daemon` для управления профилями питания
* Команды для переключения профилей:
  * Для экономии батареи: `powerprofilesctl set power-saver`
  * Для сбалансированного режима: `powerprofilesctl set balanced`
  * Для производительности: `powerprofilesctl set performance`
* Установите `sys-power/thermald` для защиты от троттлинга и перегрева

## Обслуживание файловой системы Btrfs

Для автоматизации поддержания здоровья файловой системы, особенно на SSD.

* Включите TRIM через системный таймер: `systemctl enable --now fstrim.timer`
* Используйте `sys-fs/btrfsmaintenance` для операций scrub и balance:
  * Установите пакет: `emerge --ask sys-fs/btrfsmaintenance`
  * Настройте конфиг в `/etc/default/btrfsmaintenance`:
    ```
    BTRFS_SCRUB_PERIOD="monthly"
    BTRFS_BALANCE_PERIOD="monthly"
    BTRFS_TRIM_PERIOD="none"  # так как fstrim.timer уже обрабатывает TRIM
    ```

### Оптимальные настройки для NVMe в fstab

Оптимальные настройки для NVMe в /etc/fstab учитывают производительность SSD, снижение износа и совместимость с TRIM.

#### Для Btrfs (рекомендуется с NVMe)
```
UUID=your-uuid-here / btrfs defaults,noatime,compress=zstd:1,discard=async 0 0
```
- `compress=zstd:1` — сжатие на лету (экономит место, ускоряет чтение).
- `discard=async` — асинхронный TRIM при удалении файлов (безопаснее continuous discard).
- `0 0` — Btrfs не требует fsck по умолчанию.

#### Дополнительные опции
```
defaults,noatime,nodiratime,discard=async,x-systemd.device-timeout=30,noauto,nofail
```
- `nodiratime` — то же для каталогов (доп. оптимизация).
- `x-systemd.device-timeout=30` — таймаут монтирования 30с (предотвращает зависания).
- `nofail` — загрузка без NVMe (для внешних дисков). 

#### Объяснение флагов
- **noatime** — не обновлять время последнего доступа к файлам/каталогам при чтении. Снижает количество записей на SSD на 10-30%, продлевая срок службы.
- **compress=zstd:1** — прозрачное сжатие данных алгоритмом Zstandard уровня 1 (быстрое, ~20-50% экономия места). Идеально для NVMe — ускоряет чтение и снижает I/O.
- **space_cache=v2** — использовать второй формат кэша свободного пространства Btrfs (по умолчанию с kernel 5.15+). Ускоряет операции aloc для больших файловых систем.
- **discard=async** — асинхронный TRIM при удалении файлов (не блокирует операции). Безопаснее continuous discard для NVMe, основной TRIM через fstrim.timer.
- **ssd** — оптимизации для SSD: отключает барьеры записи, использует nolockdep, распознаёт SSD-специфичные паттерны доступа.
- **subvol=@** — монтировать подтом btrfs с именем `@` как корень `/` (стандартная схема Btrfs: `@` для /, `@home` для /home и т.д.).

#### Полный пример
```
UUID=your-uuid / btrfs defaults,noatime,compress=zstd:1,space_cache=v2,discard=async,ssd,subvol=@ 0 0
```

#### Замечания
Опции `0 0` — Btrfs не требует fsck при загрузке (дамп и fsck отключены). После изменений: `mount -o remount /` и `btrfs filesystem usage /` для проверки.

Space_cache v1 и v2 — это разные реализации кэша свободного места в Btrfs, существенно различающиеся по производительности на больших файловых системах.

##### Основные различия
**V1** использует простые списки свободных блоков в каждом block group, обновляя их при каждой транзакции. Это приводит к большим затратам ввода-вывода при частых изменениях (удаление/запись), особенно на файловых системах >1TB — производительность может падать на 50-90% при высоких нагрузках. 

**V2** применяет B-tree (free space tree) для отслеживания фрагментированного пространства. Обновления происходят асинхронно и группируются, что устраняет деградацию на больших FS. Разница особенно заметна при workloads с множеством мелких файлов или RAID-массивах.

##### Переход и проверка
- **Проверка**: `btrfs fi df /` (v2 показывает меньше "GlobalReserve") или `journalctl -b | grep space` при монтировании.
- **Переход**: `mount -o space_cache=v2,clear_cache` (один раз), затем всегда v2. Невозврат к v1 без форматирования. 
- **По умолчанию**: v2 с kernel 6.2+ (2023), но man btrfs может показывать v1 в старых дистрибутивах. 
- **Рекомендация**: Всегда `space_cache=v2` для NVMe/Btrfs в 2026 — v1 устарел.

## Расширенные полезные команды

Дополнительные команды, которые могут быть полезны при обслуживании системы:

| Задача | Команда |
|---|---|
| Полное обновление системы | `doas emerge -avuDN --backtrack=30 @world` |
| Очистка неиспользуемых пакетов | `doas emerge --depclean` |
| Мониторинг использования GPU | `doas intel_gpu_top` |
| Проверка VA-API ускорения | `vainfo` |
| Проверка флагов CPU | `cpuid2cpuflags` |
| Статус профилей питания | `powerprofilesctl` |
