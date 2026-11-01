---
title: Signing Git commits with GPG
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: []
---

This setup signs new commits with OpenPGP/GnuPG. To get `Verified` on GitHub
or GitLab, the forge's requirements for the public key, committer email, and
account must also be met.

This guide is for Linux with Git and GnuPG installed, an available secret
signing key, and working pinentry for entering the passphrase. Key creation is
covered by the official instructions at the end of this page. The keyboxd
section applies only when GnuPG uses that component.

All names, email addresses, numeric IDs, and fingerprints in the examples are
fictional. Replace them with your own values. In commands, `<fingerprint>` and
`<PID>` are placeholders; replace them entirely, including the angle brackets.

> **Important**: you can publish the public key. Never upload the private key
> or GPG passphrase to GitHub/GitLab or publish them; the private key stays on
> the local system. The export command below outputs only the public part.

## 1. What is signed

- Git records the author and committer identities in a commit. They may differ,
  for example when applying someone else's patch.
- When creating a signed commit, the committer creates the signature. It covers
  the commit, including its author and committer fields.
- Local verification confirms that the commit signature is cryptographically
  valid for the corresponding key. It does not identify a GitHub/GitLab account
  by itself or confirm the consent of an author who differs from the committer.

The forge matches identities like this:

```text
Git committer email
        ↓
email in the OpenPGP key UID
        ↓
verified email and forge account rules
```

GitHub and GitLab check the committer email according to their own rules. A
local `Good signature` does not guarantee `Verified` on a forge: the public
key, committer email, and the account's verified email must match its rules.
See the [GitHub](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/using-a-verified-email-address-in-your-gpg-key)
and [GitLab](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/)
documentation.

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

The fingerprint is fictional. The address `123456+example@users.noreply.github.com`
shows the GitHub noreply format and is GitHub-specific. For GitLab, use the
account's verified email. If you do not want to expose your regular address,
you can use the GitLab private commit email issued for your account.

You can set the same values with commands:

```bash
git config --global user.name 'Example User'
git config --global user.email '123456+example@users.noreply.github.com'
git config --global user.signingkey '0123456789ABCDEF0123456789ABCDEF01234567'
git config --global commit.gpgsign true
```

Global configuration is an example, not a required scope. For one repository,
run the commands inside it with `--local`. Repository-local configuration can
override global values; check the effective settings from the target repository
with `git config --show-origin`.

A full fingerprint helps select the intended key precisely. Git also accepts
other key identifiers supported by GnuPG. Do not copy real fingerprints from
other people's configurations or examples.

Git defaults to `gpg.format = openpgp`, so you do not need to set it explicitly
for a standard OpenPGP setup. Set it in the relevant scope if a different format,
such as SSH or X.509, was configured previously:

```ini
[gpg]
    format = openpgp
```

