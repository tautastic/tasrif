#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C

backup_dir=${BACKUP_DIR:-/backups}
keep=${BACKUP_KEEP:-7}
interval=${BACKUP_INTERVAL_SECONDS:-86400}
passphrase=${BACKUP_PASSPHRASE:-}
upload_command=${BACKUP_UPLOAD_COMMAND:-}
retry_delay=${BACKUP_RETRY_SECONDS:-300}
backups=()

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

if ! [[ $keep =~ ^[1-9][0-9]*$ && $interval =~ ^[1-9][0-9]*$ && $retry_delay =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_KEEP, BACKUP_INTERVAL_SECONDS and BACKUP_RETRY_SECONDS must be positive integers" >&2
  exit 2
fi

if [ "$(id -u)" = 0 ]; then
  mkdir -p "$backup_dir"
  if [ "$(stat --format=%u "$backup_dir")" != "$(id -u postgres)" ]; then
    chown postgres:postgres "$backup_dir"
  fi
  exec gosu postgres "$0" "$@"
fi

if ! [ -d "$backup_dir" ] || ! [ -w "$backup_dir" ]; then
  echo "$backup_dir must be a directory writable by uid $(id -u)" >&2
  exit 1
fi

umask 077

list_backups() {
  mapfile -t backups < <(find "$backup_dir" -maxdepth 1 -type f \( -name 'tasrif-*.dump' -o -name 'tasrif-*.dump.gpg' \) | sort)
}

verify_dump() {
  pg_restore --file=/dev/null "$1"
}

encrypt() {
  gpg --batch --yes --quiet --no-tty --pinentry-mode loopback --symmetric --cipher-algo AES256 \
    --s2k-digest-algo SHA512 --s2k-count 65011712 --passphrase-fd 3 --output "$2" "$1" 3<<<"$passphrase"
}

decrypt() {
  gpg --batch --yes --quiet --no-tty --pinentry-mode loopback --passphrase-fd 3 --output "$2" --decrypt "$1" 3<<<"$passphrase"
}

upload() {
  log "Uploading ${1##*/} with BACKUP_UPLOAD_COMMAND"
  bash -c "$upload_command" backup-upload "$1"
  printf '%s\n' "${1##*/}" >"$backup_dir/.last-uploaded"
}

upload_pending() {
  if [ -z "$upload_command" ]; then
    return 0
  fi
  list_backups
  if ((${#backups[@]} == 0)); then
    return 0
  fi
  local newest=${backups[${#backups[@]} - 1]}
  local uploaded=""
  if [ -f "$backup_dir/.last-uploaded" ]; then
    uploaded=$(<"$backup_dir/.last-uploaded")
  fi
  if [ "$uploaded" != "${newest##*/}" ]; then
    upload "$newest"
  fi
}

work=""

backup_now() {
  local name final
  find "$backup_dir" -maxdepth 1 -type d -name '.work.*' -mmin +60 -exec rm -rf -- {} +
  name="tasrif-$(date -u +%Y%m%dT%H%M%SZ).dump"
  work=$(mktemp -d "$backup_dir/.work.XXXXXX")
  GNUPGHOME=$work/gnupg
  export GNUPGHOME
  mkdir -m 700 "$GNUPGHOME"
  trap 'rm -rf -- "$work"' EXIT

  log "Backing up database $PGDATABASE"
  pg_dump --format=custom --file="$work/$name"
  verify_dump "$work/$name"

  final=$name
  if [ -n "$passphrase" ]; then
    final=$name.gpg
    encrypt "$work/$name" "$work/$final"
    decrypt "$work/$final" "$work/check.dump"
    verify_dump "$work/check.dump"
    rm -f -- "$work/check.dump"
  fi

  mv -- "$work/$final" "$backup_dir/$final"
  log "Wrote $final"

  list_backups
  local excess=$((${#backups[@]} - keep))
  for ((i = 0; i < excess; i++)); do
    log "Deleting old backup ${backups[i]##*/}"
    rm -f -- "${backups[i]}"
  done

  if [ -n "$upload_command" ]; then
    upload "$backup_dir/$final"
  fi
}

newest_age() {
  list_backups
  if ((${#backups[@]} == 0)); then
    echo "$interval"
  else
    echo $(($(date +%s) - $(stat --format=%Y "${backups[${#backups[@]} - 1]}")))
  fi
}

schedule() {
  log "Backing up every ${interval}s to $backup_dir, keeping the newest $keep backups"
  local age
  while true; do
    age=$(newest_age)
    if ((age >= interval)) && ! "$0"; then
      log "Backup failed, retrying in ${retry_delay}s"
      sleep "$retry_delay"
      continue
    fi
    if ! upload_pending; then
      log "Upload failed, retrying in ${retry_delay}s"
      sleep "$retry_delay"
      continue
    fi
    age=$(newest_age)
    if ((age < interval)); then
      sleep $((interval - age))
    fi
  done
}

case "${1:-}" in
  "") backup_now ;;
  schedule) schedule ;;
  *)
    echo "Usage: db-backup [schedule]" >&2
    exit 2
    ;;
esac
