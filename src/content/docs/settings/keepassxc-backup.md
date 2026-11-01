---
title: Резервные копии KeePassXC в Google Drive через rclone
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

Резервная копия KeePassXC проходит через локальный snapshot и `rclone copy` в
Google Drive. Локальная rotation запускается только после успешной доставки.
Google Drive здесь хранит закрытые backup-копии, а рабочая база остаётся на
локальном диске.

```text
local live database
→ exactly-one-database preflight
→ verified local snapshot
→ rclone copy to Google Drive
→ successful delivery
→ local retention
```

У KeePassXC есть отдельный backup-before-save: он сохраняет timestamped копию
при сохранении базы в приложении. Плановый snapshot нужен дополнительно, потому
что live-база может измениться через Syncthing без локального сохранения в
KeePassXC. Startup-проверка количества файлов не разрешает конфликты
одновременного редактирования; восстановление после такого конфликта описано
отдельно в [руководстве по синхронизации](../keepassxc-phone-sync/) и остаётся
PENDING.

## Пример layout и prerequisites

Пути ниже — пример, а не обязательная структура:

| Назначение | Пример |
|------------|--------|
| Live-каталог | `~/Documents/KeePassSync/` |
| Локальные backups | `~/Backups/KeePassXC/` |
| Remote-каталог | `gdrive:Backups/KeePassXC/` |

Перед использованием замени эти значения в командах и шаблонах на свой layout.
Для автоматизации нужны Gentoo с `systemd --user`, установленный KeePassXC
(`app-admin/keepassxc`), rclone, Google Drive с достаточной квотой и браузер
для первичной OAuth-авторизации. Live-каталог и механизм синхронизации подготовь
отдельно: wrapper не создаёт live-каталог и не настраивает Syncthing.

## Установка rclone

```bash
doas emerge --ask net-misc/rclone
```

## Google Drive и OAuth

Для долгосрочной автоматической доставки используй собственный Google OAuth
Desktop client. Общий Google Drive `client_id`, встроенный в rclone, выводится
из эксплуатации в течение 2026 года.

1. Выбери или создай Google Cloud project и включи Google Drive API.
2. Создай OAuth client типа Desktop app и укажи только нужный scope
   `https://www.googleapis.com/auth/drive.file`.
3. Авторизуй rclone через браузер и сохрани remote с собственными
   `client_id` и `client_secret`.
4. Для долгосрочного timer переведи External OAuth app в `In production`.
   Для Drive API refresh token External app в статусе `Testing` истекает через
   7 дней, поэтому этот режим не подходит для unattended backup.

Требования Google к публикации и branding меняются. Production-приложению
нужна публичная homepage на подтверждённом домене с описанием приложения и
ссылкой на privacy policy. Дополнительные branding-поля, включая Terms of
Service, заполняй по текущим требованиям Google и инструкции rclone. Не
используй чужие или не относящиеся к твоему приложению branding URL.

Scope `drive.file` даёт приложению доступ к созданным им файлам и каталогам.
rclone может не видеть объекты, созданные через веб-интерфейс Drive или другую
программу. Создай выделенный backup-каталог командой `rclone mkdir`; этот scope
не даёт доступ ко всему существующему дереву Google Drive.

Создай remote командой:

```bash
rclone config
```

Выбери Google Drive backend, введи собственные `client_id` / `client_secret`,
укажи scope `drive.file` и пройди авторизацию. Названия и порядок вопросов
rclone могут отличаться между версиями; сверяйся с его текущей инструкцией по
Google Drive.

Проверь путь к конфигу и его права:

```bash
config_file="$(rclone config file | tail -n 1)"
stat -c '%a %U:%G' "$config_file"
# ожидание: 600 <user>:<user>
```

Если права шире `600`, исправь их командой `chmod 600 "$config_file"`. Не
публикуй `rclone.conf`, OAuth access/refresh token, `client_secret` или
содержимое базы. Даже redacted вывод конфигурации проверь перед передачей
кому-либо: он не считается автоматически безопасным.

