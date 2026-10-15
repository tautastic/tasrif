#!/usr/bin/env bash
# Runs the production database image for local development, published on
# 127.0.0.1:$PGPORT. Usage: dev.sh start|stop|reset (credentials come from .env).
set -Eeuo pipefail
cd "$(dirname "$0")/../.."

set -a
. ./.env
set +a

name=tasrif-dev-db
volume=tasrif-dev-db-data

case "${1:-}" in
start)
  docker build --quiet --file db.Dockerfile --tag tasrif-db . >/dev/null
  if docker container inspect "$name" >/dev/null 2>&1; then
    docker start "$name" >/dev/null
  else
    docker run --detach --name "$name" --restart unless-stopped \
      --publish "127.0.0.1:${PGPORT:-5432}:5432" \
      --volume "$volume:/var/lib/postgresql" \
      --env POSTGRES_PASSWORD \
      --env APP_DB_USER="$PGUSER" --env APP_DB_PASSWORD="$PGPASSWORD" --env APP_DB_NAME="$PGDATABASE" \
      --health-cmd db-healthcheck --health-interval 2s --health-start-period 5m \
      tasrif-db >/dev/null
  fi
  echo "Waiting for $name..."
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$name")" = healthy ]; do
    if [ "$(docker inspect --format '{{.State.Running}}' "$name")" != true ]; then
      docker logs --tail 30 "$name" >&2
      exit 1
    fi
    sleep 1
  done
  echo "Database ready on 127.0.0.1:${PGPORT:-5432}"
  ;;
stop)
  docker stop "$name"
  ;;
reset)
  docker rm --force --volumes "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  echo "Deleted $name and its data; db:start builds a fresh database."
  ;;
*)
  echo "usage: $0 start|stop|reset" >&2
  exit 2
  ;;
esac
