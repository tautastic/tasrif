## Running with Docker

[`docker-compose.yml`](docker-compose.yml) runs three containers:

- **web** — the Next.js server ([`web.Dockerfile`](web.Dockerfile)), running as
  an unprivileged user.
- **db** — PostgreSQL 18 ([`db.Dockerfile`](db.Dockerfile)). It publishes no
  ports and sits on an internal
  network shared only with `web` and `backup`. Over the network it accepts only
  the application role, and only
  for the application database.
- **backup** — takes a backup of the database every 24 hours and keeps the
  newest 7.

### Setup

1. Copy `.env.example` to `.env` and fill it in. `PGUSER`, `PGPASSWORD` and
   `PGDATABASE` name the unprivileged
   role and the database it owns; `POSTGRES_PASSWORD` is for the superuser;
   `PGHOST` is ignored. Generate
   `AUTH_SECRET` with `openssl rand -base64 32`.
2. Create the volume that holds the database (once):
   ```bash
   docker volume create tasrif-db-data
   ```
3. Build and start everything:
   ```bash
   docker compose up -d --build
   ```

The app is published on `127.0.0.1:3000` (change it with `WEB_PORT`). In
production, session cookies are
`Secure`, so anywhere other than `localhost` the admin login only works over
HTTPS. Put a reverse proxy in front
that terminates TLS and sets `X-Forwarded-For`, which the login rate limit uses
to identify clients.

### Backups

Backups are written to `./backups` (change it with `BACKUP_DIR`) as
`tasrif-<UTC timestamp>.dump` in
`pg_dump`'s compressed custom format. The first backup is taken when the stack
starts, and a new one whenever
the newest is 24 hours old. Old backups are only deleted after a new one has
been written and verified.

```bash
docker compose exec backup db-backup

docker compose stop web
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error \
  --username "$APP_DB_USER" --dbname "$APP_DB_NAME"' < backups/tasrif-20260101T000000Z.dump
docker compose start web
```