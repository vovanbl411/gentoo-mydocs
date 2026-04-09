# **Настройка сканера отпечатков пальцев Elan 04f3:0c77 на Gentoo (и других дистрибутивах)**

## **1. Введение**
Данное руководство описывает процесс включения поддержки сканера отпечатков пальцев Elan Microelectronics Corp. с идентификатором USB `04f3:0c77` (ELAN:ARM-M4) в Linux. Основная сложность в том, что устройство не поддерживается стандартным драйвером `libfprint`. Используется модифицированный драйвер из репозитория [xerootg/libfprint](https://github.com/xerootg/libfprint), который уже содержит поддержку ряда устройств Elan. Для `04f3:0c77` потребовалось добавить его идентификатор и подобрать правильный `quirk` (флаг, управляющий особенностями протокола).

## **2. Предварительные требования**
Убедитесь, что в системе установлены необходимые пакеты:
- `git` – для клонирования репозитория
- `meson`, `ninja` – система сборки
- `gcc` (или другой компилятор C)
- `pkgconfig`
- библиотеки: `libusb`, `glib`, `nss`, `libgusb`, `libudev` (обычно уже есть, но проверьте)
- `fprintd` – демон для интеграции в систему
- `systemd` или `OpenRC` (для управления сервисами)

На Gentoo установка может выглядеть так:
```bash
sudo emerge -av dev-vcs/git dev-util/meson dev-util/ninja sys-devel/gcc dev-util/pkgconfig virtual/libusb dev-libs/glib dev-libs/nss sys-auth/fprintd
```

## **3. Получение исходников модифицированного драйвера**
Клонируйте форк xerootg:
```bash
git clone https://github.com/xerootg/libfprint.git
cd libfprint
```

## **4. Модификация драйвера**
### **4.1. Добавление идентификатора устройства**
Откройте файл `drivers/elanmoc2.c` и найдите массив `elanmoc2_id_table`. Добавьте строку для вашего устройства (PID `0x0c77`):
```c
static const FpIdEntry elanmoc2_id_table[] = {
    // ... другие записи
    {.vid = ELANMOC2_VEND_ID, .pid = 0x0c77, .driver_data = ELANMOC2_QUIRK_USE_EP83_FOR_MOC},
    {.vid = 0, .pid = 0, .driver_data = 0}
};
```
Значение `driver_data` (quirk) будет подбираться экспериментально. Начните с `ELANMOC2_QUIRK_USE_EP83_FOR_MOC`.

### **4.2. Исправление номера интерфейса**
Устройство имеет только один интерфейс (номер 0), но драйвер пытался захватить ещё и интерфейс 1. В функции `elanmoc2_open` удалите или закомментируйте блок, пытающийся захватить интерфейс 1, либо оставьте только захват интерфейса 0. В итоге функция должна выглядеть примерно так:
```c
static void
elanmoc2_open (FpDevice *device)
{
  g_autoptr(GError) error = NULL;
  FpiDeviceElanMoC2 *self;

  if (!g_usb_device_reset (fpi_device_get_usb_device (device), &error))
    return fpi_device_open_complete (device, g_steal_pointer (&error));

  if (!g_usb_device_claim_interface (
        fpi_device_get_usb_device (FP_DEVICE (device)), 0, 0, &error))
    return fpi_device_open_complete (device, g_steal_pointer (&error));

  fp_dbg ("Interface 0 claimed successfully, skipping interface 1 (not present on this model)");

  self = FPI_DEVICE_ELANMOC2 (device);
  self->quirks = fpi_device_get_driver_data (FP_DEVICE (device));
  fpi_device_open_complete (device, NULL);
}
```

## **5. Сборка и установка**
### **5.1. Настройка сборки с префиксом /usr**
Чтобы библиотека устанавливалась в системный каталог `/usr/lib64`, а не в `/usr/local`, выполните:
```bash
meson setup build --prefix=/usr
```
Если вы уже настраивали сборку, используйте `--reconfigure`.

### **5.2. Компиляция и установка**
```bash
ninja -C build
sudo ninja -C build install
sudo ldconfig
```

## **6. Настройка прав доступа (udev)**
Создайте правило для доступа обычных пользователей к устройству:
```bash
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="04f3", ATTRS{idProduct}=="0c77", MODE="0660", GROUP="plugdev"' | sudo tee /etc/udev/rules.d/99-fingerprint.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```
Добавьте своего пользователя в группу `plugdev`, если ещё не сделано:
```bash
sudo usermod -aG plugdev $USER
```
После этого **выйдите из системы и зайдите снова** (или перезагрузите сессию), чтобы изменения вступили в силу.

## **7. Проверка работы драйвера с помощью примеров из исходников**
Перейдите в директорию сборки и запустите тестовые утилиты (от root, чтобы гарантировать доступ):
```bash
cd build/examples
sudo ./verify
```
Если устройство определяется, выберите палец и проверьте реакцию. Если работает, попробуйте запись:
```bash
sudo ./enroll
```
При успешной записи вы увидите сообщение о завершении.

## **8. Интеграция с системным fprintd**
### **8.1. Проверка используемой библиотеки**
Убедитесь, что сервис `fprintd` загружает вашу версию библиотеки:
```bash
sudo systemctl restart fprintd
sudo lsof -p $(pidof fprintd) | grep libfprint
```
Путь должен указывать на `/usr/lib64/libfprint-2.so.2`. Если это не так, проверьте установку и повторите шаг 5.

### **8.2. Проверка обнаружения устройства**
```bash
fprintd-list $USER
```
Должно быть выведено сообщение об устройстве и отсутствии зарегистрированных пальцев.

## **9. Подбор правильного quirk**
Если запись или верификация через `fprintd` не работают (ошибки размера, `verify-no-match` и т.п.), необходимо подобрать значение `driver_data` (quirk). В драйвере определены следующие флаги (могут комбинироваться через `|`):

- `ELANMOC2_QUIRK_NONE` (0) – без особенностей
- `ELANMOC2_QUIRK_USE_EP83_FOR_MOC` (1 << 0) – использовать endpoint 0x83 для передачи данных
- `ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3` (1 << 1) – смещение в структуре информации о пальце
- `ELANMOC2_QUIRK_NO_DELETE_BY_ID` (1 << 2) – не использовать удаление по ID

### **9.1. Порядок перебора**
Для каждого значения из списка ниже выполняйте:

1. Отредактируйте `drivers/elanmoc2.c`, установив `driver_data` для `0x0c77` в соответствующее значение.
2. Пересоберите и установите драйвер:
   ```bash
   ninja -C build && sudo ninja -C build install && sudo ldconfig && sudo systemctl restart fprintd
   ```
3. Удалите предыдущие отпечатки (если есть) через `fprintd-delete $USER`.
4. Попробуйте записать палец: `fprintd-enroll`. Внимательно следите за выводом и логами `journalctl -u fprintd -f`.
5. Если запись удалась, проверьте верификацию: `fprintd-verify`.
6. Если ошибка повторяется, переходите к следующему значению.

### **9.2. Рекомендуемая последовательность комбинаций**
1. `ELANMOC2_QUIRK_NONE`
2. `ELANMOC2_QUIRK_USE_EP83_FOR_MOC` (уже использовали)
3. `ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3`
4. `ELANMOC2_QUIRK_NO_DELETE_BY_ID`
5. `ELANMOC2_QUIRK_USE_EP83_FOR_MOC | ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3`
6. `ELANMOC2_QUIRK_USE_EP83_FOR_MOC | ELANMOC2_QUIRK_NO_DELETE_BY_ID`
7. `ELANMOC2_QUIRK_FINGER_INFO_OFFSET_3 | ELANMOC2_QUIRK_NO_DELETE_BY_ID`
8. Все три вместе.

### **9.3. Дополнительные советы**
- Во время тестов следите за логами `journalctl -u fprintd -f`. Они часто содержат ключевые сообщения об ошибках, например, `Unexpected short error of 2 size (expected 64)`.
- Если удаление отпечатка выдаёт ту же ошибку, значит проблема в операциях с внутренней памятью устройства.
- При успешной записи файл отпечатка должен появиться в `/var/lib/fprint/$USER/`. Его размер может быть разным (обычно 64 байта или больше).
- Если ни одна комбинация не даёт результата, возможно, требуется изменить ожидаемый размер ответа в коде (но это более сложный путь).

## **10. Настройка PAM для использования отпечатка**
После того как `fprintd-verify` начнёт успешно работать, можно добавить аутентификацию по отпечатку для sudo, входа в систему и т.д.

Например, для `sudo` отредактируйте `/etc/pam.d/sudo` и добавьте в начало:
```
auth sufficient pam_fprintd.so
```
Для входа в систему (GDM, SDDM) отредактируйте соответствующий файл в `/etc/pam.d/` (обычно `system-local-login` или `gdm-password`). **Будьте осторожны** – всегда держите открытый терминал с root-доступом на случай ошибки.

## **11. Заключение**
Вы проделали сложную работу по адаптации драйвера для неподдерживаемого сканера. Основные этапы:
- Модификация исходников (добавление PID, исправление интерфейса)
- Сборка и установка в системный каталог
- Настройка прав udev
- Интеграция с fprintd
- Подбор quirks

Осталось лишь найти правильную комбинацию флагов. Благодаря методичному перебору и анализу логов это вполне достижимо.

**Полезные ссылки:**
- [Оригинальный issue на github linux-surface](https://github.com/linux-surface/linux-surface/issues/1380)
- [Репозиторий xerootg с модифицированным драйвером](https://github.com/xerootg/libfprint)
- [Обсуждение для 04f3:0c77 (depau/elanpoc#2)](https://github.com/depau/elanpoc/issues/2)
