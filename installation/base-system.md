# Базовая настройка системы (Base System)
Конфигурация окружения Gentoo с упором на производительность (LLVM/LTO), современные линкеры и кэширование.
## 1. Настройка компилятора и тулчейна (LLVM)
В данной системе используется стек LLVM вместо классического GCC для достижения лучшей оптимизации и скорости сборки.
Файл: /etc/portage/make.conf
# Глобальный тулчейн LLVM (Slot 23)
CC="clang"
CXX="clang++"
AR="llvm-ar"
NM="llvm-nm"
RANLIB="llvm-ranlib"

# CPU и общие флаги (Alder Lake + O3 + LTO)
COMMON_FLAGS="-march=alderlake -O3 -flto=thin -pipe -mno-kl -mno-pconfig -mno-sgx -mno-widekl -mshstk"
CFLAGS="${COMMON_FLAGS}"
CXXFLAGS="${COMMON_FLAGS}"

# Специфичные флаги для Rust и Go
RUSTFLAGS="-C target-cpu=alderlake -C opt-level=3"
GOAMD64="v3"
GOFLAGS="-buildmode=pie"

## 2. Ускорение сборки (mold & ccache)
Для минимизации времени ожидания при сборке тяжелых пакетов используется современный линкер mold и система кэширования ccache.
# Использование линкера mold
LDFLAGS="${LDFLAGS} -fuse-ld=mold"

# Настройка ccache
FEATURES="${FEATURES} ccache" 
CCACHE_DIR="/var/tmp/ccache"
CCACHE_SIZE="50G"
CCACHE_COMPRESS="1"
CCACHE_COMPRESS_LEVEL="3"
CCACHE_SLOPPINESS="include_file_mtime,include_file_ctime,time_macros,file_macro,pch_defines"

## 3. Глобальные USE-флаги
Философия системы: Pure Wayland. Полное отсутствие X11 зависимостей, использование системных демонов systemd и современных протоколов безопасности.
USE="\
  # Графика: Wayland native, без X
  wayland gles2 egl mapi opencl vpp vaapi vulkan zink -X -xwayland \
  # Оптимизация сборки
  pgo lto custom-cflags asm \
  # Звук и видео (Pipewire)
  alsa ffmpeg gstreamer pipewire sound-server v4l screencast -pulseaudio \
  # Система и безопасность
  systemd dbus tpm cryptsetup secureboot apparmor audit bpf nftables hardened verify-sig \
  # Сеть
  bluetooth wifi networkmanager \
  # Отключено (телеметрия и устаревшие компоненты)
  -elogind -consolekit -telemetry"

## 4. Повышение привилегий (doas)
Вместо громоздкого sudo используется легковесный doas.
Файл: /etc/doas.conf
# Разрешить пользователю выполнять команды от root с сохранением пароля на время сессии
permit persist :wheel

# Сохранять переменные окружения для конкретного пользователя
permit keepenv vladimir

# Разрешить выполнение snapper без ввода пароля (для снапшотов)
permit persist :wheel as root cmd snapper
