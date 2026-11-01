---
title: Подписание Git-коммитов через GPG
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: []
---

Настройка ниже включает подпись новых коммитов через OpenPGP/GnuPG. Для
статуса `Verified` на GitHub или GitLab также должны совпасть требования forge
к публичному ключу, committer email и аккаунту.

Руководство рассчитано на Linux с установленными Git и GnuPG, доступным
секретным ключом для подписи и работающим pinentry для ввода passphrase.
Создание ключа описано в официальных инструкциях в конце страницы. Раздел
про keyboxd применим только тогда, когда GnuPG использует этот компонент.

Все имена, email, numeric ID и fingerprint в примерах вымышлены. Заменяй их
своими значениями. В командах `<fingerprint>` и `<PID>` — placeholders:
заменяй их целиком, вместе с угловыми скобками.

> **Важно**: public key можно публиковать. Private key и GPG passphrase нельзя
> загружать на GitHub/GitLab или публиковать; private key остаётся на локальной
> системе. Команда экспорта ниже выдаёт только публичную часть.

## 1. Что подписывается

- Git записывает в commit identity автора (`author`) и коммитера (`committer`).
  Они могут отличаться, например, при применении чужого патча.
- При создании подписанного commit подпись создаёт committer. Она покрывает
  commit, в том числе поля author и committer.
- Локальная проверка подтверждает, что подпись commit криптографически
  корректна для соответствующего ключа. Она сама по себе не устанавливает
  аккаунт на GitHub/GitLab и не подтверждает согласие отличающегося автора.

Сопоставление identity для forge выглядит так:

```text
Git committer email
        ↓
email в UID OpenPGP key
        ↓
verified email и account rules forge
```

GitHub и GitLab проверяют именно email коммитера по своим правилам. Локальный
вывод `Good signature` не гарантирует статус `Verified` на forge: публичный
ключ, committer email и подтверждённый email аккаунта должны быть согласованы.
Правила описаны в документации [GitHub](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/using-a-verified-email-address-in-your-gpg-key)
и [GitLab](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).

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

Fingerprint в примере вымышленный. Адрес `123456+example@users.noreply.github.com`
показывает формат GitHub noreply и относится только к GitHub; для GitLab
используй verified email аккаунта. Если не хочешь раскрывать обычный адрес,
можно использовать выданный GitLab private commit email.

Те же настройки можно задать командами:

```bash
git config --global user.name 'Example User'
git config --global user.email '123456+example@users.noreply.github.com'
git config --global user.signingkey '0123456789ABCDEF0123456789ABCDEF01234567'
git config --global commit.gpgsign true
```

Глобальная конфигурация — пример, а не обязательный scope. Для одного
репозитория выполняй команды внутри него с `--local`. Локальная конфигурация
репозитория может переопределить глобальные значения; проверяй эффективные
настройки внутри целевого репозитория через `git config --show-origin`.

Полный fingerprint помогает точно выбрать нужный ключ; Git также принимает
другие идентификаторы ключа, поддерживаемые GnuPG. Не копируй в конфигурацию
чужие или реальные fingerprint из примеров.

Git по умолчанию использует `gpg.format = openpgp`, поэтому для стандартной
OpenPGP-настройки явно задавать этот параметр не обязательно. Добавь его в
нужный scope, если раньше выбирался другой формат, например SSH или X.509:

```ini
[gpg]
    format = openpgp
```

