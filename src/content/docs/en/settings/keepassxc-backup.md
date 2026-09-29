---
title: KeePassXC backups to Google Drive via rclone
kind: guide
scope: general
status: current
last_verified: "2026-09-29"
verified_on: [asus-b5402]
---

This guide sets up a two-level KeePassXC backup scheme: built-in timestamped
copies before every database save, plus manual delivery of those copies to
Google Drive via rclone. The result: if the live database is damaged or the
machine is lost, the database is recoverable from the local directory and
from the cloud, and delivery to the cloud never deletes old copies.

The scheme applies to any system with KeePassXC and rclone. Local 90-day
rotation is part of the accepted setup; automation and timers are out of
scope here and have not been implemented.

On the ASUS ExpertBook B5402, local timestamped KeePassXC backups, directory
mode `0700`, the `gdrive:` remote with a dedicated OAuth Desktop client and
the `drive.file` scope, and a real KDBX upload and download with identical
bytes were verified on 2026-09-28. On 2026-09-29, the OAuth app moved to
*In production*, the existing remote was re-authorized
(`rclone config reconnect gdrive:` — PASS), and post-reauth transport
validation passed: listing, uploading a temporary text object, reading the
expected content, deleting it, and listing again to confirm its absence.
Production acceptance of local rotation also passed on 2026-09-29:
`~/.local/bin/keepassxc-backup-rotate` is installed and was checked against
the production directory. The recorded machine state is in
[the system section](../../systems/asus-b5402/applications/).

## Architecture

```text
KeePassXC
  ↓ built-in backup before saving the database
~/Backups/KeePassXC/           timestamped .kdbx, directory mode 0700
  ↓ rclone copy / copyto (manual)
gdrive:Backups/KeePassXC/      backup destination, delivery without deletion
```

The key decision: Google Drive is a destination for backups, not a live
filesystem. The KeePassXC database is opened only from the local disk; the
cloud stores closed copies and knows nothing about the database workflow.

## Prerequisites

- a working Gentoo system with a configured Portage;
- KeePassXC installed (`app-admin/keepassxc`);
- a Google account with sufficient Drive quota;
- a browser for the OAuth consent — rclone opens it by itself.

## Installing rclone

```bash
doas emerge --ask net-misc/rclone
```

Pinning a specific version is not needed.

## A dedicated OAuth client in Google Cloud

rclone can work with the project's built-in client_id, but it is shared by
all rclone users and subject to a shared rate limit. According to the rclone
documentation, the shared Google Drive client_id is being retired and will
stop working during 2026, so a dedicated OAuth client in a personal Google
Cloud project under your control is needed for a new setup. It also uses a
separate project quota.

