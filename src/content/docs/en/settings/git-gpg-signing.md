---
title: Signing Git commits with GPG
kind: guide
scope: general
status: current
last_verified: null
verified_on: []
---

To sign new commits and get `Verified` on a forge, configure your Git identity,
select a GPG signing key, and add its public part to your account.
The committer email must match an email in a key UID and belong to the account.

This guide is for Linux with Git and GnuPG installed, an available secret
signing key, and working pinentry for entering the passphrase.
Key creation is covered by the official instructions at the end of this page.
The keyboxd section applies only when using that GnuPG component.

All names, emails, numeric IDs, and fingerprints below are fictional examples.
Replace them with your own values. In commands, `<fingerprint>` and `<PID>`
are placeholders: replace them entirely, including the angle brackets.

> **Important**: you can publish the public key. Never upload the private key
> or GPG passphrase to GitHub/GitLab or publish them; the private key stays
> on the local system. The export below outputs only the public part.

## 1. What is signed

- Git creates a commit and records the author/committer identity.
- GPG cryptographically signs the commit contents, including those fields.
- GitHub, GitLab, or another forge verifies the signature and associates it
  with an account according to its own rules.

The email matching model:

```text
Git commit email
        ↓
GPG UID email
        ↓
forge account email
```

A cryptographically valid signature confirms signing by that key.
The `Verified` status also depends on the forge's rules. For GitHub and GitLab,
the **committer** email matters: it must appear in a UID of the uploaded
public key and be verified on the account. For a private email, use
the address issued by the forge itself in your account settings; the GitHub
example below does not apply to GitLab.
See the [GitHub rules](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/using-a-verified-email-address-in-your-gpg-key)
and [GitLab rules](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).

## 2. Basic Git configuration

File: `~/.gitconfig`.

```ini
[user]
    name = Example User
    email = 123456+example@users.noreply.github.com
    signingkey = 0123456789ABCDEF0123456789ABCDEF01234567

[commit]
    gpgsign = true
```

You can write the same settings with commands:

```bash
git config --global user.name 'Example User'
git config --global user.email '123456+example@users.noreply.github.com'
git config --global user.signingkey '0123456789ABCDEF0123456789ABCDEF01234567'
git config --global commit.gpgsign true
```

Global config is a basic example, not a required choice. For one repository,
run the commands inside it with `--local` instead of `--global`.
Before editing, save the previous values so you can restore them if needed.
`commit.gpgsign = true` enables signing new commits by default.

