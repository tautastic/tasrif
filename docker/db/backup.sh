#!/usr/bin/env bash
# Logical backups of the application database in pg_dump's compressed custom format.
#
#   db-backup            take a backup now, then delete all but the newest $BACKUP_KEEP backups
#   db-backup schedule   keep running and take a backup whenever the newest one is $BACKUP_INTERVAL_SECONDS old
set -Eeuo pipefail
shopt -s nullglob
export LC_ALL=C

backup_dir=${BACKUP_DIR:-/backups}
keep=${BACKUP_KEEP:-7}
interval=${BACKUP_INTERVAL_SECONDS:-86400}
retry_delay=300

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

backup_now() {
  umask 077
  mkdir -p "$backup_dir"

  local name
  name="tasrif-$(date -u +%Y%m%dT%H%M%SZ).dump"
  partial="$backup_dir/.$name.partial"
  trap 'rm -f -- "$partial"' EXIT

  log "Backing up database $PGDATABASE to $name"
  pg_dump --format=custom --file="$partial"
  pg_restore --list "$partial" >/dev/null
  mv -- "$partial" "$backup_dir/$name"

  local backups=("$backup_dir"/tasrif-*.dump)
  local excess=$((${#backups[@]} - keep))
  for ((i = 0; i < excess; i++)); do
    log "Deleting old backup ${backups[i]##*/}"
    rm -f -- "${backups[i]}"
  done
}

schedule() {
  log "Backing up every ${interval}s to $backup_dir, keeping the newest $keep backups"
  while true; do
    local backups=("$backup_dir"/tasrif-*.dump)
    local age=$interval
    if ((${#backups[@]} > 0)); then
      age=$(($(date +%s) - $(stat --format=%Y "${backups[${#backups[@]} - 1]}")))
    fi

    if ((age < interval)); then
      sleep $((interval - age))
    elif ! "$0"; then
      log "Backup failed, retrying in ${retry_delay}s"
      sleep "$retry_delay"
    fi
  done
}

if ! [[ $keep =~ ^[1-9][0-9]*$ && $interval =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_KEEP and BACKUP_INTERVAL_SECONDS must be positive integers" >&2
  exit 2
fi

case "${1:-}" in
  "") backup_now ;;
  schedule) schedule ;;
  *)
    echo "Usage: db-backup [schedule]" >&2
    exit 2
    ;;
esac
