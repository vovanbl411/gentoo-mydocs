---
title: KeePassXC backups to Google Drive via rclone
kind: guide
scope: general
status: current
last_verified: "2026-09-30"
verified_on: [asus-b5402]
---

This guide documents the accepted KeePassXC backup pipeline: the wrapper
finds exactly one top-level regular, non-symlink `*.kdbx` in the dedicated
live directory `~/Documents/KeePassSync/`, creates a verified local snapshot,
delivers backups to Google Drive, and runs local rotation only after delivery
succeeds. KeePassXC's built-in timestamped backups on save remain enabled.
Rotation removes local copies aged 90 days or more by mtime; this workflow
does not delete remote files.

Daily automation on the ASUS ExpertBook B5402 uses `systemd --user`: a
calendar timer at 20:00 local time, `Persistent=true`, and `Linger=no`. The
snapshot does not depend on where the live database was last edited: a change
that later arrives through Android/Syncthing does not have to pass through a
local KeePassXC save. Normal bidirectional sync with Android through
Syncthing and KeePassDX was accepted on 2026-09-30; real conflict recovery and
merge remain pending. See the [separate guide](../keepassxc-phone-sync/).

Before starting, the wrapper checks that the live directory contains exactly
one matching database. If it finds zero or multiple files, it exits before
snapshot, delivery, or rotation. This is a startup conflict gate for an extra
file such as a Syncthing conflict copy; it is not a transactional lock on
Syncthing. On the ASUS B5402, the snapshot, normal service run, and controlled
conflict-gate test passed on 2026-09-29. The snapshot had mode `0600`, a current
run mtime, and byte-identical content to the live DB; the timer was already
enabled and active. See also [the system section](../../systems/asus-b5402/applications/).

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

Google Drive is a destination for backup copies, not a live filesystem. The
KeePassXC database is opened only from the local disk; the cloud stores closed
copies.

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

- local rotation keeps files younger than 90 days; copies aged 90 days or
  more are removed by mtime;
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
- controlled production acceptance confirmed the rotation behavior: dry-run
  preserved the expired test KDBX, and `--apply` deleted only that file. The
  non-KDBX control and production KDBX remained; the real database hash
  matched before and after;
- the wrapper `~/.local/bin/keepassxc-backup-run`, user service, and
  calendar timer perform a daily snapshot, delivery, and local rotation. The
  wrapper validates the live database and creates a snapshot before `rclone
  copy`; rotation runs only after delivery succeeds. Configuration is below.

Google Drive remains the destination for backup copies. This workflow does
not delete remote files or rotate them. If a transfer partially succeeds and
then fails, local rotation is skipped; a later successful `rclone copy` can
copy files that are still missing. If delivery succeeds but rotation fails,
the remote copies have already been delivered and old local copies may remain.

> **Important**: remote deletion is deliberately absent, but Google Drive is
> not immutable storage. This automation does not prevent objects from being
> changed or deleted by other means.

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

## Daily snapshot, delivery, and local rotation

The wrapper first finds exactly one top-level regular, non-symlink `*.kdbx`
in `~/Documents/KeePassSync/`. It then acquires a non-blocking lock and
creates a snapshot in `~/Backups/KeePassXC/`. This daily snapshot captures
changes regardless of where they were made: a later Android/Syncthing change
does not first have to pass through a KeePassXC save on this machine.

The snapshot uses the generic name format
`keepassxc-snapshot-YYYY-MM-DD_HH-MM-SS.XXXXXX.kdbx`; its mode is `0600` and
its mtime is current. The wrapper checks byte identity with `cmp`. If copying
or verification fails, it removes the incomplete snapshot and stops before
delivery. A verified snapshot remains in the backup directory even if the
subsequent delivery fails.

If the startup precheck finds anything other than exactly one top-level
regular, non-symlink `*.kdbx`, the wrapper exits with an error before snapshot,
delivery, or rotation. This startup conflict gate catches an unexpected
additional database, such as a Syncthing conflict copy; it does not block or
serialize Syncthing itself.