The example assumes OpenPGP, Git's default format. If SSH/X.509 signing was
configured previously, set `gpg.format = openpgp` in the selected scope.
If Git invokes a different executable, check `gpg.program`.
The options are documented in [git-config](https://git-scm.com/docs/git-config).

## 3. Multiple UIDs on a personal key

One personal GPG key can have multiple UIDs:

```text
Example User <user@example.com>
Example User <123456+example@users.noreply.github.com>
```

To add a second email:

```bash
gpg --edit-key <fingerprint>
```

In the interactive console:

```text
gpg> adduid
...
gpg> save
```

In place of `...`, answer GPG's prompts: the name `Example User`, the new email
`123456+example@users.noreply.github.com`, an optional comment,
UID confirmation, and the passphrase if requested.
After saving, check the UIDs and export the updated public key:

```bash
gpg --list-keys <fingerprint>
gpg --armor --export <fingerprint>
```

Re-upload/update the public part of the key in the GPG keys settings of every
forge where the new identity is needed. While a forge stores the old copy,
it cannot see the new UID. If the service does not allow editing a key,
replace the uploaded public copy according to its instructions; GitLab
requires removing and adding it again.
See [adding a UID in GitHub Docs](https://docs.github.com/en/authentication/managing-commit-signature-verification/associating-an-email-with-your-gpg-key)
and [managing GPG keys in GitLab](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/#add-a-gpg-key-to-your-account).

## 4. Personal and work identities

- For multiple personal GitHub/GitLab identities, one personal key with
  multiple UIDs can be a reasonable, simple solution. Check key registration
  rules for each account/forge.
- For a separate employer / corporate identity, a separate signing key is
  usually easier to manage: expiration, revocation, and changing jobs do not
  affect the personal key. Follow your employer's requirements.

This is a recommendation for separating the lifecycles of personal and work
identities. Multiple UIDs on one key do not by themselves make it unsafe.

## 5. Selecting the work identity automatically with includeIf

File: `~/.gitconfig`.

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

File: `~/.gitconfig-work`.

```ini
[user]
    name = Example User
    email = user@company.example
    signingkey = WORK_KEY_FINGERPRINT
```

Replace `PERSONAL_KEY_FINGERPRINT` and `WORK_KEY_FINGERPRINT` with the full
fingerprints of the corresponding keys. Place `includeIf` after the base values.
Git automatically applies the work identity to ordinary repositories inside
`~/work/`, including nested directories; signing remains enabled.

The condition checks the Git directory location, so for a linked worktree
it uses the administrative directory path in the main repository. Local
repository settings can override the included values: check the effective
config inside the target repository.
See [conditional includes](https://git-scm.com/docs/git-config#_conditional_includes).
To roll back, remove this `includeIf` and restore the previous identity.

## 6. Verified, Unverified, and bad_email

A typical mismatch:

```text
commit email: 123456+example@users.noreply.github.com
GPG UID:     Example User <user@example.com>
```

The signature exists and can be cryptographically valid, but the forge
cannot match the committer email to a key UID. The GitHub REST API reports
a committer email missing from the key identities as `bad_email`;
this is not a universal error name across forges.
See [verification reasons in the GitHub API](https://docs.github.com/en/rest/commits/commits#get-a-commit).

Check the key, the source of the current setting, and the last commit's fields:

```bash
gpg --list-keys <fingerprint>
git config --show-origin --get user.email
git log -1 --format='author:    %an <%ae>%ncommitter: %cn <%ce>'
```

The name can differ; the email matters for this mismatch. The current
`user.email` does not change an existing commit. Add the required UID and update
the public key on the forge, or choose an already matched email for new commits.
If the email is in a UID but is not verified on the account, fix that in the
forge settings.

## 7. keyboxd and stale locks

A characteristic failure pattern:

```text
gpg: database_open ... waiting for lock (held by <PID>)
gpg: keydb_search failed: Connection timed out
gpg: signing failed: Connection timed out
```

keyboxd protects the key database with a lock file. If a process exits
incorrectly, a stale lock can remain and block the next process.
A timeout alone does not prove a stale lock: establish the owner first.
The paths below assume the default GnuPG home `~/.gnupg`; for a different
`GNUPGHOME`, use the corresponding paths.

First collect evidence, substituting the PID from the message / lock file:

```bash
ps -o pid,ppid,user,stat,lstart,etime,cmd -p <PID>
pgrep -a -u "$USER" -f 'gpg|keyboxd|dirmngr|pinentry'
cat ~/.gnupg/public-keys.d/pubring.db.lock 2>/dev/null
ls -la ~/.gnupg/public-keys.d/
```

> **Important**: do not start by using `rm` on lock files or use `kill -9`
> without establishing the lock owner. Removing an active lock can disrupt
> database operations.

Check the PID and hostname in the lock file. A missing PID on the current
machine is insufficient if another host or PID namespace uses the directory.
If the process exists, check its owner, command, and start time;
the PID may have been reused. If an operation is active, wait for it to finish.

Only when the PID from `pubring.db.lock` no longer exists in the relevant
environment, the lock is proven stale, and the database is not in use, run:

```bash
gpgconf --kill keyboxd
gpgconf --unlock pubring.db
```

Before unlocking, check the process list again: keyboxd must be stopped,
and other clients must not launch it concurrently. The next normal GPG
operation, such as `gpg --list-keys <fingerprint>`, automatically starts
keyboxd again with the default autostart enabled. Then repeat the signing
check from the next section.
The supported command is documented in [gpgconf](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html).

The `.#lk*` files are temporary lock files used by the dotlock mechanism;
old instances can sometimes remain after incorrect cleanup. They are neither
`pubring.db` nor keys. Bulk deletion of `.#lk*` is not a routine procedure;
use the supported unlock command after diagnosis. If the timeout persists,
collect evidence again; do not delete the database or keys.
The mechanism is described in [upstream dotlock.c](https://github.com/gpg/gnupg/blob/master/common/dotlock.c).

## 8. Validating the result

Run the checks in the target repository as an ordinary user:

- [ ] The secret key is available for signing:

  ```bash
  gpg --list-secret-keys <fingerprint>
  ```

- [ ] The effective settings select the required email, key, and OpenPGP format:

  ```bash
  git config --show-origin --get-regexp \
    '^(user\.email|user\.signingkey|commit\.gpgsign|gpg\.program|gpg\.format)$'
  ```

  Missing `gpg.program` and `gpg.format` entries are normal with default values.

- [ ] A test signature succeeds; enter the passphrase in pinentry if requested:

  ```bash
  printf 'GPG signing test\n' |
      gpg --armor --detach-sign \
          --local-user <fingerprint> \
          >/dev/null
  ```

- [ ] The last commit is signed and local verification succeeds:

  ```bash
  git log --show-signature -1
  ```

  Expect `Good signature`. A warning about trust in the key owner is a separate
  aspect of GPG's local trust model.

- [ ] After the next signed commit and push, the forge shows `Verified` if the
  email/key/account identities match, the public key is uploaded, the key
  is valid, and the forge's other requirements are met.

Do not rewrite existing Git history just to fix old `Unverified` commits
without a separate requirement. To undo signing configuration, restore
the previous Git config values in the same scope; no key deletion is needed.

## 9. Official sources and verification limits

The technical rules were checked against official documentation on 2026-10-04.
No commands were run against a live keyring; `last_verified: null` and
`verified_on: []` do not claim testing on the reference system.

- [Git: git-config](https://git-scm.com/docs/git-config).
- [GitHub: generating a GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key).
- [GitHub: adding a public key to an account](https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account).
- [GitLab: GPG signing](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).
- [GnuPG: gpgconf, including kill and unlock](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html).
