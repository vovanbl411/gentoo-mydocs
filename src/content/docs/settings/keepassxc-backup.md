---
title: Резервные копии KeePassXC в Google Drive через rclone
kind: guide
scope: general
status: current
last_verified: "2026-09-28"
verified_on: [asus-b5402]
---

Гайд настраивает двухуровневую схему резервных копий KeePassXC: встроенные
timestamped копии перед каждым сохранением базы плюс ручная доставка их в
Google Drive через rclone. Результат: при повреждении живой базы или потере
машины база восстановима из локального каталога и из облака, а доставка в
облако не удаляет старые копии.

Схема применима на любой системе с KeePassXC и rclone; автоматизация
(таймеры, rotation) здесь сознательно не рассматривается. Процедура целиком
проверена на ASUS ExpertBook B5402 2026-09-28 (KeePassXC 2.8.0-snapshot);
записанное состояние машины — в
[системном разделе](../../systems/asus-b5402/applications/).

## Architecture

```text
KeePassXC
  ↓ встроенный backup перед сохранением базы
~/Backups/KeePassXC/           timestamped .kdbx, directory mode 0700
  ↓ rclone copy / copyto (вручную)
gdrive:Backups/KeePassXC/      append-only backup destination
```

Ключевое решение: Google Drive — destination для резервных копий, а не live
filesystem. База KeePassXC открывается только с локального диска; облако
хранит закрытые копии и ничего не знает о процессе работы с базой.

## Prerequisites

- рабочий Gentoo с настроенным Portage;
- установленный KeePassXC (`app-admin/keepassxc`);
- учётная запись Google с достаточной квотой Drive;
- браузер для OAuth-разрешения — rclone откроет его сам.

## Установка rclone

```bash
doas emerge --ask net-misc/rclone
```

Закреплять конкретную версию не нужно.

## Собственный OAuth client в Google Cloud

rclone умеет работать со встроенным client_id проекта, но он общий для всех
пользователей rclone и попадает под общий rate limit. Собственный OAuth
client из личного Google Cloud project даёт выделенную квоту и ограничивает
OAuth-consent только твоим account. Сам проект бесплатен; оплачивается
только хранилище Drive по квоте account.

