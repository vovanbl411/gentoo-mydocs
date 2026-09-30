---
title: Резервные копии KeePassXC в Google Drive через rclone
kind: guide
scope: general
status: current
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

Гайд описывает принятый pipeline резервного копирования KeePassXC: из
выделенного live-каталога `~/Documents/KeePassSync/` wrapper находит ровно
один top-level regular non-symlink `*.kdbx`, создаёт проверенный локальный
snapshot, доставляет backups в Google Drive и только после успешной доставки
запускает local rotation. Встроенные timestamped backups KeePassXC при save
тоже остаются включены. Rotation удаляет локальные копии возрастом 90 дней и
старше по mtime; remote-файлы workflow не удаляет.

Ежедневная автоматизация на ASUS ExpertBook B5402 использует
`systemd --user`: calendar timer срабатывает в 20:00 по местному времени,
`Persistent=true`, `Linger=no`. Snapshot не зависит от того, где была сделана
последняя правка live DB: изменение, пришедшее позже через Android/Syncthing,
не обязано проходить через локальный save в KeePassXC. Обычная двусторонняя
синхронизация с Android через Syncthing и KeePassDX принята 2026-09-30;
реальное восстановление после конфликта и merge остаётся pending. Подробности
— в [отдельном руководстве](../keepassxc-phone-sync/).

Перед запуском wrapper проверяет, что в live-каталоге ровно одна подходящая
база. При нуле или нескольких файлах он завершается до snapshot, delivery и
rotation. Это startup conflict gate для лишнего файла, например Syncthing
conflict-copy; это не транзакционная блокировка Syncthing. На ASUS B5402
2026-09-29 приняты snapshot, обычный service run и controlled conflict-gate
test. Snapshot был mode `0600`, имел mtime текущего запуска и совпадал с live
DB побайтно; timer уже был включён и активен. См. также
[системный раздел](../../systems/asus-b5402/applications/).

## Architecture

```text
~/Documents/KeePassSync/      live DB, mode 0600; exactly one top-level *.kdbx
  ↓ daily wrapper: discover one DB, acquire non-blocking flock
~/Backups/KeePassXC/           verified snapshot + KeePassXC save backups, mode 0700
  ↓ rclone copy top-level *.kdbx
   gdrive:Backups/KeePassXC/   delivery without remote deletion
  ↓ only after delivery succeeds
local 90-day rotation           --apply; files aged 90 days or more by mtime
```

Google Drive — destination для резервных копий, а не live filesystem. База
KeePassXC открывается только с локального диска; облако хранит закрытые копии.

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
пользователей rclone и попадает под общий rate limit. По документации
rclone общий Google Drive client_id выводится из эксплуатации и перестанет
работать в течение 2026 года, поэтому для нового setup нужен собственный
OAuth client в Google Cloud project под твоим контролем. Это также даёт
отдельную project quota.

