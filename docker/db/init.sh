#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s nullglob
export LC_ALL=C

sql_dir=/opt/tasrif/db

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
# TYPE  DATABASE        USER            ADDRESS         METHOD
# Connections from inside this container: the entrypoint, the health check and docker compose exec.
local   all             all                             trust
host    all             all             127.0.0.1/32    trust
host    all             all             ::1/128         trust
# Connections from other containers (web app, backups) may only use the application role and database.
host    "$APP_DB_NAME"  "$APP_DB_USER"  all             scram-sha-256
EOF

migrations=("$sql_dir"/drizzle/*/migration.sql)
scripts=("$sql_dir"/*.sql)
if [ ${#migrations[@]} -eq 0 ]; then
  echo "No migrations found in $sql_dir/drizzle" >&2
  exit 1
fi

journal="CREATE SCHEMA drizzle;
CREATE TABLE drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint,
  name text,
  applied_at timestamp with time zone DEFAULT now()
);"
for migration in "${migrations[@]}"; do
  name=$(basename "$(dirname "$migration")")
  if ! [[ $name =~ ^([0-9]{8})([0-9]{2})([0-9]{2})([0-9]{2})_[a-z0-9_]+$ ]]; then
    echo "Unexpected migration folder name: $name" >&2
    exit 1
  fi
  hash=$(sha256sum "$migration" | cut -d' ' -f1)
  created_at=$(date -u -d "${BASH_REMATCH[1]} ${BASH_REMATCH[2]}:${BASH_REMATCH[3]}:${BASH_REMATCH[4]}" +%s)000
  journal+="
INSERT INTO drizzle.__drizzle_migrations (hash, created_at, name) VALUES ('$hash', $created_at, '$name');"
done

args=(--command="CREATE EXTENSION IF NOT EXISTS pg_trgm")
for file in "${migrations[@]}"; do
  args+=(--file="$file")
done
args+=(--command="$journal")
for file in "${scripts[@]}"; do
  args+=(--file="$file")
done

echo "Loading schema and data from $sql_dir"
psql --no-psqlrc --set=ON_ERROR_STOP=1 --single-transaction --username="$APP_DB_USER" --dbname="$APP_DB_NAME" "${args[@]}"