Шаги в [Google Cloud Console](https://console.cloud.google.com/):

1. Создай проект (например, `rclone-backups`).
2. Включи **Google Drive API** (APIs & Services → Library).
3. Настрой **OAuth consent screen**: user type *External*; для личного
   использования достаточно добавить свой Google account в test users
   (audience) и не публиковать приложение наружу.
4. Создай **OAuth client ID** (Credentials → Create credentials): тип
   приложения — *Desktop app*.
5. Скопируй client ID и client secret — они понадобятся в `rclone config`.

Названия пунктов меню у Google периодически меняются; важно одно: Desktop
OAuth client, привязанный к твоему личному project и account.

> **Важно**: не публикуй client ID, client secret и тем более содержимое
> `rclone.conf` с OAuth token — нигде, включая issues и документацию. В
> примерах ниже используются placeholders.

## Remote gdrive

Запусти интерактивную настройку:

```bash
rclone config
```

Существенная часть диалога (порядок вопросов зависит от версии rclone):

| Вопрос | Ответ |
|--------|-------|
| New remote → name | `gdrive` |
| Type of storage | `drive` (Google Drive) |
| `client_id` | `<your-client-id>` |
| `client_secret` | `<your-client-secret>` |
| `scope` | `drive.file` — «Access to files created by rclone only» |
| `root_folder_id`, `service_account_file`, advanced-вопросы | Enter (значение по умолчанию) |
| Configure this as a Shared Drive | `n` |
| Use web browser to automatically authenticate | `y` — разреши доступ в открывшемся браузере |

После успешной авторизации remote записывается в пользовательский конфиг:

Файл: `~/.config/rclone/rclone.conf`

```ini
[gdrive]
type = drive
scope = drive.file
client_id = <your-client-id>
client_secret = <your-client-secret>
token = <JSON с access/refresh token, сгенерирован rclone>
```

Строка `token` — живой OAuth token. Проверь права файла:

```bash
stat -c '%a %U:%G' ~/.config/rclone/rclone.conf
```

Ожидание: `600 <user>:<user>`. Если права шире, исправь:

```bash
chmod 600 ~/.config/rclone/rclone.conf
```

### Scope: drive.file

`drive.file` разрешает rclone видеть и изменять только файлы, созданные
этим remote; весь остальной Google Drive для него невидим. Для backup
destination этого достаточно, а у token минимальный blast radius: даже
скомпрометированный token не даёт доступ к остальным файлам Drive. Scope
ограничивает приложение, а не владельца — в веб-интерфейсе Drive файлы
видны как обычно.

Больший scope (`drive`, полный доступ к файлам account) нужен только если
rclone должен работать с уже существующими файлами Drive. В этой схеме он
не нужен.

## Каталог в Google Drive

Создай namespace для backups и проверь, что он появился:

```bash
rclone listremotes   # ожидание: gdrive:
rclone mkdir gdrive:Backups/KeePassXC
rclone lsd gdrive:Backups   # в списке каталогов появится KeePassXC
```

## Тест write/read/delete

Прежде чем доверять remote реальную базу, прогони тест на обычном
текстовом файле:

```bash
echo "rclone gdrive test" > /tmp/rclone-gdrive-test.txt
rclone copyto /tmp/rclone-gdrive-test.txt gdrive:Backups/KeePassXC/rclone-gdrive-test.txt
rclone cat gdrive:Backups/KeePassXC/rclone-gdrive-test.txt   # rclone gdrive test
rclone delete gdrive:Backups/KeePassXC/rclone-gdrive-test.txt
rm /tmp/rclone-gdrive-test.txt
```

`rclone cat` должен вернуть записанную строку, `rclone delete` — удалить
test-объект. Так проверяется транспорт, а не база.

## Локальные backups KeePassXC

Создай каталог backups с доступом только своему user:

```bash
mkdir -m 700 -p ~/Backups/KeePassXC
stat -c '%a' ~/Backups/KeePassXC   # ожидание: 700
```

В KeePassXC включи встроенный backup перед сохранением базы:
**Tools → Application Settings → Basic → Backup database file before
saving** и поле пути backup-копии (в русской локали формулировки
отличаются — ориентируйся на смысл настройки).

Поле требует абсолютный путь; раскрытие `~` или `$HOME` в нём не полагайся,
используй явный путь до своего home и шаблон имени файла:

```text
/home/<user>/Backups/KeePassXC/{DB_FILENAME}-{TIME:yyyy-MM-dd_HH-mm-ss}.kdbx
```

`{DB_FILENAME}` подставляет имя файла базы, `{TIME:…}` — timestamp
создания копии в заданном формате.

Проверка: измени любую запись в базе и сохрани — в каталоге появится
отдельный timestamped `.kdbx`:

```bash
ls -l ~/Backups/KeePassXC
file ~/Backups/KeePassXC/<timestamped-backup>.kdbx
# <timestamped-backup>.kdbx: Keepass password database 2.x KDBX
```

## Ручная доставка в Google Drive

Весь каталог — передаются только новые и изменённые файлы, ничего не
удаляется:

```bash
rclone copy ~/Backups/KeePassXC gdrive:Backups/KeePassXC
```

Один конкретный backup под тем же именем:

```bash
rclone copyto ~/Backups/KeePassXC/<timestamped-backup>.kdbx \
  gdrive:Backups/KeePassXC/<timestamped-backup>.kdbx
```

`rclone copy`/`copyto` не удаляют файлы в destination — старые remote-копии
остаются на месте. Это осознанный выбор: Google Drive здесь append-only.

## Verification: восстановление из облака

Скачай remote-копию во временный файл и сравни с локальной:

```bash
rclone copyto gdrive:Backups/KeePassXC/<timestamped-backup>.kdbx \
  /tmp/<timestamped-backup>.verify.kdbx
cmp -s ~/Backups/KeePassXC/<timestamped-backup>.kdbx \
  /tmp/<timestamped-backup>.verify.kdbx && echo "cmp: PASS"
sha256sum ~/Backups/KeePassXC/<timestamped-backup>.kdbx \
  /tmp/<timestamped-backup>.verify.kdbx
rm /tmp/<timestamped-backup>.verify.kdbx
```

Критерий PASS: размеры равны, `cmp` печатает `cmp: PASS`, обе строки
`sha256sum` идентичны. Временный файл после проверки удаляется; локальная
копия и remote при проверке не меняются.

Повтори проверку после первой доставки и после любых изменений remote или
конфигурации rclone. Значения hash уникальны для каждой базы — переносить
их в документацию или заметки не нужно.

## Retention

Принятые решения:

- локальная история: хранить backups за последние 90 дней;
- Google Drive: append-only, remote rotation не применяется.

Статус реализации на 2026-09-28:

- алгоритм локальной 90-day rotation проверен на тестовых файлах в
  изолированном временном каталоге и работает;
- к реальному `~/Backups/KeePassXC` rotation ещё не применялась и не
  автоматизирована — production implementation это следующий отдельный
  этап.

> ⚠️ **Важный нюанс**: пока rotation не внедрена, локальный каталог и remote
> растут неограниченно. Следи за размером вручную.

## Что намеренно не используется

| Подход | Почему не используется |
|--------|------------------------|
| `rclone mount`, FUSE, VFS cache | Google Drive — не live filesystem для открытой базы: cache-слой и рассинхронизация добавляют режим отказа, которого нет при копировании закрытых файлов. |
| Постоянно смонтированный Drive | То же, плюс база не должна открываться с сетевого «диска». |
| `rclone sync` | `sync` удаляет в destination файлы, отсутствующие в source, — ломает append-only историю. |
| Git/GitHub как live sync KDBX | Бинарный секрет в VCS расширяет поверхность распространения и не даёт истории версий внутри базы. |

## Ограничения и следующие этапы

Не реализовано и здесь намеренно не описано (отдельные следующие этапы):

- production rotation локальной 90-day истории;
- автоматизация доставки, например systemd user timer для rclone;
- синхронизация базы с телефоном.

## Troubleshooting и откат

- rclone сообщает об expired или invalid token — перевыпусти авторизацию:
  `rclone config reconnect gdrive:`.
- Частые ответы `429` (rate limit) — признак работы через общий встроенный
  client_id; проверь, что remote использует твой собственный OAuth client.
- Права `rclone.conf` шире `600` — исправь:
  `chmod 600 ~/.config/rclone/rclone.conf`.

Откат:

- локально — выключи настройку backup в KeePassXC; каталог
  `~/Backups/KeePassXC` при желании удаляется целиком;
- remote — `rclone purge gdrive:Backups/KeePassXC` удаляет весь каталог в
  Google Drive со всеми backup-копиями; выполняй только осознанно.
  Удаление remote из конфигурации (`rclone config delete gdrive`) файлы в
  Drive не трогает.

## Related docs

- [Приложения ASUS B5402](../../systems/asus-b5402/applications/) — проверенное состояние машины.
- [KeePassXC Quick Unlock через polkit](../../troubleshooting/keepassxc-quick-unlock-polkit/) — разблокировка базы по отпечатку.

## References

- [rclone: Google Drive](https://rclone.org/drive/) — backend, scopes, собственный client_id.
- [rclone docs](https://rclone.org/docs/) — команды `copy`, `copyto`, `mkdir`, `delete`, `config`.
- [net-misc/rclone](https://packages.gentoo.org/packages/net-misc/rclone) — пакет в Gentoo.
- [KeePassXC](https://github.com/keepassxreboot/keepassxc) — upstream-проект.
