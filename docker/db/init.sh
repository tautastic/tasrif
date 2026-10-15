#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C

sql_dir=${TASRIF_SQL_DIR:-/opt/tasrif/db}

for var in APP_DB_USER APP_DB_NAME; do
  if ! [[ ${!var:-} =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
    echo "$var must be a lowercase PostgreSQL identifier made of letters, digits and underscores" >&2
    exit 1
  fi
done
if [ -z "${APP_DB_PASSWORD:-}" ]; then
  echo "APP_DB_PASSWORD must be set" >&2
  exit 1
fi
if [ "$APP_DB_USER" = "$POSTGRES_USER" ]; then
  echo "APP_DB_USER must differ from the superuser ($POSTGRES_USER)" >&2
  exit 1
fi

echo "Creating role $APP_DB_USER and database $APP_DB_NAME"
psql --no-psqlrc --set=ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname=postgres \
  --set=app_user="$APP_DB_USER" --set=app_password="$APP_DB_PASSWORD" --set=app_db="$APP_DB_NAME" <<'SQL'
CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
CREATE DATABASE :"app_db" OWNER :"app_user";
REVOKE ALL ON DATABASE :"app_db" FROM PUBLIC;
SQL

cat >"$PGDATA/pg_hba.conf" <<EOF
local   all             all                             trust
host    all             all             127.0.0.1/32    trust
host    all             all             ::1/128         trust
host    "$APP_DB_NAME"  "$APP_DB_USER"  all             scram-sha-256
EOF

echo "Loading schema and data from $sql_dir"
sql_files=("$sql_dir/schema.sql")
for script in "$sql_dir"/[0-9]*.sql; do
  sql_files+=("$script")
done
psql_files=()
for file in "${sql_files[@]}"; do
  psql_files+=(--file="$file")
done
PGUSER="$APP_DB_USER" PGDATABASE="$APP_DB_NAME" PGOPTIONS="-c client_min_messages=warning" \
  psql --no-psqlrc --quiet --single-transaction --set=ON_ERROR_STOP=1 --output=/dev/null "${psql_files[@]}"