`gpg.program` — legacy alias для `gpg.openpgp.program`. Обычно менять его не
нужно; проверь параметр, если Git должен вызывать другую совместимую программу.
См. [git-config](https://git-scm.com/docs/git-config).

`commit.gpgsign = true` включает подпись создаваемых после этого новых
коммитов. Эта настройка не переписывает уже существующую историю.

## 3. Несколько UID у личного ключа

У одного личного OpenPGP key может быть несколько UID с разными email:

```text
Example User <user@example.com>
Example User <123456+example@users.noreply.github.com>
```

Второй адрес в примере — GitHub-specific noreply email. Чтобы добавить UID:

```bash
gpg --edit-key <fingerprint>
```

В интерактивной консоли:

```text
gpg> adduid
...
gpg> save
```

Вместо `...` ответь на запросы GPG: укажи имя, новый email, необязательный
комментарий и подтверди UID. После сохранения проверь UID и экспортируй
обновлённый public key:

```bash
gpg --list-keys <fingerprint>
gpg --armor --export <fingerprint>
```

Обнови публичную копию ключа на каждом forge, где нужна новая identity. Пока
forge хранит прежнюю копию, он не увидит добавленный UID. В GitLab загруженный
ключ нельзя редактировать: удали его из аккаунта и добавь обновлённую копию.
См. [добавление UID в GitHub](https://docs.github.com/en/authentication/managing-commit-signature-verification/associating-an-email-with-your-gpg-key)
и [управление GPG keys в GitLab](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).

## 4. Личные и рабочие identities

- Несколько личных email в одном ключе позволяют использовать одну identity
  для разных адресов. Само по себе это не проблема безопасности; проверь
  правила регистрации ключей для каждого аккаунта и forge.
- Для отдельной корпоративной identity отдельный ключ может упростить срок
  действия, отзыв и смену работы. Это рекомендация, а не универсальное
  требование; учитывай правила организации.

## 5. Выбор work identity через includeIf

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

Замени `PERSONAL_KEY_FINGERPRINT` и `WORK_KEY_FINGERPRINT` на fingerprint
соответствующих ключей. Условие `gitdir:` сопоставляет шаблон с расположением
Git directory. Завершающий `/` в этом примере распространяет его на Git
directory внутри `~/work/` и вложенных каталогов. Git вставляет включённые
значения в месте директивы, поэтому размести `includeIf` после базовых
значений.

Локальный config целевого репозитория может переопределить включённые
значения. Проверяй эффективные параметры из самого репозитория с помощью
`git config --show-origin`. Для отката удали директиву `includeIf` и восстанови
прежнюю identity. См. [conditional includes в Git](https://git-scm.com/docs/git-config#_conditional_includes).

## 6. Статусы GitHub, GitLab и `bad_email`

Без включённого GitHub Vigilant Mode:

- `Verified` — commit подписан, подпись успешно проверена.
- `Unverified` — commit подписан, но подпись не удалось проверить.
- Для неподписанного commit статус проверки не показывается.

При включённом Vigilant Mode GitHub также показывает `Partially verified`.
Он возможен, когда подпись криптографически проверена, но автор, отличный от
committer, включил Vigilant Mode: подпись committer не подтверждает согласие
этого автора. Подробности — в документации GitHub о
[verification statuses](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
и [Vigilant Mode](https://docs.github.com/en/authentication/managing-commit-signature-verification/displaying-verification-statuses-for-all-of-your-commits).

GitHub REST API использует `bad_email`, если committer email commit не входит
в identities PGP key, которым подписан commit. Это GitHub-specific API reason,
а не универсальная ошибка GPG, Git или GitLab. Другие причины GitHub включают
неподтверждённый email аккаунта и отсутствие связанного пользователя. См.
[verification reasons в GitHub REST API](https://docs.github.com/en/rest/commits/commits#list-commits).

Для GitLab `Verified` требует, чтобы:

- public key был загружен в аккаунт GitLab;
- email в UID ключа совпадал с verified email аккаунта;
- committer email commit совпадал с этим verified email;
- для проверки не использовался revoked UID — GitLab игнорирует его email.

Чтобы не раскрывать обычный адрес в commit, GitLab позволяет использовать
выданный аккаунту [private commit email](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).
Не подставляй вместо него GitHub noreply address.

## 7. keyboxd и stale lock

Этот раздел применим только если GnuPG использует keyboxd, включённый
параметром `use-keyboxd` в `common.conf`. Путь
`~/.gnupg/public-keys.d/pubring.db.lock` относится к keyboxd database layout
при стандартном GnuPG home. Для другого `GNUPGHOME`, backend или версии пути
могут отличаться.

Характерная ошибка:

```text
gpg: database_open ... waiting for lock (held by <PID>)
gpg: keydb_search failed: Connection timed out
gpg: signing failed: Connection timed out
```

Timeout сам по себе не доказывает, что lock устарел. Сначала установи его
владельца. Подставь PID из сообщения или lock-файла:

```bash
ps -o pid,ppid,user,stat,lstart,etime,cmd -p <PID>
pgrep -a -u "$USER" -f 'gpg|keyboxd|dirmngr|pinentry'
cat ~/.gnupg/public-keys.d/pubring.db.lock 2>/dev/null
ls -la ~/.gnupg/public-keys.d/
```

Сверь PID и hostname в lock-файле с процессами в соответствующем host и PID
namespace. Отсутствие PID на текущей машине недостаточно, если каталог мог
использоваться другим host или namespace. PID мог быть переиспользован, поэтому
проверь владельца процесса, команду и время запуска. Если операция ещё идёт,
дождись её завершения.

> **Важно**: не начинай с удаления lock-файлов через `rm` и не применяй
> `kill -9`, пока не установлен владелец блокировки: снятие активного lock
> может повредить операцию с базой. Массовое удаление файлов `.#lk*` также не
> является обычным решением.

`gpgconf --kill keyboxd` не входит в обычное восстановление stale lock. Если
отдельная диагностика показала, что перед снятием блокировки нужно остановить
работающий keyboxd, сначала убедись, что нет активных операций и другие клиенты
не запустят демон параллельно:

```bash
gpgconf --kill keyboxd
```

Если ручное снятие доказанно stale lock необходимо, а защищаемый файл точно не
используется, выполни только штатную команду unlock:

```bash
gpgconf --unlock pubring.db
```

`gpgconf --unlock` удаляет stale lock для указанного файла. Обычно эта команда
не нужна: GnuPG умеет находить и удалять stale locks самостоятельно. Перед
unlock убедись, что защищаемый файл действительно не используется. См.
[gpgconf](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html)
и [upstream README GnuPG](https://github.com/gpg/gnupg/blob/master/README).

## 8. Проверка результата

Выполняй проверки в целевом репозитории:

- Убедись, что настроены ожидаемые email, ключ и параметры подписи. Команда
  показывает значения Git config; не публикуй её вывод без проверки:

  ```bash
  git config --show-origin --get-regexp \
    '^(user\.email|user\.signingkey|commit\.gpgsign|gpg\.program|gpg\.format)$'
  ```

- Проверь, что секретный ключ доступен для подписи:

  ```bash
  gpg --list-secret-keys <fingerprint>
  ```

- Проверь существующий подписанный commit локально:

  ```bash
  git log --show-signature -1
  ```

  Для подписанного `HEAD` также можно выполнить `git verify-commit HEAD`.
  Ожидаемый результат `Good signature` подтверждает криптографическую
  проверку локальным GnuPG. Предупреждение о доверии к владельцу ключа относится
  к локальной модели trust GnuPG и не определяет статус GitHub/GitLab.

- После следующего обычного подписанного commit и push проверь статус на
  выбранном forge. Не нужно создавать commit только ради проверки этого
  руководства.

Не переписывай существующую историю только ради исправления старых коммитов
со статусом `Unverified` без отдельного требования. Чтобы отменить настройку,
восстанови прежние значения Git config в том же scope; удалять ключ не нужно.

## 9. Официальные источники

- [Git: git-config](https://git-scm.com/docs/git-config).
- [GitHub: создание нового GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key).
- [GitHub: проверенный email в GPG key](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/using-a-verified-email-address-in-your-gpg-key).
- [GitHub: добавление GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account).
- [GitHub: статусы проверки commit signature](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification).
- [GitHub: Vigilant Mode](https://docs.github.com/en/authentication/managing-commit-signature-verification/displaying-verification-statuses-for-all-of-your-commits).
- [GitHub REST API: verification reasons](https://docs.github.com/en/rest/commits/commits#list-commits).
- [GitLab: GPG commit signing](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).
- [GnuPG: configuration files](https://gnupg.org/documentation/manuals/gnupg/GPG-Configuration.html).
- [GnuPG: gpgconf](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html).
- [GnuPG upstream README](https://github.com/gpg/gnupg/blob/master/README).
