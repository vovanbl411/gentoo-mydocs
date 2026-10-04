---
title: Подписание Git-коммитов через GPG
kind: guide
scope: general
status: current
last_verified: null
verified_on: []
---

Чтобы подписывать новые коммиты и получать `Verified` на forge, настрой
Git identity, выбери GPG signing key и добавь его публичную часть в аккаунт.
Email коммитера должен совпадать с email в UID ключа и принадлежать аккаунту.

Руководство рассчитано на Linux с установленными Git и GnuPG, доступным
секретным ключом для подписи и работающим pinentry для ввода passphrase.
Создание ключа описано в официальных инструкциях в конце страницы.
Раздел keyboxd применим только при использовании этого компонента GnuPG.

Все имена, email, numeric ID и fingerprint ниже — вымышленные примеры.
Замени их своими значениями. В командах `<fingerprint>` и `<PID>` —
placeholders: замени их целиком, вместе с угловыми скобками.

> **Важно**: public key можно публиковать. Private key и GPG passphrase
> нельзя загружать на GitHub/GitLab или публиковать; private key остаётся
> на локальной системе. Экспорт ниже выдаёт только публичную часть.

## 1. Что именно подписывается

- Git создаёт commit и записывает author/committer identity.
- GPG криптографически подписывает содержимое commit, включая эти поля.
- GitHub, GitLab или другой forge проверяет подпись и связывает её с аккаунтом
  по своим правилам.

Модель согласования email:

```text
Git commit email
        ↓
GPG UID email
        ↓
forge account email
```

Криптографически корректная подпись подтверждает, что commit подписан данным ключом.
Статус `Verified` дополнительно зависит от правил forge. Для GitHub и GitLab
важен email **коммитера**: он должен присутствовать в UID загруженного
публичного ключа и быть подтверждён в аккаунте. Для приватного email используй
адрес, выданный самим forge в настройках аккаунта; GitHub-пример ниже
не подходит для GitLab.
См. [правила GitHub](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/using-a-verified-email-address-in-your-gpg-key)
и [правила GitLab](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).

## 2. Базовая конфигурация Git

Файл: `~/.gitconfig`.

```ini
[user]
    name = Example User
    email = 123456+example@users.noreply.github.com
    signingkey = 0123456789ABCDEF0123456789ABCDEF01234567

[commit]
    gpgsign = true
```

Ту же настройку можно записать командами:

```bash
git config --global user.name 'Example User'
git config --global user.email '123456+example@users.noreply.github.com'
git config --global user.signingkey '0123456789ABCDEF0123456789ABCDEF01234567'
git config --global commit.gpgsign true
```

Глобальный config — базовый пример, а не обязательный выбор. Для одного
репозитория запусти команды внутри него с `--local` вместо `--global`.
Перед правкой сохрани прежние значения, чтобы при необходимости вернуть их.
`commit.gpgsign = true` включает подпись новых коммитов по умолчанию.