Steps in [Google Cloud Console](https://console.cloud.google.com/):

1. Create a project (for example, `rclone-backups`).
2. Enable the **Google Drive API** (APIs & Services → Library).
3. Configure the **OAuth consent screen**: user type *External*.
4. Under **Data Access**, declare the minimum scope:
   `https://www.googleapis.com/auth/drive.file`. Do not add the full `drive`
   scope.
5. Create an **OAuth client ID** (Credentials → Create credentials): the
   application type is *Desktop app*.
6. Copy the client ID and client secret — they will be needed in
   `rclone config`.
7. Switch the app to the publishing status *In production* (the Publish app
   button).

If **Publish app** is unavailable and Google requires App domain
information, fill in the required Branding fields: **Application home
page**, **Privacy policy URL**, and **Authorized domain**. These fields are
not required in every case.

The OAuth branding uses a separate minimal static site for its
[homepage](https://rclone.9fans.uk/) and
[privacy policy](https://rclone.9fans.uk/privacy/). Its source is in the
separate public GitHub repository
[`vovanbl411/rclone-oauth-pages`](https://github.com/vovanbl411/rclone-oauth-pages).
The site exists only as the public OAuth homepage/privacy surface; it does
not proxy rclone or store KDBX files, OAuth tokens, or other backup data.

Do not leave the app in the *Testing* status: for an External app in
Testing, refresh tokens for Google API scopes expire after 7 days — that is
unacceptable for a long-term backup. In *In production* this 7-day
limitation does not apply. Formal OAuth verification is not required for
personal use. *External* / *In production* is technically available to
other Google accounts; personal use describes the operational use case, not
an audience restriction.

Use a dedicated client because rclone's shared `client_id` is being retired
in 2026, and the project and client are under your control. The client uses
a separate project quota.

If an existing configuration was authorized while the app was in
*Testing*, reconnect it after switching the app to *In production*:
`rclone config reconnect gdrive:`. Then repeat the minimal transport
validation in the next section: run `rclone lsf`, upload a test file, read
it with `rclone cat`, and delete it with `rclone deletefile`.
For a fresh install, no separate reconnect is needed when the initial
authorization happens after **Publish app**.

Google renames console menu items from time to time; create a Desktop OAuth
client in a project you control and switch the app to *In production*.

> **Important**: never publish the contents of `rclone.conf` and the OAuth
> token (including the refresh token), and do not commit the client secret.
> The client ID is not a credential at the OAuth token level, but there is
> no reason to publish a real project identifier in this repository. The
> examples below use placeholders.

## The gdrive remote

Start the interactive setup:

```bash
rclone config
```

The essential part of the dialog (the order of prompts depends on the
rclone version):

| Prompt | Answer |
|--------|--------|
| New remote → name | `gdrive` |
| Type of storage | `drive` (Google Drive) |
| `client_id` | `<your-client-id>` |
| `client_secret` | `<your-client-secret>` |
| `scope` | `drive.file` — “Access to files created by rclone only” |
| `root_folder_id`, `service_account_file`, advanced prompts | Enter (default value) |
| Configure this as a Shared Drive | `n` |
| Use web browser to automatically authenticate | `y` — grant access in the browser that opens |

After a successful authorization, the remote is written to the user config:

File: `~/.config/rclone/rclone.conf`

```ini
[gdrive]
type = drive
scope = drive.file
client_id = <your-client-id>
client_secret = <your-client-secret>
token = <JSON with access/refresh tokens, generated by rclone>
```

The `token` line is a live OAuth token. Check the file permissions:

```bash
stat -c '%a %U:%G' ~/.config/rclone/rclone.conf
```

Expected: `600 <user>:<user>`. If the permissions are wider, fix them:

```bash
chmod 600 ~/.config/rclone/rclone.conf
```

### Scope: drive.file

`drive.file` allows rclone to see and modify only the files created by this
remote; the rest of the Google Drive is invisible to it. That is enough for
a backup destination, and the token gets a minimal blast radius: even a
compromised token does not grant access to the other Drive files. The scope
restricts the application, not the owner — the files remain visible in the
Drive web interface as usual.

A wider scope (`drive`, full access to the account's files) is needed only
if rclone must work with files that already exist in Drive. This scheme
does not need it.

## The directory in Google Drive

Create the namespace for backups and check that it appeared:

```bash
rclone listremotes   # expected: gdrive:
rclone mkdir gdrive:Backups/KeePassXC
rclone lsd gdrive:Backups   # KeePassXC appears in the directory list
```

## Write/read/delete test

Before trusting the remote with a real database, run a test on a plain
text file:

```bash
echo "rclone gdrive test" > /tmp/rclone-test.txt
rclone lsf gdrive:Backups/KeePassXC
rclone copyto /tmp/rclone-test.txt gdrive:Backups/KeePassXC/rclone-test.txt
rclone cat gdrive:Backups/KeePassXC/rclone-test.txt   # rclone gdrive test
rclone deletefile gdrive:Backups/KeePassXC/rclone-test.txt
rm /tmp/rclone-test.txt
```

`rclone cat` must return the written line, and `rclone deletefile` must
remove the test object (`deletefile` removes one specific file; `delete`
works on the whole path). This tests the transport, not the database.

## Local KeePassXC backups

Create the backup directory accessible only to your user:

```bash
mkdir -p ~/Backups/KeePassXC
chmod 700 ~/Backups/KeePassXC
stat -c '%a %U:%G %n' ~/Backups/KeePassXC
# expected: 700 <user>:<user> /home/<user>/Backups/KeePassXC
```

The `chmod` is a separate command because `mkdir -m` does not change the
permissions of a directory that already exists: if the directory was
created earlier with wider permissions, `mkdir -m 700 -p` will not fix
them.

In KeePassXC, enable the built-in backup before saving the database:
**Tools → Application Settings → Basic → Backup database file before
saving**, plus the backup destination path field (wording differs in the
Russian localization — follow the meaning of the setting).

KeePassXC supports both absolute and relative paths in the backup
destination field. This scheme deliberately uses an explicit absolute path
so that the destination does not depend on the working database directory.
The filename template:

```text
/home/<user>/Backups/KeePassXC/{DB_FILENAME}-{TIME:yyyy-MM-dd_HH-mm-ss}.kdbx
```

`{DB_FILENAME}` substitutes the database file name, and `{TIME:…}` the
timestamp of the copy in the given format.

Verification: change any entry in the database and save it — a separate
timestamped `.kdbx` appears in the directory. Database names may contain
spaces and apostrophes, so use quoted variables in the commands:

```bash
ls -l ~/Backups/KeePassXC
backup_name="database-2026-09-28_21-49-42.kdbx"   # your file name
file "$HOME/Backups/KeePassXC/$backup_name"
# database-2026-09-28_21-49-42.kdbx: Keepass password database 2.x KDBX
```

## Manual delivery to Google Drive

The whole directory — only new and modified files are transferred, nothing
is deleted:

```bash
rclone copy ~/Backups/KeePassXC gdrive:Backups/KeePassXC
```

One specific backup under the same name:

```bash
backup_name="database-2026-09-28_21-49-42.kdbx"   # your file name
rclone copyto \
  "$HOME/Backups/KeePassXC/$backup_name" \
  "gdrive:Backups/KeePassXC/$backup_name"
```

`rclone copy`/`copyto` do not delete files in the destination: routine
delivery does not touch destination-only copies, and timestamped file names
keep the old versions. Remote deletion and rotation are deliberately not
performed right now — this is the operational policy of the scheme, not a
technical property of the storage: the Google Drive remote can modify and
delete the objects it created.

## Verification: restoring from the cloud

Download the remote copy to a temporary file and compare it with the local
one:

```bash
backup_name="database-2026-09-28_21-49-42.kdbx"   # your file name
verify_file=$(mktemp /tmp/keepassxc-verify.XXXXXX.kdbx)
rclone copyto "gdrive:Backups/KeePassXC/$backup_name" "$verify_file"
cmp -s "$HOME/Backups/KeePassXC/$backup_name" "$verify_file" \
  && echo "cmp: PASS"
sha256sum "$HOME/Backups/KeePassXC/$backup_name" "$verify_file"
rm "$verify_file"
```

The PASS criteria: the sizes are equal, `cmp` prints `cmp: PASS`, and the
two `sha256sum` lines are identical. The temporary file is removed after the
check; the local copy and the remote are not modified by the check.

Repeat the check after the first delivery and after any changes to the
remote or the rclone configuration. Hash values are unique to each
database — there is no reason to copy them into documentation or notes.

## Retention

The decisions made:

- local history: keep backups from the last 90 days;
- Google Drive: delivery without deletion; no remote rotation.

Implementation status as of 2026-09-29:

- production rotation is implemented as
  `~/.local/bin/keepassxc-backup-rotate` and was accepted on 2026-09-29
  (PASS);
- retention is 90 days by mtime: only top-level regular files matching
  `*.kdbx` in `~/Backups/KeePassXC/` are considered; files aged 90 days or
  more are expired;
- running without arguments performs a dry-run; deletion requires the
  explicit `--apply` argument;
- before processing, the script checks that `HOME` is set, the directory
  exists and is not a symlink, its owner and mode are correct (`0700`), the
  cutoff was calculated, and the directory scan succeeded. A failed check
  prevents deletion;
- the first invocation is safe and deletes nothing. Running with `--apply`
  actually deletes expired local KDBX files found by the scan;
- controlled production acceptance confirmed that dry-run preserved the
  candidate, `--apply` deleted only that expired KDBX, the non-KDBX control
  remained, and the real KDBX was unchanged by SHA-256;
- the mechanism is run manually. Scheduler and delivery automation are not
  implemented; there is no remote deletion.

> ⚠️ **Important nuance**: the local retention mechanism exists but is run
> manually for now. Without running it with `--apply`, the local directory
> will keep growing. The remote also keeps growing under the accepted policy:
> remote deletion and rotation are deliberately not performed.

### Installing and running local rotation

Save the following script as
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

Create the user command directory and set the script mode:

```bash
mkdir -p ~/.local/bin
chmod 700 ~/.local/bin/keepassxc-backup-rotate
```

Commands:

```bash
~/.local/bin/keepassxc-backup-rotate
~/.local/bin/keepassxc-backup-rotate --apply
```

The first invocation prints the candidate count and each candidate's mtime
and size, but deletes nothing. The second performs the same checks and
deletes the expired local `.kdbx` files it finds.

## What is deliberately not used

| Approach | Why it is not used |
|----------|--------------------|
| `rclone mount`, FUSE, VFS cache | Google Drive is not a live filesystem for an open database: the cache layer and desynchronization add a failure mode that does not exist when copying closed files. |
| A permanently mounted Drive | Same, plus the database must not be opened from a network “disk”. |
| `rclone sync` | `sync` deletes destination files that are missing at the source — it removes old remote copies and breaks the delivery-without-deletion scheme. |
| Git/GitHub as live KDBX sync | A binary secret in a VCS widens the propagation surface and provides no version history inside the database. |

## Limitations and next stages

The remaining separate stages are:

- automation for invoking local rotation and delivering backups — a separate
  design stage; no scheduler has been selected (a systemd user timer is only
  an example of a possible option);
- syncing the database with a phone after the automation work.

## Troubleshooting and rollback

- rclone reports an expired or invalid token — re-issue the authorization:
  `rclone config reconnect gdrive:`.
- `429` responses (rate limit) mean the Google Drive API quota/rate limit
  has been hit and can occur for various reasons. Check the rclone error
  text, the project quotas in the Cloud Console, and that the remote uses
  your own OAuth client rather than the shared built-in client_id.
- `rclone.conf` permissions wider than `600` — fix them:
  `chmod 600 ~/.config/rclone/rclone.conf`.

Rollback:

- in KeePassXC, turn off the automatic backup if it is no longer needed;
  the local `~/Backups/KeePassXC` directory can be removed separately if
  you want;
- remove the `gdrive` remote from the local rclone configuration
  (`rclone config delete gdrive`) only if you really do not need it —
  removing the remote from the configuration does not touch the files in
  Google Drive;
- the backup files in `gdrive:Backups/KeePassXC/` stay in Drive until you
  decide to delete them separately; the regular rollback of the setup does
  not delete them.

## Related docs

- [ASUS B5402 applications](../../systems/asus-b5402/applications/) — the verified machine state.
- [KeePassXC Quick Unlock via polkit](../../troubleshooting/keepassxc-quick-unlock-polkit/) — fingerprint database unlock.

## References

- [rclone: Google Drive](https://rclone.org/drive/) — the backend, scopes,
  your own client_id; the shared client_id retirement during 2026.
- [rclone docs](https://rclone.org/docs/) — the `copy`, `copyto`, `mkdir`,
  `deletefile`, `config` commands.
- [Google: OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) —
  refresh token expiration: Testing — 7 days, In production — no such
  limitation.
- [rclone OAuth branding site source](https://github.com/vovanbl411/rclone-oauth-pages) — source for the static OAuth homepage/privacy site.
- [net-misc/rclone](https://packages.gentoo.org/packages/net-misc/rclone) — the Gentoo package.
- [KeePassXC](https://github.com/keepassxreboot/keepassxc) — the upstream project.
