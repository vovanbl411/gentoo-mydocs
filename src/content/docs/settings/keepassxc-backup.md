---
title: Резервные копии KeePassXC в Google Drive через rclone
kind: guide
scope: general
status: current
last_verified: "2026-09-29"
verified_on: [asus-b5402]
---

Гайд настраивает двухуровневую схему резервных копий KeePassXC: встроенные
timestamped копии перед каждым сохранением базы плюс ручная доставка их в
Google Drive через rclone. Результат: при повреждении живой базы или потере
машины база восстановима из локального каталога и из облака, а доставка в
облако не удаляет старые копии.

Схема применима на любой системе с KeePassXC и rclone. Локальная 90-day
rotation входит в принятую схему; automation и timers здесь не
рассматриваются и пока не реализованы.

На ASUS ExpertBook B5402 2026-09-28 проверены локальные timestamped
backups KeePassXC, права каталога `0700`, remote `gdrive:` с собственным
OAuth Desktop client и scope `drive.file`, а также загрузка и скачивание
реального KDBX без изменения байтов. 2026-09-29 OAuth-приложение переведено
в статус *In production*, существующий remote повторно авторизован
(`rclone config reconnect gdrive:` — PASS), а post-reauth transport
validation прошла: list, upload временного текстового объекта, read с
ожидаемым содержимым, deletefile и повторный list без этого объекта.
2026-09-29 production acceptance локальной rotation завершён (PASS):
`~/.local/bin/keepassxc-backup-rotate` установлен и проверен на production
каталоге. Актуальное состояние машины см. в
[системном разделе](../../systems/asus-b5402/applications/).

## Architecture

```text
KeePassXC
  ↓ встроенный backup перед сохранением базы
~/Backups/KeePassXC/           timestamped .kdbx, directory mode 0700
  ↓ rclone copy / copyto (вручную)
gdrive:Backups/KeePassXC/      backup destination, доставка без удаления
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

- локальная история: хранить backups за последние 90 дней;
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
- controlled production acceptance подтвердил dry-run с сохранением
  candidate, удаление только этого expired KDBX через `--apply`, сохранность
  non-KDBX control и неизменность реального KDBX по SHA-256;
- механизм запускается вручную. Scheduler/delivery automation ещё не
  реализованы; удаления на remote нет.

> ⚠️ **Важный нюанс**: local retention mechanism уже существует, но пока
> запускается вручную. Без запуска с `--apply` локальный каталог продолжит
> расти. Remote продолжает расти по принятой политике: remote deletion и
> rotation намеренно не выполняются.

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

## Что намеренно не используется

| Подход | Почему не используется |
|--------|------------------------|
| `rclone mount`, FUSE, VFS cache | Google Drive — не live filesystem для открытой базы: cache-слой и рассинхронизация добавляют режим отказа, которого нет при копировании закрытых файлов. |
| Постоянно смонтированный Drive | То же, плюс база не должна открываться с сетевого «диска». |
| `rclone sync` | `sync` удаляет в destination файлы, отсутствующие в source, — удаляет старые remote-копии и ломает схему доставки без удаления. |
| Git/GitHub как live sync KDBX | Бинарный секрет в VCS расширяет поверхность распространения и не даёт истории версий внутри базы. |

## Ограничения и следующие этапы

Отдельными следующими этапами остаются:

- automation вызова local rotation и доставки — отдельный design-этап;
  решение о конкретном scheduler пока не принято (systemd user timer —
  только пример возможного варианта);
- синхронизация базы с телефоном после проработки автоматизации.

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