`gpg.program` is a legacy alias for `gpg.openpgp.program`. You normally do not
need to change it; check it if Git should call a different compatible program.
See [git-config](https://git-scm.com/docs/git-config).

`commit.gpgsign = true` enables signing for new commits created after the
setting takes effect. It does not rewrite existing history.

## 3. Multiple UIDs on a personal key

One personal OpenPGP key can have multiple UIDs with different email addresses:

```text
Example User <user@example.com>
Example User <123456+example@users.noreply.github.com>
```

The second address is a GitHub-specific noreply email. To add a UID:

```bash
gpg --edit-key <fingerprint>
```

In the interactive console:

```text
gpg> adduid
...
gpg> save
```

In place of `...`, answer GPG's prompts: enter a name, the new email, and an
optional comment, then confirm the UID. After saving, check the UIDs and export
the updated public key:

```bash
gpg --list-keys <fingerprint>
gpg --armor --export <fingerprint>
```

Update the public copy of the key on each forge where you need the new identity.
Until the forge has the updated copy, it cannot see the added UID. GitLab does
not let you edit an uploaded key; remove it from the account and add the updated
copy. See [adding a UID on GitHub](https://docs.github.com/en/authentication/managing-commit-signature-verification/associating-an-email-with-your-gpg-key)
and [managing GPG keys on GitLab](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).

## 4. Personal and work identities

- Multiple personal email addresses in one key let you use one identity with
  different addresses. This is not a security problem by itself; check key
  registration rules for each account and forge.
- A separate key for a corporate identity can make expiration, revocation, and
  job changes easier to manage. This is a recommendation, not a universal
  requirement; follow your organization's rules.

## 5. Selecting a work identity with includeIf

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

Replace `PERSONAL_KEY_FINGERPRINT` and `WORK_KEY_FINGERPRINT` with the
fingerprints of the corresponding keys. The `gitdir:` condition matches the
pattern against the location of the Git directory. In this example, the
trailing `/` extends the match to Git directories inside `~/work/` and its
subdirectories. Git inserts included values where the directive appears, so
place `includeIf` after the base values.

The target repository's local config can override included values. Check the
effective settings from that repository with `git config --show-origin`. To
roll back, remove the `includeIf` directive and restore the previous identity.
See
[conditional includes in Git](https://git-scm.com/docs/git-config#_conditional_includes).

## 6. GitHub and GitLab statuses, and `bad_email`

Without GitHub Vigilant Mode:

- `Verified` means the commit is signed and the signature was verified.
- `Unverified` means the commit is signed but the signature could not be
  verified.
- Unsigned commits have no verification status.

With Vigilant Mode enabled, GitHub also shows `Partially verified`. This can
happen when a signature is cryptographically verified but an author who differs
from the committer has enabled Vigilant Mode: the committer's signature does not
confirm that author's consent. See GitHub's documentation on
[verification statuses](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
and [Vigilant Mode](https://docs.github.com/en/authentication/managing-commit-signature-verification/displaying-verification-statuses-for-all-of-your-commits).

The GitHub REST API uses `bad_email` when the commit's committer email is not
included in the identities of the PGP key that signed the commit. This is a
GitHub-specific API reason, not a general GPG, Git, or GitLab error. Other
GitHub reasons include an unverified account email or no associated user. See
[verification reasons in the GitHub REST API](https://docs.github.com/en/rest/commits/commits#list-commits).

For GitLab to mark a commit as verified:

- The public key must be uploaded to the GitLab account.
- An email in the key's UID must match a verified email on the account.
- The commit's committer email must match that verified email.
- A revoked UID cannot be used for verification; GitLab ignores its email.

To avoid exposing your regular email in commits, GitLab lets you use the
[private commit email](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/)
issued for your account. Do not substitute a GitHub noreply address.

## 7. keyboxd and stale locks

This section applies only when GnuPG uses keyboxd, enabled by the
`use-keyboxd` option in `common.conf`. The path
`~/.gnupg/public-keys.d/pubring.db.lock` belongs to the keyboxd database layout
with the default GnuPG home. Paths may differ with another `GNUPGHOME`, backend,
or version.

A characteristic error is:

```text
gpg: database_open ... waiting for lock (held by <PID>)
gpg: keydb_search failed: Connection timed out
gpg: signing failed: Connection timed out
```

A timeout alone does not prove that the lock is stale. Establish the owner
first. Substitute the PID from the message or lock file:

```bash
ps -o pid,ppid,user,stat,lstart,etime,cmd -p <PID>
pgrep -a -u "$USER" -f 'gpg|keyboxd|dirmngr|pinentry'
cat ~/.gnupg/public-keys.d/pubring.db.lock 2>/dev/null
ls -la ~/.gnupg/public-keys.d/
```

Compare the PID and hostname in the lock file with processes in the relevant
host and PID namespace. A PID missing from the current machine is not enough if
another host or namespace may have used the directory. The PID may have been
reused, so check the process owner, command, and start time. If an operation is
still running, wait for it to finish.

> **Important**: do not start by removing lock files with `rm` or using
> `kill -9` before identifying the lock owner; removing an active lock can
> disrupt database operations. Bulk deletion of `.#lk*` files is not a routine
> fix either.

`gpgconf --kill keyboxd` is not part of ordinary stale-lock recovery. If
separate diagnosis shows that you must stop a running keyboxd before unlocking,
first make sure no operation is active and no other client will start the daemon
concurrently:

```bash
gpgconf --kill keyboxd
```

If manual removal of a proven stale lock is necessary and the protected file is
not in use, run only the supported unlock command:

```bash
gpgconf --unlock pubring.db
```

`gpgconf --unlock` removes a stale lock for the named file. It is usually
unnecessary because GnuPG can detect and remove stale locks itself. Before
unlocking, make sure the protected file is not in use. See the [gpgconf manual](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html)
and the [GnuPG upstream README](https://github.com/gpg/gnupg/blob/master/README).

## 8. Verifying the result

Run these checks in the target repository:

- Confirm the expected email, key, and signing settings. This command prints
  Git config values; review its output before sharing it:

  ```bash
  git config --show-origin --get-regexp \
    '^(user\.email|user\.signingkey|commit\.gpgsign|gpg\.program|gpg\.format)$'
  ```

- Confirm that the secret key is available for signing:

  ```bash
  gpg --list-secret-keys <fingerprint>
  ```

- Verify an existing signed commit locally:

  ```bash
  git log --show-signature -1
  ```

  For a signed `HEAD`, you can also run `git verify-commit HEAD`. An expected
  `Good signature` confirms local GnuPG's cryptographic check. A warning about
  trust in the key owner concerns GnuPG's local trust model and does not set
  the GitHub/GitLab status.

- After your next regular signed commit and push, check its status on the
  selected forge. You do not need to create a commit just to validate this guide.

Do not rewrite existing history just to fix old commits marked `Unverified`
without a separate requirement. To undo the signing setup, restore the previous
Git config values in the same scope; there is no need to delete the key.

## 9. Official references

- [Git: git-config](https://git-scm.com/docs/git-config).
- [GitHub: generating a new GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key).
- [GitHub: verified email in a GPG key](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/using-a-verified-email-address-in-your-gpg-key).
- [GitHub: adding a GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account).
- [GitHub: commit signature verification statuses](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification).
- [GitHub: Vigilant Mode](https://docs.github.com/en/authentication/managing-commit-signature-verification/displaying-verification-statuses-for-all-of-your-commits).
- [GitHub REST API: verification reasons](https://docs.github.com/en/rest/commits/commits#list-commits).
- [GitLab: GPG commit signing](https://docs.gitlab.com/user/project/repository/signed_commits/gpg/).
- [GnuPG: configuration files](https://gnupg.org/documentation/manuals/gnupg/GPG-Configuration.html).
- [GnuPG: gpgconf](https://gnupg.org/documentation/manuals/gnupg26/gpgconf.1.html).
- [GnuPG upstream README](https://github.com/gpg/gnupg/blob/master/README).