Шаги в [Google Cloud Console](https://console.cloud.google.com/):

1. Создай проект (например, `rclone-backups`).
2. Включи **Google Drive API** (APIs & Services → Library).
3. Настрой **OAuth consent screen**: user type *External*.
4. В **Data Access** объяви минимальный scope:
   `https://www.googleapis.com/auth/drive.file`. Не добавляй полный scope
   `drive`.
5. Создай **OAuth client ID** (Credentials → Create credentials): тип
   приложения — *Desktop app*.
6. Скопируй client ID и client secret — они понадобятся в `rclone config`.
7. Переведи приложение в publishing status *In production* (кнопка
   Publish app).

Если кнопка **Publish app** недоступна и Google требует App domain
information, заполни требуемые поля Branding: **Application home page**,
**Privacy policy URL** и **Authorized domain**. Эти поля не обязательны во
всех случаях.

Для OAuth branding опубликован отдельный минимальный статический сайт:
[homepage](https://rclone.9fans.uk/) и [privacy policy](https://rclone.9fans.uk/privacy/).
Его [исходный код](https://github.com/vovanbl411/rclone-oauth-pages)
находится в отдельном публичном репозитории GitHub. Сайт служит только
публичными страницами homepage и privacy policy OAuth-приложения: он не
проксирует rclone и не хранит KDBX, OAuth tokens или другие backup data.

Не оставляй приложение в статусе *Testing*: у External-приложения в
Testing refresh token для Google API scopes истекает через 7 дней — для
долговременного backup это неприемлемо. В *In production* этого 7-дневного
ограничения нет. Для personal-use формальная OAuth verification не
обязательна. Режим *External* / *In production* технически доступен другим
Google accounts: personal-use описывает сценарий эксплуатации, а не
ограничение аудитории.

Собственный client нужен потому, что общий `client_id` rclone выводится из
эксплуатации в 2026 году, а отдельные project и client находятся под твоим
контролем и используют отдельную project quota.

Если существующая конфигурация была авторизована в *Testing*, после
перехода приложения в *In production* обязательно переподключи её:
`rclone config reconnect gdrive:`. Затем повтори минимальную проверку
transport в следующем разделе: выполни `rclone lsf`, загрузи тестовый файл,
прочитай его через `rclone cat` и удали через `rclone deletefile`.
Для fresh install отдельный reconnect не нужен, если первичная
авторизация выполняется уже после **Publish app**.

Названия пунктов меню у Google периодически меняются; важно создать Desktop
OAuth client в контролируемом тобой project и перевести приложение в
статус *In production*.

> **Важно**: не публикуй содержимое `rclone.conf` и OAuth token (включая
> refresh token), не коммить client secret. Client ID — не credential
> уровня OAuth token, но публиковать реальный project identifier в этом
> repository нет причины. В примерах ниже используются placeholders.

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
echo "rclone gdrive test" > /tmp/rclone-test.txt
rclone lsf gdrive:Backups/KeePassXC
rclone copyto /tmp/rclone-test.txt gdrive:Backups/KeePassXC/rclone-test.txt
rclone cat gdrive:Backups/KeePassXC/rclone-test.txt   # rclone gdrive test
rclone deletefile gdrive:Backups/KeePassXC/rclone-test.txt
rm /tmp/rclone-test.txt
```

`rclone cat` должен вернуть записанную строку, `rclone deletefile` —
удалить test-объект (`deletefile` удаляет один конкретный файл; `delete`
работает по всему path). Так проверяется транспорт, а не база.

## Локальные backups KeePassXC

Создай каталог backups с доступом только своему user:

```bash
mkdir -p ~/Backups/KeePassXC
chmod 700 ~/Backups/KeePassXC
stat -c '%a %U:%G %n' ~/Backups/KeePassXC
# ожидание: 700 <user>:<user> /home/<user>/Backups/KeePassXC
```

`chmod` выполняется отдельной командой, потому что `mkdir -m` не меняет
права уже существующего каталога: если каталог был создан раньше с широкими
правами, `mkdir -m 700 -p` их не исправит.

В KeePassXC включи встроенный backup перед сохранением базы:
**Tools → Application Settings → Basic → Backup database file before
saving** и поле пути backup-копии (в русской локали формулировки
отличаются — ориентируйся на смысл настройки).

KeePassXC поддерживает и абсолютный, и относительный путь в поле backup
destination. В этой схеме сознательно используется явный абсолютный путь,
чтобы destination не зависел от каталога рабочей базы. Шаблон имени файла:

```text
/home/<user>/Backups/KeePassXC/{DB_FILENAME}-{TIME:yyyy-MM-dd_HH-mm-ss}.kdbx
```

`{DB_FILENAME}` подставляет имя файла базы, `{TIME:…}` — timestamp
создания копии в заданном формате.

Проверка: измени любую запись в базе и сохрани — в каталоге появится
отдельный timestamped `.kdbx`. Имена баз бывают с пробелами и апострофами,
поэтому в командах используй quoted переменные:

```bash
ls -l ~/Backups/KeePassXC
backup_name="database-2026-09-28_21-49-42.kdbx"   # имя твоего файла
file "$HOME/Backups/KeePassXC/$backup_name"
# database-2026-09-28_21-49-42.kdbx: Keepass password database 2.x KDBX
```

## Ручная доставка в Google Drive

Весь каталог — передаются только новые и изменённые файлы, ничего не
удаляется:

```bash
rclone copy ~/Backups/KeePassXC gdrive:Backups/KeePassXC
```

Один конкретный backup под тем же именем:

```bash
backup_name="database-2026-09-28_21-49-42.kdbx"   # имя твоего файла
rclone copyto \
  "$HOME/Backups/KeePassXC/$backup_name" \
  "gdrive:Backups/KeePassXC/$backup_name"
```

`rclone copy`/`copyto` не удаляют файлы в destination: routine-доставка не
трогает копии, которых нет в source, а timestamped имена сохраняют старые
версии. Удаление и rotation на remote сейчас намеренно не выполняются —
это операционная политика схемы, а не техническое свойство хранилища:
Google Drive remote умеет изменять и удалять созданные объекты.

## Verification: восстановление из облака

Скачай remote-копию во временный файл и сравни с локальной:

```bash
backup_name="database-2026-09-28_21-49-42.kdbx"   # имя твоего файла
verify_file=$(mktemp /tmp/keepassxc-verify.XXXXXX.kdbx)
rclone copyto "gdrive:Backups/KeePassXC/$backup_name" "$verify_file"
cmp -s "$HOME/Backups/KeePassXC/$backup_name" "$verify_file" \
  && echo "cmp: PASS"
sha256sum "$HOME/Backups/KeePassXC/$backup_name" "$verify_file"
rm "$verify_file"
```

Критерий PASS: размеры равны, `cmp` печатает `cmp: PASS`, обе строки
`sha256sum` идентичны. Временный файл после проверки удаляется; локальная
копия и remote при проверке не меняются.

Повтори проверку после первой доставки и после любых изменений remote или
конфигурации rclone. Значения hash уникальны для каждой базы — переносить
их в документацию или заметки не нужно.

## Retention

Принятые решения:

- local rotation сохраняет файлы младше 90 дней; копии возрастом 90 дней и
  старше удаляются по mtime;
- Google Drive: доставка без удаления; rotation на remote не применяется.

Статус реализации на 2026-09-29:

- production rotation реализована как
  `~/.local/bin/keepassxc-backup-rotate` и принята 2026-09-29 (PASS);
- retention — 90 дней по mtime: проверяются только regular files `*.kdbx`
  верхнего уровня `~/Backups/KeePassXC/`; файлы возрастом 90 дней и старше
  считаются просроченными;
- запуск без аргументов выполняет dry-run; удаление требует явного
  `--apply`;
- перед обработкой script проверяет заданный `HOME`, существование
  каталога, отсутствие symlink, владельца и mode `0700`, вычисление cutoff
  и успешное сканирование каталога. При ошибке проверок удаление не
  выполняется;
- первый запуск безопасен и ничего не удаляет. Запуск с `--apply` реально
  удаляет найденные просроченные локальные KDBX-файлы;
- controlled acceptance local rotation подтвердил ожидаемое поведение: dry-run
  сохранил просроченный тестовый KDBX, а `--apply` удалил только его.
  Non-KDBX control и production KDBX сохранились; hash реальной базы до и
  после совпал;
- daily snapshot, delivery и local rotation выполняются wrapper-ом
  `~/.local/bin/keepassxc-backup-run` через user service и calendar timer;
  сначала он проверяет live DB и создаёт snapshot, затем выполняет
  `rclone copy`, и только после успеха — rotation. Подробная конфигурация
  приведена ниже.

Google Drive остаётся destination для backup-копий. Этот workflow не удаляет
remote-файлы и не выполняет remote rotation. При частичной передаче с ошибкой
локальная rotation пропускается; следующий успешный `rclone copy` может
докопировать отсутствующие файлы. Если доставка прошла, а rotation завершилась
ошибкой, remote-копии уже доставлены, а старые локальные копии могут остаться.

> **Важно**: remote deletion намеренно не выполняется, но Google Drive не
> является immutable-хранилищем. Automation не обеспечивает защиту от
> изменения или удаления объектов другими средствами.

### Установка и запуск local rotation

Сохрани следующий script в
`~/.local/bin/keepassxc-backup-rotate`:

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly backup_dir="${HOME:?HOME is not set}/Backups/KeePassXC"
readonly retention_days=90

usage() {
    printf 'Usage: %s [--apply]\n' "${0##*/}"
    printf 'Default: dry-run. --apply deletes matching backup files.\n'
}

apply=false

if (($# > 1)); then
    usage >&2
    exit 2
fi

case "${1:-}" in
    "")
        ;;
    --apply)
        apply=true
        ;;
    -h|--help)
        usage
        exit 0
        ;;
    *)
        usage >&2
        exit 2
        ;;
esac

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

[[ -d "$backup_dir" ]] || fail "backup directory does not exist"
[[ ! -L "$backup_dir" ]] || fail "backup directory must not be a symlink"

[[ "$(stat -c '%u' -- "$backup_dir")" == "$(id -u)" ]] \
    || fail "backup directory is not owned by the current user"

[[ "$(stat -c '%a' -- "$backup_dir")" == "700" ]] \
    || fail "backup directory mode is not 700"

cutoff="$(date -d "${retention_days} days ago" '+%Y-%m-%d %H:%M:%S')" \
    || fail "cannot calculate retention cutoff"

[[ -n "$cutoff" ]] || fail "retention cutoff is empty"

candidate_list="$(mktemp)"
trap 'rm -f "$candidate_list"' EXIT

if ! find "$backup_dir" \
    -maxdepth 1 \
    -type f \
    -name '*.kdbx' \
    ! -newermt "$cutoff" \
    -print0 > "$candidate_list"
then
    fail "cannot scan backup directory"
fi

mapfile -d '' -t candidates < "$candidate_list"

printf 'Backup directory: %s\n' "$backup_dir"
printf 'Retention: %d days\n' "$retention_days"
printf 'Cutoff: %s\n' "$cutoff"
printf 'Candidates: %d\n' "${#candidates[@]}"

i=0
for file in "${candidates[@]}"; do
    ((i += 1))
    printf '#%d ' "$i"
    stat -c 'mtime=%y size=%s bytes' -- "$file"
done

if ! $apply; then
    printf 'DRY-RUN: no files deleted\n'
    exit 0
fi

if ((${#candidates[@]} == 0)); then
    printf 'PASS: no expired backups to delete\n'
    exit 0
fi

rm -- "${candidates[@]}"

for file in "${candidates[@]}"; do
    [[ ! -e "$file" ]] || fail "candidate still exists after deletion"
done

printf 'PASS: deleted %d expired backup(s)\n' "${#candidates[@]}"
```

Создай каталог для пользовательских команд и выставь mode script:

```bash
mkdir -p ~/.local/bin
chmod 700 ~/.local/bin/keepassxc-backup-rotate
```

Основные команды:

```bash
~/.local/bin/keepassxc-backup-rotate
~/.local/bin/keepassxc-backup-rotate --apply
```

Первый вызов показывает число кандидатов и их mtime/размер, но ничего не
удаляет. Второй запускает ту же проверку и удаляет найденные просроченные
локальные `.kdbx`.

## Ежедневный snapshot, доставка и локальная rotation

Wrapper сначала находит в `~/Documents/KeePassSync/` ровно один top-level
regular non-symlink `*.kdbx`. Затем он захватывает non-blocking lock и создаёт
snapshot в `~/Backups/KeePassXC/`. Ежедневный snapshot сохраняет изменения
независимо от того, где они внесены: более позднее изменение из
Android/Syncthing не обязано сначала пройти через KeePassXC save на этой
машине.

Имя snapshot имеет общий формат
`keepassxc-snapshot-YYYY-MM-DD_HH-MM-SS.XXXXXX.kdbx`; mode — `0600`, mtime —
текущий. Wrapper проверяет идентичность байтов через `cmp`. Если копирование
или проверка не удались, неполный snapshot удаляется, а delivery не
начинается. Проверенный snapshot остаётся в backup-каталоге, даже если
последующая доставка завершится ошибкой.

Если startup precheck находит не ровно один top-level regular non-symlink
`*.kdbx`, wrapper завершается с ошибкой до snapshot, delivery и rotation.
Этот startup conflict gate ловит неожиданную дополнительную базу, например
Syncthing conflict-copy; он не блокирует и не сериализует сам Syncthing.

Один non-blocking `flock` на `$XDG_RUNTIME_DIR/keepassxc-backup.lock`
удерживается с момента перед созданием snapshot до конца rotation. File
descriptor 9 остаётся открыт всё время работы workflow. Параллельный запуск
печатает `SKIP` и завершается с кодом `0`, не запуская второй workflow.

После проверки snapshot команда `rclone copy` доставляет только top-level
regular `*.kdbx` из `~/Backups/KeePassXC/` в `gdrive:Backups/KeePassXC/`.
Используется `copy`, потому что доставка не должна удалять remote-файлы;
`rclone sync` и remote rotation не применяются. Если доставка возвращает
ошибку, wrapper завершается и пропускает локальную rotation. Проверенный
snapshot остаётся локально для следующей успешной доставки. Автоматического
retry loop нет. Только успешная доставка разрешает запуск
`keepassxc-backup-rotate --apply`.

Сохрани wrapper как `~/.local/bin/keepassxc-backup-run` с mode `0700`. Ему
нужны `HOME` и `XDG_RUNTIME_DIR`, команды `rclone` и `flock`, оба каталога,
исполняемый rotation script и ровно один top-level regular non-symlink live
`*.kdbx`.

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${HOME:?HOME must be set}"
: "${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR must be set}"

readonly live_dir="$HOME/Documents/KeePassSync"
readonly backup_dir="$HOME/Backups/KeePassXC"
readonly remote='gdrive:Backups/KeePassXC'
readonly rotate="$HOME/.local/bin/keepassxc-backup-rotate"
readonly lock_file="$XDG_RUNTIME_DIR/keepassxc-backup.lock"

command -v rclone >/dev/null 2>&1 || { printf 'FAIL: rclone is unavailable\n' >&2; exit 1; }
command -v flock >/dev/null 2>&1 || { printf 'FAIL: flock is unavailable\n' >&2; exit 1; }
[[ -d "$live_dir" ]] || { printf 'FAIL: live database directory is missing\n' >&2; exit 1; }
[[ -d "$backup_dir" ]] || { printf 'FAIL: backup directory is missing\n' >&2; exit 1; }
[[ -x "$rotate" ]] || { printf 'FAIL: rotation script is missing or not executable\n' >&2; exit 1; }

shopt -s dotglob nullglob
live_candidates=("$live_dir"/*.kdbx)
live_databases=()
for candidate in "${live_candidates[@]}"; do
    if [[ -f "$candidate" && ! -L "$candidate" ]]; then
        live_databases+=("$candidate")
    fi
done
if ((${#live_databases[@]} != 1)); then
    printf 'FAIL: expected exactly one live KDBX; found %d\n' "${#live_databases[@]}" >&2
    exit 1
fi
readonly live_db="${live_databases[0]}"

exec 9>"$lock_file"
if ! flock -n 9; then
    printf 'SKIP: another KeePassXC backup run holds the lock\n'
    exit 0
fi

snapshot_path=''
snapshot_verified=false
cleanup_incomplete_snapshot() {
    if [[ "$snapshot_verified" != true && -n "$snapshot_path" ]]; then
        rm -f -- "$snapshot_path"
    fi
}
trap cleanup_incomplete_snapshot EXIT

printf 'STAGE: local snapshot\n'
snapshot_time="$(date '+%F_%H-%M-%S')"
if ! snapshot_path="$(mktemp "$backup_dir/keepassxc-snapshot-${snapshot_time}.XXXXXX.kdbx")"; then
    printf 'FAIL: cannot create local snapshot\n' >&2
    exit 1
fi
if ! cp -- "$live_db" "$snapshot_path"; then
    printf 'FAIL: cannot copy live database to snapshot\n' >&2
    exit 1
fi
if ! chmod 600 -- "$snapshot_path"; then
    printf 'FAIL: cannot set snapshot mode\n' >&2
    exit 1
fi
if ! touch -- "$snapshot_path"; then
    printf 'FAIL: cannot update snapshot mtime\n' >&2
    exit 1
fi
if ! cmp -s -- "$live_db" "$snapshot_path"; then
    printf 'FAIL: snapshot does not match live database\n' >&2
    exit 1
fi
snapshot_verified=true
printf 'PASS: local snapshot\n'

printf 'STAGE: delivery\n'
if ! rclone copy \
    "$backup_dir" \
    "$remote" \
    --include '/*.kdbx' \
    --max-depth 1
then
    printf 'FAIL: delivery failed; rotation skipped\n' >&2
    exit 1
fi
printf 'PASS: delivery\n'

printf 'STAGE: local rotation\n'
"$rotate" --apply
printf 'PASS: local rotation\n'
```

Сохрани user service как
`~/.config/systemd/user/keepassxc-backup.service` (mode `0644`):

```ini
[Unit]
Description=Deliver KeePassXC backups and rotate local history

[Service]
Type=oneshot
ExecStart=%h/.local/bin/keepassxc-backup-run
```

Сохрани user timer как
`~/.config/systemd/user/keepassxc-backup.timer` (mode `0644`):

```ini
[Unit]
Description=Daily KeePassXC backup delivery

[Timer]
OnCalendar=*-*-* 20:00:00
Persistent=true
Unit=keepassxc-backup.service

[Install]
WantedBy=timers.target
```

Задай права, перечитай user units и включи timer:

```bash
mkdir -p ~/.local/bin ~/.config/systemd/user
chmod 700 ~/.local/bin/keepassxc-backup-run
chmod 644 ~/.config/systemd/user/keepassxc-backup.service
chmod 644 ~/.config/systemd/user/keepassxc-backup.timer
systemctl --user daemon-reload
systemctl --user enable --now keepassxc-backup.timer
```

При `Persistent=true` timer догоняет пропущенное calendar-срабатывание,
когда user manager снова становится активным. На этой машине `Linger=no`,
поэтому при неактивном user manager отдельного фонового запуска нет;
пропущенное событие обычно обрабатывается при следующем login/session.
`Persistent` не является механизмом повтора приложения: если service уже
запустился и завершился ошибкой, автоматического retry нет. Следующая попытка
будет по расписанию или после ручного запуска.

Service использует `Type=oneshot`. После успешного выполнения он обычно
показывает `inactive (dead)` — это штатное завершение. Проверяй
`Result=success` и журнал. Команды проверки:

```bash
systemctl --user status keepassxc-backup.timer
systemctl --user list-timers --all keepassxc-backup.timer
systemctl --user status keepassxc-backup.service
journalctl --user -u keepassxc-backup.service -n 50 --no-pager
```

Для ручного запуска workflow:

```bash
systemctl --user start keepassxc-backup.service
```

Acceptance на ASUS B5402 прошёл 2026-09-29: service завершился с
`Result=success` и `ExecMainStatus=0`; журнал подтвердил snapshot → delivery →
rotation. Число локальных KDBX выросло с 2 до 3; новый snapshot имел mode
`0600`, mtime текущего запуска и совпадал с live DB побайтно. Число remote
объектов выросло с 1 до 3. Контролируемый тест со второй базой подтвердил,
что conflict gate останавливает workflow до snapshot, delivery и rotation.
Timer остался enabled и `active (waiting)` с ежедневным расписанием 20:00.

## Что намеренно не используется

| Подход | Почему не используется |
|--------|------------------------|
| `rclone mount`, FUSE, VFS cache | Google Drive — не live filesystem для открытой базы: cache-слой и рассинхронизация добавляют режим отказа, которого нет при копировании закрытых файлов. |
| Постоянно смонтированный Drive | То же, плюс база не должна открываться с сетевого «диска». |
| `rclone sync` | `sync` удаляет в destination файлы, отсутствующие в source, — удаляет старые remote-копии и ломает схему доставки без удаления. |
| Git/GitHub как live sync KDBX | Бинарный секрет в VCS расширяет поверхность распространения и не даёт истории версий внутри базы. |

## Troubleshooting и откат

- rclone сообщает об expired или invalid token — перевыпусти авторизацию:
  `rclone config reconnect gdrive:`.
- Ответы `429` (rate limit) означают исчерпание quota/rate-limit Google
  Drive API и могут возникать по разным причинам. Проверь текст ошибки
  rclone, quotas проекта в Cloud Console и что remote использует
  собственный OAuth client, а не общий встроенный client_id.
- Права `rclone.conf` шире `600` — исправь:
  `chmod 600 ~/.config/rclone/rclone.conf`.

Откат:

- в KeePassXC выключи automatic backup, если он больше не нужен; локальный
  каталог `~/Backups/KeePassXC` при желании удаляется отдельно;
- remote `gdrive` удаляй из локальной конфигурации
  (`rclone config delete gdrive`) только если он действительно не нужен —
  удаление remote из конфигурации не трогает файлы в Google Drive;
- backup-файлы в `gdrive:Backups/KeePassXC/` остаются в Drive, пока ты
  отдельно не решишь их удалить; штатный откат настройки их не удаляет.

## Related docs

- [Синхронизация KeePassXC с Android через Syncthing](../keepassxc-phone-sync/) — live sync и статус conflict recovery.
- [Приложения ASUS B5402](../../systems/asus-b5402/applications/) — проверенное состояние машины.
- [KeePassXC Quick Unlock через polkit](../../troubleshooting/keepassxc-quick-unlock-polkit/) — разблокировка базы по отпечатку.

## References

- [rclone: Google Drive](https://rclone.org/drive/) — backend, scopes,
  собственный client_id; вывод из эксплуатации общего client_id в 2026.
- [rclone docs](https://rclone.org/docs/) — команды `copy`, `copyto`,
  `mkdir`, `deletefile`, `config`.
- [Google: OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) —
  refresh token expiration: Testing — 7 дней, In production — без этого
  ограничения.
- [rclone OAuth branding site source](https://github.com/vovanbl411/rclone-oauth-pages) — исходный код статического OAuth homepage/privacy site.
- [net-misc/rclone](https://packages.gentoo.org/packages/net-misc/rclone) — пакет в Gentoo.
- [KeePassXC](https://github.com/keepassxreboot/keepassxc) — upstream-проект.