Создай remote-каталог для backups:

```bash
rclone mkdir gdrive:Backups/KeePassXC
```

### Проверка транспорта

Это setup-проверка транспорта с временным текстовым файлом. Намеренно запусти
её после настройки remote; не используй для теста KDBX:

```bash
test_file="$(mktemp /tmp/rclone-drive-test.XXXXXX.txt)"
test_name="${test_file##*/}"
printf 'rclone transport test\n' > "$test_file"
rclone copyto "$test_file" "gdrive:Backups/KeePassXC/$test_name"
rclone cat "gdrive:Backups/KeePassXC/$test_name"
rclone deletefile "gdrive:Backups/KeePassXC/$test_name"
rm -- "$test_file"
```

`rclone cat` должен вывести тестовую строку, а `deletefile` — удалить только
этот тестовый объект. Проверка меняет remote state. Не запускай её при
read-only проверке документации или во время обычного backup run.

## KeePassXC backup-before-save

Создай локальный каталог с доступом только своему пользователю:

```bash
mkdir -p "$HOME/Backups/KeePassXC"
chmod 700 "$HOME/Backups/KeePassXC"
```

В KeePassXC включи backup базы перед сохранением и задай destination. Путь
может быть абсолютным или относительным; относительный считается от каталога
базы. Для предсказуемого размещения используй абсолютный путь с собственным
каталогом backups, например:

```text
/home/<your-user>/Backups/KeePassXC/{DB_FILENAME}-{TIME:yyyy-MM-dd_HH-mm-ss}.kdbx
```

Замени `/home/<your-user>` на свой абсолютный home path. `{DB_FILENAME}` — имя
базы без расширения, `{TIME:<format>}` — время в заданном формате. После
сохранения базы KeePassXC создаёт отдельную timestamped копию. Этот механизм
срабатывает при save в KeePassXC; он не заменяет плановый snapshot изменений,
пришедших через Syncthing.

## Ручная доставка и проверка восстановления

Команда `rclone copy` передаёт новые и изменённые файлы, но не удаляет объекты
в destination, которых нет в source. Для этой схемы не используй `rclone sync`:
он синхронизирует destination с source и может удалять удалённые из source
файлы.

```bash
rclone copy \
  "$HOME/Backups/KeePassXC" \
  "gdrive:Backups/KeePassXC" \
  --include '/*.kdbx' \
  --max-depth 1
```

Для одного файла можно использовать `rclone copyto`:

```bash
backup_file="$HOME/Backups/KeePassXC/<backup-file>.kdbx"
rclone copyto "$backup_file" "gdrive:Backups/KeePassXC/${backup_file##*/}"
```

Плановая схема не удаляет старые remote backups и не выполняет remote rotation.
Это политика хранения, а не гарантия неизменяемости Google Drive: объект могут
изменить или удалить другими средствами.

Чтобы проверить восстановление, выбери backup и скачай его в отдельный файл:

```bash
backup_name='<chosen-backup>.kdbx'
restore_file="$(mktemp "$HOME/keepassxc-restore.XXXXXX.kdbx")"
rclone copyto "gdrive:Backups/KeePassXC/$backup_name" "$restore_file"
```

Открой временный файл в KeePassXC и проверь, что база разблокируется и содержит
ожидаемые данные. Только после этого решай, нужно ли заменять live-базу; первым
шагом не перезаписывай её. Восстановление backup не разрешает Syncthing
conflict/merge case — для него используй отдельную процедуру из руководства по
синхронизации.

## Локальная rotation

В примере ниже срок хранения — 90 дней по mtime. Рассматриваются только
top-level regular `*.kdbx`. Без аргумента script показывает кандидатов и ничего
не удаляет; удаление требует явного `--apply`.

Сохрани как `~/.local/bin/keepassxc-backup-rotate`:

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
    "") ;;
    --apply) apply=true ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
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
printf 'Candidates: %d\n' "${#candidates[@]}"

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

