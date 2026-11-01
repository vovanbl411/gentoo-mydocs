---
title: KeePassXC backups to Google Drive via rclone
kind: guide
scope: general
status: current
last_verified: "2026-11-01"
verified_on: [asus-b5402]
---

KeePassXC backups pass through a local snapshot and `rclone copy` to Google
Drive. Local rotation runs only after delivery succeeds. Google Drive stores
closed backup copies; the working database stays on local storage.

```text
local live database
→ exactly-one-database preflight
→ verified local snapshot
→ rclone copy to Google Drive
→ successful delivery
→ local retention
```

KeePassXC has a separate backup-before-save option that creates a timestamped
copy when the database is saved in the application. A scheduled snapshot is
also needed because the live database may change through Syncthing without a
local KeePassXC save. The startup file-count check does not resolve simultaneous
edits; recovery from such a conflict is covered separately in the
[phone-sync guide](../keepassxc-phone-sync/) and remains PENDING.

## Example layout and prerequisites

The paths below are examples, not a required layout:

| Purpose | Example |
|---------|---------|
| Live directory | `~/Documents/KeePassSync/` |
| Local backups | `~/Backups/KeePassXC/` |
| Remote directory | `gdrive:Backups/KeePassXC/` |

Replace these values in commands and templates to match your layout. Automation
requires Gentoo with `systemd --user`, KeePassXC (`app-admin/keepassxc`),
rclone, a Google Drive account with sufficient quota, and a browser for initial
OAuth authorization. Prepare the live directory and sync mechanism separately:
the wrapper does not create the live directory or configure Syncthing.

## Install rclone

```bash
doas emerge --ask net-misc/rclone
```

## Google Drive and OAuth

For a new long-lived unattended setup, use your own Google OAuth Desktop
client. The shared Google Drive `client_id` built into rclone is being retired
during 2026.

1. Select or create a Google Cloud project and enable the Google Drive API.
2. Create a Desktop app OAuth client and request only the needed scope,
   `https://www.googleapis.com/auth/drive.file`.
3. Authorize rclone in a browser and configure a remote with your own
   `client_id` and `client_secret`.
4. For a long-lived timer, publish the External OAuth app as `In production`.
   For the Drive API, refresh tokens for an External app in `Testing` expire
   after 7 days, so this status is unsuitable for unattended backups.

Google's publication and branding requirements change. A production app needs
a publicly accessible homepage on a verified domain that describes the app
and links to its privacy policy. Fill out additional branding fields, including
Terms of Service, according to Google's current requirements and rclone's
instructions. Do not reuse branding URLs that you do not own or that do not
describe your application.

The `drive.file` scope lets the application access files and directories it
created. rclone may not see objects created through the Drive website or
another application. Create a dedicated backup directory with `rclone mkdir`;
this scope does not grant access to an arbitrary existing Google Drive tree.

Create the remote with:

```bash
rclone config
```

Select the Google Drive backend, enter your own `client_id` and `client_secret`,
choose the `drive.file` scope, and complete authorization. Prompt wording and
order can vary between rclone versions; follow its current Google Drive guide.

Check the config path and its permissions:

```bash
config_file="$(rclone config file | tail -n 1)"
stat -c '%a %U:%G' "$config_file"
# expected: 600 <user>:<user>
```

If the permissions are wider than `600`, fix them with
`chmod 600 "$config_file"`. Do not publish `rclone.conf`, OAuth access or
refresh tokens, `client_secret`, or database contents. Review even redacted
configuration output before sharing it; it is not automatically safe.

Create the remote directory for backups:

```bash
rclone mkdir gdrive:Backups/KeePassXC
```

### Validate the transport

This setup check uses a disposable text file. Run it deliberately after
configuring the remote; do not use a KDBX file for the test:

```bash
test_file="$(mktemp /tmp/rclone-drive-test.XXXXXX.txt)"
test_name="${test_file##*/}"
printf 'rclone transport test\n' > "$test_file"
rclone copyto "$test_file" "gdrive:Backups/KeePassXC/$test_name"
rclone cat "gdrive:Backups/KeePassXC/$test_name"
rclone deletefile "gdrive:Backups/KeePassXC/$test_name"
rm -- "$test_file"
```