One non-blocking `flock` on `$XDG_RUNTIME_DIR/keepassxc-backup.lock` is held
from before snapshot creation through the end of rotation. File descriptor 9
stays open for the entire workflow. A concurrent invocation prints `SKIP` and
exits with code `0` without starting another workflow.

After snapshot verification, `rclone copy` delivers only top-level regular
`*.kdbx` files from `~/Backups/KeePassXC/` to `gdrive:Backups/KeePassXC/`.
`copy` is used because delivery must not delete remote files; `rclone sync` and
remote rotation are not used. If delivery returns an error, the wrapper exits
and skips local rotation. The verified snapshot stays local for the next
successful delivery. There is no automatic retry loop. Only successful
delivery allows `keepassxc-backup-rotate --apply` to run.

Save the wrapper as `~/.local/bin/keepassxc-backup-run` with mode `0700`. It
requires `HOME` and `XDG_RUNTIME_DIR`, the `rclone` and `flock` commands, both
directories, an executable rotation script, and exactly one top-level regular,
non-symlink live `*.kdbx`.

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

Save the user service as
`~/.config/systemd/user/keepassxc-backup.service` (mode `0644`):

```ini
[Unit]
Description=Deliver KeePassXC backups and rotate local history

[Service]
Type=oneshot
ExecStart=%h/.local/bin/keepassxc-backup-run
```

Save the user timer as
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

Set the modes, reload the user units, and enable the timer:

```bash
mkdir -p ~/.local/bin ~/.config/systemd/user
chmod 700 ~/.local/bin/keepassxc-backup-run
chmod 644 ~/.config/systemd/user/keepassxc-backup.service
chmod 644 ~/.config/systemd/user/keepassxc-backup.timer
systemctl --user daemon-reload
systemctl --user enable --now keepassxc-backup.timer
```

With `Persistent=true`, the timer catches up a missed calendar event when the
user manager becomes active again. This machine has `Linger=no`, so there is no
separate background run while the user manager is inactive; a missed event is
usually handled at the next login/session. `Persistent` is not an application
retry mechanism: if the service has run and failed, it is not retried
automatically. The next attempt is the next scheduled run or a manual start.

The service uses `Type=oneshot`. After success it normally shows
`inactive (dead)`, which is the expected completed state. Check
`Result=success` and the journal. Inspection commands:

```bash
systemctl --user status keepassxc-backup.timer
systemctl --user list-timers --all keepassxc-backup.timer
systemctl --user status keepassxc-backup.service
journalctl --user -u keepassxc-backup.service -n 50 --no-pager
```

To start the workflow manually:

```bash
systemctl --user start keepassxc-backup.service
```

Acceptance on ASUS B5402 passed on 2026-09-29: the service completed with
`Result=success` and `ExecMainStatus=0`; the journal confirmed snapshot →
delivery → rotation. The local KDBX count increased from 2 to 3; the new
snapshot had mode `0600`, the current run's mtime, and byte-identical content
to the live DB. The remote object count increased from 1 to 3. A controlled
test with a second database confirmed that the conflict gate stops the
workflow before snapshot, delivery, or rotation. The timer remained enabled
and `active (waiting)` on its daily 20:00 schedule.

## What is deliberately not used

| Approach | Why it is not used |
|----------|--------------------|
| `rclone mount`, FUSE, VFS cache | Google Drive is not a live filesystem for an open database: the cache layer and desynchronization add a failure mode that does not exist when copying closed files. |
| A permanently mounted Drive | Same, plus the database must not be opened from a network “disk”. |
| `rclone sync` | `sync` deletes destination files that are missing at the source — it removes old remote copies and breaks the delivery-without-deletion scheme. |
| Git/GitHub as live KDBX sync | A binary secret in a VCS widens the propagation surface and provides no version history inside the database. |

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

- [KeePassXC phone sync with Android via Syncthing](../keepassxc-phone-sync/) — live sync and conflict recovery status.
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