Установи права и сначала посмотри dry-run:

```bash
chmod 700 ~/.local/bin/keepassxc-backup-rotate
~/.local/bin/keepassxc-backup-rotate
```

Применяй удаление вручную только после проверки списка кандидатов:

```bash
~/.local/bin/keepassxc-backup-rotate --apply
```

## Плановый snapshot, доставка и systemd

Следующий wrapper использует примерные пути из таблицы выше. Перед установкой
отредактируй `live_dir`, `backup_dir` и `remote`. Он требует ровно одну
top-level regular non-symlink `*.kdbx` в live-каталоге: ноль или несколько
файлов приводят к abort до snapshot, delivery и rotation. Не удаляй лишнюю
базу автоматически: сначала выясни, откуда она взялась.

Этот startup conflict gate обнаруживает неоднозначный набор файлов, но не
разрешает одновременные изменения KeePassXC и Syncthing и не является
транзакционной блокировкой Syncthing. Non-blocking `flock` удерживается от
snapshot до завершения rotation, чтобы одновременно выполнялся только один
wrapper run. Если lock уже занят, новый запуск пропускается.

Wrapper создаёт local snapshot с mode `0600`, проверяет его побайтно через
`cmp` и удаляет неполный snapshot при ошибке. После успешной проверки выполняет
`rclone copy` только для top-level `*.kdbx`. Ошибка доставки прерывает run и
не запускает rotation; проверенный snapshot остаётся локально для следующей
попытки. Автоматического retry loop нет. Локальная rotation с `--apply`
запускается только после успешной доставки.

Сохрани как `~/.local/bin/keepassxc-backup-run`:

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${HOME:?HOME must be set}"
: "${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR must be set}"

# Example values: edit these paths for your layout.
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

snapshot_time="$(date '+%F_%H-%M-%S')"
if ! snapshot_path="$(mktemp "$backup_dir/keepassxc-snapshot-${snapshot_time}.XXXXXX.kdbx")"; then
    printf 'FAIL: cannot create local snapshot\n' >&2
    exit 1
fi
if ! cp -- "$live_db" "$snapshot_path"; then
    printf 'FAIL: cannot copy live database to snapshot\n' >&2
    exit 1
fi
if ! chmod 600 -- "$snapshot_path" || ! touch -- "$snapshot_path"; then
    printf 'FAIL: cannot secure snapshot\n' >&2
    exit 1
fi
if ! cmp -s -- "$live_db" "$snapshot_path"; then
    printf 'FAIL: snapshot does not match live database\n' >&2
    exit 1
fi
snapshot_verified=true

if ! rclone copy \
    "$backup_dir" \
    "$remote" \
    --include '/*.kdbx' \
    --max-depth 1
then
    printf 'FAIL: delivery failed; rotation skipped\n' >&2
    exit 1
fi

"$rotate" --apply
```

Установи wrapper с mode `0700` и создай user service:

```ini
# ~/.config/systemd/user/keepassxc-backup.service
[Unit]
Description=Deliver KeePassXC backups and rotate local history

[Service]
Type=oneshot
ExecStart=%h/.local/bin/keepassxc-backup-run
```

Пример timer запускает service ежедневно в 20:00 по местному времени. Выбери
подходящее тебе расписание:

```ini
# ~/.config/systemd/user/keepassxc-backup.timer
[Unit]
Description=Daily KeePassXC backup delivery

[Timer]
OnCalendar=*-*-* 20:00:00
Persistent=true
Unit=keepassxc-backup.service