Пример предполагает OpenPGP — стандартный формат Git. Если раньше была
настроена SSH/X.509-подпись, выставь `gpg.format = openpgp` в выбранном scope.
Если Git вызывает другой исполняемый файл, проверь `gpg.program`.
Параметры описаны в [git-config](https://git-scm.com/docs/git-config).

## 3. Несколько UID у личного ключа

Один personal GPG key может иметь несколько UID:

```text
Example User <user@example.com>
Example User <123456+example@users.noreply.github.com>
```

Чтобы добавить второй email:

```bash
gpg --edit-key <fingerprint>
```

В интерактивной консоли:

```text
gpg> adduid
...
gpg> save
```

Вместо `...` ответь на вопросы GPG: имя `Example User`, новый email
`123456+example@users.noreply.github.com`, необязательный комментарий,
подтверждение UID и passphrase, если она запрошена.
После сохранения проверь UID и экспортируй обновлённый public key:

```bash
gpg --list-keys <fingerprint>
gpg --armor --export <fingerprint>
```

Заново загрузи/обнови публичную часть ключа в настройках GPG keys на каждом
forge, где нужна новая identity. Пока forge хранит старую копию, он не видит
новый UID. Если сервис не позволяет редактировать ключ, замени загруженную
публичную копию по его инструкции; GitLab требует удалить и добавить её снова.
См. [добавление UID в GitHub Docs](https://docs.github.com/en/authentication/managing-commit-signature-verification/associating-an-email-with-your-gpg-key)
и [управление GPG keys в GitLab](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/#add-a-gpg-key-to-your-account).

## 4. Личные и рабочие identities

- Для нескольких личных GitHub/GitLab identities один personal key с
  несколькими UID может быть разумным и простым решением. Проверь правила
  регистрации ключа для каждого аккаунта/forge.
- Для отдельного работодателя / corporate identity обычно удобнее отдельный
  signing key: срок действия, отзыв и смена работы не затрагивают личный ключ.
  Учитывай требования работодателя.

Это рекомендация по разделению lifecycle личной и рабочей identity.
Наличие нескольких UID у одного ключа само по себе не делает его небезопасным.

## 5. Автоматический выбор work identity через includeIf

Файл: `~/.gitconfig`.

```ini
[user]
    name = Example User
    email = 123456+example@users.noreply.github.com
    signingkey = PERSONAL_KEY_FINGERPRINT

[commit]
    gpgsign = true

[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work
```

Файл: `~/.gitconfig-work`.

```ini
[user]
    name = Example User
    email = user@company.example
    signingkey = WORK_KEY_FINGERPRINT
```

Замени `PERSONAL_KEY_FINGERPRINT` и `WORK_KEY_FINGERPRINT` полными fingerprint
соответствующих ключей. Размести `includeIf` после базовых значений.
Git автоматически применит рабочую identity к обычным репозиториям внутри
`~/work/`, включая вложенные каталоги; подпись останется включённой.

Условие проверяет расположение Git directory, поэтому для linked worktree
учитывается путь служебного каталога в основном репозитории. Локальные
настройки репозитория могут переопределить включённые значения: проверяй
эффективный config внутри целевого репозитория.
См. [conditional includes](https://git-scm.com/docs/git-config#_conditional_includes).
Для отката убери этот `includeIf` и восстанови прежнюю identity.

## 6. Verified, Unverified и bad_email

Типичный mismatch:

```text
commit email: 123456+example@users.noreply.github.com
GPG UID:     Example User <user@example.com>
```

Подпись существует и может быть криптографически корректной, но forge
не может сопоставить committer email с UID ключа. GitHub REST API обозначает
отсутствие committer email в identities ключа причиной `bad_email`;
это не универсальное имя ошибки всех forge.
См. [причины verification в GitHub API](https://docs.github.com/en/rest/commits/commits#get-a-commit).

Проверь ключ, источник текущей настройки и поля последнего commit:

```bash
gpg --list-keys <fingerprint>
git config --show-origin --get user.email
git log -1 --format='author:    %an <%ae>%ncommitter: %cn <%ce>'
```

Имя может отличаться; для этого mismatch важен email. Текущий `user.email`
не меняет уже созданный commit. Добавь нужный UID и обнови public key на forge
либо выбери для новых коммитов уже согласованный email. Если email есть в UID,
но не подтверждён в аккаунте, исправь это в настройках forge.

## 7. keyboxd и stale lock

Характерный тип сбоя:

```text
gpg: database_open ... waiting for lock (held by <PID>)
gpg: keydb_search failed: Connection timed out
gpg: signing failed: Connection timed out
```

keyboxd защищает key database lock-файлом. После некорректного завершения
процесса может остаться stale lock, блокирующий следующий процесс.
Сам timeout ещё не доказывает stale lock: сначала установи владельца.
Пути ниже предполагают стандартный GnuPG home `~/.gnupg`; при другом
`GNUPGHOME` используй соответствующие пути.

Сначала собери данные, подставив PID из сообщения / lock-файла:

```bash
ps -o pid,ppid,user,stat,lstart,etime,cmd -p <PID>
pgrep -a -u "$USER" -f 'gpg|keyboxd|dirmngr|pinentry'
cat ~/.gnupg/public-keys.d/pubring.db.lock 2>/dev/null
ls -la ~/.gnupg/public-keys.d/
```

> **Важно**: не начинай с `rm` lock-файлов и не используй `kill -9` без
> установления владельца lock. Снятие активной блокировки может нарушить
> работу с базой.

Проверь PID и hostname в lock-файле. Отсутствие PID на текущей машине
недостаточно, если каталог используется другим хостом или PID namespace.
Если процесс существует, проверь его владельца, команду и время старта;
PID мог быть переиспользован. При активной операции дождись её завершения.

Только если PID из `pubring.db.lock` больше не существует в соответствующей
среде, lock доказанно stale и база не используется, выполни:

```bash
gpgconf --kill keyboxd
gpgconf --unlock pubring.db
```

Перед unlock повторно проверь список процессов: keyboxd должен быть остановлен,
а другие клиенты не должны запускать его параллельно. Следующая обычная GPG
operation, например `gpg --list-keys <fingerprint>`, автоматически поднимет
keyboxd снова при стандартном включённом автозапуске. Затем повтори проверку
подписи из следующего раздела.
Штатная команда описана в [gpgconf](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html).

Файлы `.#lk*` — служебные temporary lock files dotlock-механизма; после
некорректного cleanup старые экземпляры иногда остаются. Это не `pubring.db`
и не ключи. Массовое удаление `.#lk*` не является обычной процедурой;
используй штатный unlock после диагностики. Если timeout остаётся,
повтори сбор данных, не удаляй базу или ключи.
Механизм описан в [upstream dotlock.c](https://github.com/gpg/gnupg/blob/master/common/dotlock.c).

## 8. Проверка результата

Выполняй проверки в целевом репозитории, от обычного пользователя:

- [ ] Секретный ключ доступен для подписи:

  ```bash
  gpg --list-secret-keys <fingerprint>
  ```

- [ ] Эффективные настройки выбирают нужные email, key и формат OpenPGP:

  ```bash
  git config --show-origin --get-regexp \
    '^(user\.email|user\.signingkey|commit\.gpgsign|gpg\.program|gpg\.format)$'
  ```

  Отсутствие `gpg.program` и `gpg.format` нормально при стандартных значениях.

- [ ] Пробная подпись завершается без ошибки; введи passphrase в pinentry,
  если запрошена:

  ```bash
  printf 'GPG signing test\n' |
      gpg --armor --detach-sign \
          --local-user <fingerprint> \
          >/dev/null
  ```

- [ ] Последний commit действительно подписан, а локальная проверка успешна:

  ```bash
  git log --show-signature -1
  ```

  Ожидай `Good signature`. Предупреждение о доверии к владельцу ключа —
  отдельный вопрос локальной модели доверия GPG.

- [ ] После следующего подписанного commit и push forge показывает `Verified`,
  если email/key/account identities согласованы, public key загружен,
  ключ действителен и остальные требования forge выполнены.

Не переписывай существующую Git history только ради старых `Unverified`
коммитов без отдельного требования. Для отмены настройки подписи восстанови
прежние значения Git config в том же scope; ключи удалять не требуется.

## 9. Официальные источники и границы проверки

Технические правила сверены с официальной документацией 2026-10-04.
Команды на живом keyring не выполнялись; `last_verified: null` и
`verified_on: []` не заявляют проверку на эталонной системе.

- [Git: git-config](https://git-scm.com/docs/git-config).
- [GitHub: создание GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key).
- [GitHub: добавление public key в аккаунт](https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account).
- [GitLab: GPG signing](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).
- [GnuPG: gpgconf, включая kill и unlock](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html).
