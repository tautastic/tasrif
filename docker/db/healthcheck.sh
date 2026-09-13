#!/usr/bin/env bash
set -Eeuo pipefail

tables=$(psql --host=127.0.0.1 --username="$APP_DB_USER" --dbname="$APP_DB_NAME" --no-psqlrc --no-align --tuples-only \
  --command="SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'")

if [ "$tables" -eq 0 ]; then
  echo "Database \"$APP_DB_NAME\" has no tables: its first-boot initialisation did not complete." >&2
  exit 1
fi