[Install]
WantedBy=timers.target
```

Создай каталоги unit-файлов, выставь права и включи выбранный timer:

```bash
mkdir -p ~/.local/bin ~/.config/systemd/user
chmod 700 ~/.local/bin/keepassxc-backup-run
chmod 644 ~/.config/systemd/user/keepassxc-backup.service
chmod 644 ~/.config/systemd/user/keepassxc-backup.timer
systemctl --user daemon-reload
systemctl --user enable --now keepassxc-backup.timer
```

Для calendar timer `Persistent=true` означает, что при повторной активации
user manager он запустит пропущенный service, если за время бездействия
пропустилось хотя бы одно срабатывание. Это не повторяет service, который уже
запустился и завершился ошибкой: следующая попытка будет по следующему
расписанию или после ручного запуска.

`Linger` определяет, запускается ли user manager при загрузке и остаётся ли он
работать после logout. Это влияет на запуск user services без активной сессии;
значение `Linger` выбирай по требованиям системы, а не как универсальную
настройку для backup timer. Проверить расписание и состояние можно так:

```bash
systemctl --user status keepassxc-backup.timer
systemctl --user list-timers --all keepassxc-backup.timer
systemctl --user status keepassxc-backup.service
loginctl show-user "$USER" -p Linger
journalctl --user -u keepassxc-backup.service -n 30 --no-pager
```

Успешный `Type=oneshot` service обычно отображается как `inactive (dead)` после
завершения. Проверяй результат выполнения и записи журнала. Не запускай
повторный service, пока не выяснишь причину ошибки.

## Troubleshooting

### Wrapper сообщает, что live-база отсутствует или их несколько

**Симптом:** wrapper останавливается до snapshot.

**Причина:** ожидается ровно один top-level regular non-symlink `*.kdbx`.

**Действие:** проверь live-каталог и выясни причину отсутствия или появления
лишнего файла. Не удаляй conflict-copy автоматически и не выбирай её live-базой
без проверки.

### Не проходит доставка в Google Drive

При ошибке `rclone copy` локальная rotation не запускается, а snapshot остаётся
в backup-каталоге. Проверь имя remote и путь, OAuth-авторизацию, сеть и ошибки
квоты/API. Если rclone сообщает об expired или invalid token, повтори
авторизацию командой `rclone config reconnect gdrive:`. После устранения причины
следующий успешный `rclone copy` доставит оставшиеся файлы.

### Timer не сработал

Сначала проверь состояние units, ближайшие timer events и Linger:

```bash
systemctl --user status keepassxc-backup.timer
systemctl --user list-timers --all
loginctl show-user "$USER" -p Linger
```

Не начинай диагностику с `enable` или `start`: сначала выясни, почему расписание
не сработало и был ли активен user manager.

### Права файла rclone.conf слишком широкие

Проверь фактический путь командой `rclone config file` и права через `stat`.
Если config содержит credentials, доступ к файлу должен быть только у владельца
(`0600`). Не публикуй его содержимое.

## Отключение backup automation

Чтобы остановить расписание, отключи user timer:

```bash
systemctl --user disable --now keepassxc-backup.timer
```

В KeePassXC отдельно выключи backup-before-save, если он больше не нужен.
Удаление remote `gdrive` из локальной конфигурации командой
`rclone config delete gdrive` не удаляет файлы из Google Drive. Локальные и
remote backups остаются, пока ты отдельно не решишь удалить их.

## Related docs

- [Синхронизация KeePassXC с Android через Syncthing](../keepassxc-phone-sync/) — live sync и отдельная процедура conflict recovery.
- [Приложения ASUS ExpertBook B5402](../../systems/asus-b5402/applications/) — фактические параметры backup на эталонной системе.

## References

- [rclone: Google Drive](https://rclone.org/drive/) — OAuth client, scope и Google Drive backend.
- [rclone commands](https://rclone.org/commands/) — семантика `copy`, `copyto`, `sync` и команд настройки remote.
- [Google OAuth 2.0: refresh token expiration](https://developers.google.com/identity/protocols/oauth2) — ограничения статуса `Testing`.
- [Google OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies) — требования к homepage и branding production apps.
- [KeePassXC User Guide](https://keepassxc.org/docs/KeePassXC_UserGuide) — backup-before-save и filename placeholders.
- [systemd.timer](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html) и [loginctl](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html) — `Persistent` и Linger.
