## Running with Docker

[`docker-compose.yml`](docker-compose.yml) runs six containers:

- **web** — the Next.js server. Pulled from GitHub Container Registry
  (`ghcr.io/tautastic/tasrif-web:latest`, built from [`web.Dockerfile`](web.Dockerfile)
  by [`.github/workflows/docker-build-web.yml`](.github/workflows/docker-build-web.yml)
  on every push to `main`), running as an unprivileged user. It is not
  published directly; `nginx` is the only public entry point.
- **nginx** — reverse proxy terminating HTTPS and forwarding to `web`. Config
  is templated from [`nginx/templates/default.conf.template`](nginx/templates/default.conf.template)
  using the `DOMAIN` environment variable. It also picks up
  [`nginx/docker-entrypoint.d/99-reload-loop.sh`](nginx/docker-entrypoint.d/99-reload-loop.sh),
  which backgrounds a loop that reloads nginx every 12h so renewed
  certificates get picked up. It's a `docker-entrypoint.d/` script rather
  than a custom `command:` override because the base image only runs its
  config templating when it's actually invoked as `nginx` — overriding
  `command:` would skip that step.
- **certbot** — obtains and renews the Let's Encrypt certificate for `DOMAIN`,
  checking for renewal every 12 hours.
- **fail2ban** — watches nginx's logs and bans abusive IPs at the host
  firewall level. Runs with `network_mode: host` since it manages `iptables`
  directly.
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
   `AUTH_SECRET` with `openssl rand -base64 32`. `DOMAIN` is the hostname
   the site will be served on (it must already point at this machine) and
   `CERTBOT_EMAIL` is where Let's Encrypt sends expiry/problem notices.
2. Create the volume that holds the database (once):
   ```bash
   docker volume create tasrif-db-data
   ```
3. Make the mounted scripts executable — bind mounts preserve the host file's
   executable bit, so this has to be set once on the host (git preserves it
   afterwards):
   ```bash
   chmod +x nginx/init-letsencrypt.sh nginx/docker-entrypoint.d/99-reload-loop.sh
   ```
4. Build `db`/`backup` and pull `web` first, then start them — `nginx` and
   `certbot` need a certificate to exist before they can start cleanly:
   ```bash
   docker compose build db backup
   docker compose pull web
   docker compose up -d db backup web
   ```
5. Run the one-time bootstrap script to obtain the first certificate. It
   spins up nginx with a throwaway self-signed cert just long enough to
   complete the Let's Encrypt HTTP challenge, then swaps in the real one:
   ```bash
   ./nginx/init-letsencrypt.sh
   ```
6. Start the rest of the stack:
   ```bash
   docker compose up -d
   ```

From then on, `docker compose pull web && docker compose up -d` is enough for
routine deploys — it pulls the latest image built by CI instead of rebuilding
locally. `certbot` keeps the certificate renewed and `nginx` reloads
periodically to pick up the new one.

The app is published on ports 80/443 (change them with `HTTP_PORT` /
`HTTPS_PORT`), with HTTP redirecting to HTTPS. Because nginx sits in front,
`X-Forwarded-For` is already set correctly for the admin login rate limit —
no extra reverse-proxy setup needed there.

### fail2ban

`fail2ban` reads `nginx`'s access log (shared via the `nginx-logs` volume)
and bans IPs at the host firewall for:

- repeated failed/rate-limited attempts against `/api/auth/login`
  ([`fail2ban/jail.d/nginx-login.conf`](fail2ban/jail.d/nginx-login.conf))
- generic exploit/bot probing
  ([`fail2ban/jail.d/nginx-botsearch.conf`](fail2ban/jail.d/nginx-botsearch.conf))

This is a network-level backstop on top of the app's own in-memory login
rate limiter, not a replacement for it. `NET_ADMIN`/`NET_RAW` are usually
enough for it to manage `iptables`; if bans don't take effect on your host,
you may need to run it `privileged: true` instead.

Check current bans with:
```bash
docker compose exec fail2ban fail2ban-client status nginx-login
```

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