`rclone cat` should print the test line, and `deletefile` should remove only
that test object. It changes remote state. Do not run it during a read-only
documentation review or a routine backup run.

## KeePassXC backup-before-save

Create a local directory that only your user can access:

```bash
mkdir -p "$HOME/Backups/KeePassXC"
chmod 700 "$HOME/Backups/KeePassXC"
```

In KeePassXC, enable the database backup before saving and set its destination.
The path can be absolute or relative; a relative path is resolved from the
database directory. For predictable placement, use an absolute path in your
backup directory, for example:

```text
/home/<your-user>/Backups/KeePassXC/{DB_FILENAME}-{TIME:yyyy-MM-dd_HH-mm-ss}.kdbx
```

Replace `/home/<your-user>` with your absolute home path. `{DB_FILENAME}` is
the database filename without its extension; `{TIME:<format>}` supplies the
timestamp in the format you choose. After a database save, KeePassXC creates a
separate timestamped copy. This runs on a KeePassXC save; it does not replace a
scheduled snapshot of changes received through Syncthing.

## Manual delivery and restore validation

`rclone copy` transfers new and changed files but does not remove destination
objects that are absent from the source. Do not use `rclone sync` for this
workflow: it makes the destination match the source and can delete files
removed from the source.

```bash
rclone copy \
  "$HOME/Backups/KeePassXC" \
  "gdrive:Backups/KeePassXC" \
  --include '/*.kdbx' \
  --max-depth 1
```

For one file, use `rclone copyto`:

```bash
backup_file="$HOME/Backups/KeePassXC/<backup-file>.kdbx"
rclone copyto "$backup_file" "gdrive:Backups/KeePassXC/${backup_file##*/}"
```

The routine workflow does not delete remote backups or rotate them. This is a
retention policy, not a guarantee that Google Drive objects are immutable;
other tools or users can still change or delete them.

To validate a restore, select a backup and download it to a separate file:

```bash
backup_name='<chosen-backup>.kdbx'
restore_file="$(mktemp "$HOME/keepassxc-restore.XXXXXX.kdbx")"
rclone copyto "gdrive:Backups/KeePassXC/$backup_name" "$restore_file"
```

Open the temporary file in KeePassXC and check that it unlocks and contains the
expected data. Only then decide whether to replace the live database; do not
overwrite it as the first step. Restoring a backup does not resolve a Syncthing
conflict or merge case; use the separate phone-sync procedure for that.

## Local rotation

The example below keeps files for 90 days by mtime. It considers only top-level
regular `*.kdbx` files. Without an argument, the script lists candidates and
does not delete them; deletion requires an explicit `--apply`.

Save as `~/.local/bin/keepassxc-backup-rotate`:

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

Set the mode and inspect the dry run first:

```bash
chmod 700 ~/.local/bin/keepassxc-backup-rotate
~/.local/bin/keepassxc-backup-rotate
```

Only apply deletion after reviewing the candidates:

```bash
~/.local/bin/keepassxc-backup-rotate --apply
```

## Scheduled snapshot, delivery, and systemd

The wrapper below uses the example paths in the table above. Edit `live_dir`,
`backup_dir`, and `remote` before installing it. It requires exactly one
top-level regular, non-symlink `*.kdbx` in the live directory. Zero or multiple
files abort before snapshot, delivery, or rotation. Do not automatically delete
an extra database; first find out why it appeared.

This startup conflict gate detects an ambiguous file set, but it does not
resolve simultaneous KeePassXC and Syncthing edits or act as a transactional
lock on Syncthing. Only one wrapper run can proceed at a time: a non-blocking
`flock` is held from snapshot through rotation. If the lock is already held,
the new run is skipped.

The wrapper creates a local snapshot with mode `0600` and verifies it byte for
byte with `cmp`; it removes an incomplete snapshot if copying or verification
fails. After verification, it runs `rclone copy` for top-level `*.kdbx` files
only. A delivery error stops the run and skips rotation; the verified snapshot
stays local for the next attempt. There is no automatic retry loop. Local
rotation with `--apply` runs only after successful delivery.

Save as `~/.local/bin/keepassxc-backup-run`:

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

Set the wrapper mode to `0700` and create the user service:

```ini
# ~/.config/systemd/user/keepassxc-backup.service
[Unit]
Description=Deliver KeePassXC backups and rotate local history

[Service]
Type=oneshot
ExecStart=%h/.local/bin/keepassxc-backup-run
```

This example timer runs the service daily at 20:00 local time. Choose a
schedule that works for you:

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

Create the unit directories, set permissions, and enable the chosen timer:

```bash
mkdir -p ~/.local/bin ~/.config/systemd/user
chmod 700 ~/.local/bin/keepassxc-backup-run
chmod 644 ~/.config/systemd/user/keepassxc-backup.service
chmod 644 ~/.config/systemd/user/keepassxc-backup.timer
systemctl --user daemon-reload
systemctl --user enable --now keepassxc-backup.timer
```

For a calendar timer, `Persistent=true` causes a missed service activation to
run when the user manager becomes active again, if at least one event was
missed while it was inactive. It does not retry a service that already ran and
failed; the next attempt is the next scheduled run or a manual start.

`Linger` controls whether the user manager starts at boot and remains active
after logout. This affects whether user services can run without an active
session. Choose the setting based on system requirements; `Linger=no` is not a
universal recommendation for a backup timer. Check the schedule and state with:

```bash
systemctl --user status keepassxc-backup.timer
systemctl --user list-timers --all keepassxc-backup.timer
systemctl --user status keepassxc-backup.service
loginctl show-user "$USER" -p Linger
journalctl --user -u keepassxc-backup.service -n 30 --no-pager
```

A successful `Type=oneshot` service normally shows `inactive (dead)` after
completion. Check its result and journal entries. Do not start the service
again until you understand the cause of a failure.

## Troubleshooting

### The wrapper reports that the live database is missing or there is more than one

**Symptom:** the wrapper stops before creating a snapshot.

**Cause:** it requires exactly one top-level regular, non-symlink `*.kdbx`.

**Action:** inspect the live directory and determine why the database is missing
or an extra file appeared. Do not automatically remove a conflict copy or
select it as the live database without checking it.

### Google Drive delivery fails

When `rclone copy` fails, local rotation does not run and the snapshot remains
in the backup directory. Check the remote name and path, OAuth authorization,
network, and quota/API errors. If rclone reports an expired or invalid token,
reauthorize with `rclone config reconnect gdrive:`. After fixing the cause, the
next successful `rclone copy` can deliver the remaining files.

### The timer did not run

First check the unit state, next timer events, and Linger:

```bash
systemctl --user status keepassxc-backup.timer
systemctl --user list-timers --all
loginctl show-user "$USER" -p Linger
```

Do not begin by enabling or starting the timer. First find out why the schedule
did not run and whether the user manager was active.

### The rclone config permissions are too broad

Check the actual path with `rclone config file` and its permissions with
`stat`. If the config contains credentials, only its owner should be able to
read it (`0600`). Do not publish its contents.

## Disable backup automation

To stop the schedule, disable the user timer:

```bash
systemctl --user disable --now keepassxc-backup.timer
```

Turn off KeePassXC's backup-before-save separately if you no longer need it.
Removing the `gdrive` remote from the local config with
`rclone config delete gdrive` does not delete files from Google Drive. Local
and remote backups remain until you decide to remove them separately.

## Related docs

- [KeePassXC phone sync with Android via Syncthing](../keepassxc-phone-sync/) — live sync and separate conflict recovery.
- [Applications on ASUS ExpertBook B5402](../../systems/asus-b5402/applications/) — the reference system's actual backup settings.

## References

- [rclone: Google Drive](https://rclone.org/drive/) — OAuth client, scopes, and the Drive backend.
- [rclone commands](https://rclone.org/commands/) — `copy`, `copyto`, `sync`, and remote configuration semantics.
- [Google OAuth 2.0: refresh token expiration](https://developers.google.com/identity/protocols/oauth2) — limitations on `Testing` status.
- [Google OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies) — homepage and branding requirements for production apps.
- [KeePassXC User Guide](https://keepassxc.org/docs/KeePassXC_UserGuide) — backup-before-save and filename placeholders.
- [systemd.timer](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html) and [loginctl](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html) — `Persistent` and Linger.
