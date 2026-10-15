## Running with Docker

[`docker-compose.yml`](docker-compose.yml) runs six containers:

- **web** — the Next.js server. Pulled from GitHub Container Registry
  (`ghcr.io/tautastic/tasrif-web:latest`, built from [`web.Dockerfile`](web.Dockerfile)
  by [`.github/workflows/docker-build-web.yml`](.github/workflows/docker-build-web.yml)
  once the [`CI`](.github/workflows/ci.yml) run for the same commit on `main` has
  succeeded), running as an unprivileged user with no Linux capabilities. It is
  not published directly; `nginx` is the only public entry point. It reports
  health through `GET /api/health`, which the compose healthcheck polls; `nginx`
  only starts once `web` is healthy, and `web` only starts once `db` is healthy.
- **nginx** — reverse proxy terminating HTTPS and forwarding to `web`. Config
  is templated from [`nginx/templates/default.conf.template`](nginx/templates/default.conf.template)
  using the `DOMAIN` and `HTTPS_PORT` environment variables. Details are under
  [nginx](#nginx).
- **certbot** — obtains and renews the Let's Encrypt certificate for `DOMAIN`,
  checking for renewal every 12 hours.
- **fail2ban** — watches nginx's access log and bans abusive IPs in the host
  firewall. It runs with `network_mode: host` since it manages `iptables`
  directly; its bans go into the `DOCKER-USER` chain (see [fail2ban](#fail2ban)).
- **db** — PostgreSQL 18 ([`db.Dockerfile`](db.Dockerfile)). It publishes no
  ports and sits on an internal network shared only with `web` and `backup`.
  Over the network it accepts only the application role, and only for the
  application database. On an empty volume it builds the whole database from
  [`db/`](db/README.md) before it accepts connections; see
  [Rebuilding the database](#rebuilding-the-database).
- **backup** — takes a backup of the database every 24 hours and keeps the
  newest 7. See [Backups](#backups).

Every service has a memory and CPU limit. The defaults are in
[`docker-compose.yml`](docker-compose.yml) and each can be overridden from
`.env` (`WEB_MEM_LIMIT`, `WEB_CPUS`, and the same pair for `NGINX`, `CERTBOT`,
`FAIL2BAN`, `DB` and `BACKUP`). `web` and `backup` drop
all capabilities (`backup` keeps the three it needs to hand its directory to an
unprivileged user) and set `no-new-privileges`.

### Setup

1. Copy `.env.example` to `.env` and fill it in. It lists every variable the
   compose file reads; everything except the secrets has a working default.
   `PGUSER`, `PGPASSWORD` and `PGDATABASE` name the unprivileged role and the
   database it owns; `POSTGRES_PASSWORD` is for the superuser; `PGHOST` is only
   used when running the app outside Docker. Generate `AUTH_SECRET` with
   `openssl rand -base64 32` (the app refuses to start with fewer than 32
   characters) and choose an `AUTH_PASSWORD` of at least 12 characters. `DOMAIN`
   is the hostname the site will be served on (it must already point at this
   machine), `CERTBOT_EMAIL` is where Let's Encrypt sends expiry notices, and
   `SITE_URL` (for example `https://example.org`) is the address used in
   canonical links, the sitemap and `robots.txt`.
2. Create the volume that holds the database (once; the name comes from
   `DB_VOLUME_NAME`):
   ```bash
   docker volume create tasrif-db-data
   ```
3. Build the database image and pull the web image:
   ```bash
   docker compose build db
   docker compose pull web
   ```
4. Start `web` (this also starts `db`, which builds the database on its first
   boot) and `backup`:
   ```bash
   docker compose up -d web backup
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

The scripts under `nginx/` are stored executable in git. If you copied the
repository without file modes (for example from a zip archive), run
`chmod +x nginx/init-letsencrypt.sh nginx/docker-entrypoint.d/*.sh`: the nginx
image skips entrypoint scripts that are not executable and only logs "Ignoring".

The app is published on ports 80/443 (change them with `HTTP_PORT` /
`HTTPS_PORT`), with HTTP redirecting to HTTPS on the same host and the
configured HTTPS port.

### Rebuilding the database

The database is built once, by the `db` container's first boot on an empty
volume, from `db/schema.sql` and the numbered scripts in `db/`, in a single
transaction: either it is complete or the container stops. There are no
migrations and nothing records which scripts a database has seen, so a change to
`db/` or to `src/server/db/schema/` does not reach a database that already
exists. To deploy such a change, build a new database and bring over what you
want to keep:
```bash
docker compose pull web
docker compose build db
docker compose down
docker volume rm tasrif-db-data
docker volume create tasrif-db-data
docker compose up -d
```
`docker volume rm` deletes the database: take a backup first and keep it
(see [Backups](#backups)). A restore brings back the schema, functions and rows
exactly as they were when the backup was taken, so it returns a deployment to
the version that wrote it; it does not carry content into a newer schema. The
rules for `db/` are in [`db/README.md`](db/README.md).

Routine deploys that change only the web image need none of this:
```bash
docker compose pull web
docker compose up -d
```

`nginx` finds a recreated `web` container by itself. `certbot` keeps the
certificate renewed and `nginx` reloads periodically to pick up the new one.

### nginx

- It re-resolves `web` through Docker's DNS every 2 seconds, so recreating
  `web` needs no nginx reload.
- It rate limits per client address: 10 requests per second with a burst of 20
  for `/api/`, 10 per minute with a burst of 5 for `/api/auth/login`, and 20 per
  second with a burst of 60 for `/entry/`. Excess requests get `429`.
- It answers `400` before the request reaches the app when the URI contains a
  NUL byte (`%00`) anywhere, or when the path contains a `%` that is not
  followed by two hex digits. Valid percent-encoded paths such as
  `/entry/%D9%83%D8%AA%D8%A8` are passed through. Percent-encoded bytes that are
  well-formed but not valid UTF-8 are not checked here.
- TLS is limited to 1.2 and 1.3 with the Mozilla "intermediate" profile minus
  the DHE suites, session tickets are off, and HTTP/2 is enabled. OCSP stapling
  is not enabled because Let's Encrypt has ended OCSP support.
- The access log goes to `docker compose logs nginx` and to a file on the
  `nginx-logs` volume, which `fail2ban` reads. It is rotated when it reaches
  `NGINX_LOG_MAX_BYTES` (50 MiB), keeping `NGINX_LOG_KEEP` (3) old files. Each
  line ends with `uri="…"`, the decoded and normalised path.
- A background loop reloads nginx every `NGINX_RELOAD_INTERVAL` (12h) so renewed
  certificates are picked up.
- When the host kernel has no IPv6 support, the IPv6 listen directives are
  removed at start-up; without that nginx exits.
- The scripts in [`nginx/docker-entrypoint.d/`](nginx/docker-entrypoint.d) are
  bind-mounted into the official image, which runs them at start. If you
  replace one of them with a new file (for example with `git pull`), recreate the
  container: `docker compose up -d --force-recreate nginx`.

### Client addresses and the login rate limit

The admin login rate limit is keyed on the client address. nginx overwrites
`X-Forwarded-For` and `X-Real-IP` with the address it accepted the connection
from (`$remote_addr`) and discards whatever the client sent, and the app reads
`X-Real-IP` first and the last `X-Forwarded-For` entry otherwise. This only
holds while `web` is reachable exclusively through `nginx`: never publish
port 3000. If you put another proxy or CDN in front of `nginx`, `$remote_addr`
becomes that proxy's address and every visitor shares one limit, so configure
nginx's `realip` module for it first.

The limiter and the revocation list for logged-out sessions live in the
memory of the single `web` process. Restarting `web` clears both: a session
cookie that was logged out earlier is accepted again until its 12-hour
lifetime ends, and a temporarily blocked address can try again. Changing
`AUTH_SECRET` or `AUTH_PASSWORD` invalidates every existing session.

### fail2ban

`fail2ban` reads `nginx`'s access log (shared via the `nginx-logs` volume)
and bans IPs in the host firewall for:

- repeated failed or rate-limited logins: five `401` or `429` answers to
  `POST /api/auth/login` within ten minutes
  ([`fail2ban/jail.d/nginx-login.conf`](fail2ban/jail.d/nginx-login.conf),
  [`fail2ban/filter.d/nginx-login.conf`](fail2ban/filter.d/nginx-login.conf)).
  The filter matches the logged decoded path, so query strings and encoded paths
  do not avoid it.
- generic scanner probing, with fail2ban's stock `nginx-botsearch` filter
  ([`fail2ban/jail.d/nginx-botsearch.conf`](fail2ban/jail.d/nginx-botsearch.conf)):
  ten `404` answers for typical WordPress, phpMyAdmin and webmail paths.

This is a network-level backstop on top of the app's own in-memory login rate
limiter, not a replacement for it.

How it was checked on a Linux 6.18 host whose `iptables` is the nf_tables
variant, with the container as configured in `docker-compose.yml`
(`network_mode: host`, `NET_ADMIN` and `NET_RAW` only):

- The jails load, the filters match the lines nginx really writes, and bans
  appear as `-A DOCKER-USER -p tcp -m multiport --dports 80,443 -j f2b-nginx-login`
  plus `-A f2b-nginx-login -s <ip> -j REJECT`. Traffic from the banned container
  was refused at once while a second container on the same network, and the
  host, kept working. fail2ban kept reading the log after it was rotated, removed
  its rules when the container stopped and restored the bans when it started.
  `NET_ADMIN` and `NET_RAW` were enough; `privileged: true` was not needed.
- The ports in the jails are `http,https`, that is 80 and 443: `DOCKER-USER`
  sees traffic after Docker's address translation, so they are the container
  ports whatever `HTTP_PORT` and `HTTPS_PORT` are.
- A manual ban of a container's address also blocked its requests to the
  published port through the host's address, so the DNAT path passes through
  `DOCKER-USER` as designed.

Limits you should know about:

- Bans apply to IPv4 traffic that Docker forwards. Connections that Docker's
  userland proxy opens itself, such as requests made from the host through
  `127.0.0.1`, start on the host and do not pass `DOCKER-USER`: banning the
  address nginx logged for them (the bridge gateway) did not block them.
- Traffic that reaches a published port from a container on another Docker
  network is translated to the bridge gateway address, which is what nginx logs.
  The jails therefore ignore loopback and `172.16.0.0/12` (Docker's default
  address pools); extend `ignoreip` in both jails if you configure other pools
  (`docker network inspect <project>_frontend`).
- A client arriving from outside, on the public interface, was not tested. The
  clients used were containers: on a Docker network created without masquerading
  the host did not complete a connection through a published port, so the source
  address could not be kept on that path.
- IPv6 is not covered: the jails use `iptables`, not `ip6tables`.

Check the filters and jail syntax without starting the stack:
```bash
docker/check-fail2ban.sh
```
It runs `fail2ban-regex` for both filters against
[`fail2ban/tests/access.log`](fail2ban/tests/access.log), a log captured from
a real nginx container, and the pinned image's `fail2ban-client -t`. Current bans:
```bash
docker compose exec fail2ban fail2ban-client status nginx-login
sudo iptables -S DOCKER-USER
```

### Backups

Backups are written to `./backups` (change it with `BACKUP_DIR`) as
`tasrif-<UTC timestamp>.dump` in `pg_dump`'s compressed custom format, with
mode 600. The first backup is taken when the stack starts, and a new one
whenever the newest is `BACKUP_INTERVAL_SECONDS` (24 hours) old. Each dump is
read back in full with `pg_restore` before it is kept, and old backups are only
deleted after a new one has been written and verified, keeping the newest
`BACKUP_KEEP` (7). The job starts as root only to give `BACKUP_DIR` to the
`postgres` user (uid 999) and then runs as that user; expect the files on the
host to belong to uid 999.

```bash
docker compose exec backup db-backup
```

**Encryption.** Set `BACKUP_PASSPHRASE` to encrypt every backup with symmetric
GnuPG (AES-256 with an integrity check). The file is then
`tasrif-<timestamp>.dump.gpg`; it is decrypted again and verified before it is
kept. Without a passphrase nothing is encrypted. Keep the passphrase somewhere
other than the server: losing it loses the backups.

**Off-site copies.** Set `BACKUP_UPLOAD_COMMAND` to a shell command; it runs
after each backup with the path of the finished file as `$1`, for example
`BACKUP_UPLOAD_COMMAND='cp "$1" /offsite/'` with a bind mount for `/offsite`. If
it fails the run fails, the local backup is kept and the upload is retried every
five minutes. The database image contains no `rclone`, `aws`, `scp` or `curl`:
mount a static binary and its configuration into the `backup` service, or leave
the variable empty and copy `BACKUP_DIR` to another machine from the host. With
a passphrase set, only encrypted files leave the server.

**Restore.** Restoring into a new database and swapping the names avoids
overwriting anything. Decrypt first when the backup is encrypted (it asks for
the passphrase):
```bash
gpg --output restore.dump --decrypt backups/tasrif-20260101T000000Z.dump.gpg
```
Then, from the repository directory:
```bash
docker compose stop web backup
docker compose exec -T db psql --username postgres --command 'CREATE DATABASE tasrif_restored OWNER tasrif'
docker compose exec -T db pg_restore --no-owner --single-transaction --exit-on-error \
  --username tasrif --dbname tasrif_restored < restore.dump
docker compose exec -T db psql --username postgres \
  --command 'ALTER DATABASE tasrif RENAME TO tasrif_before_restore' \
  --command 'ALTER DATABASE tasrif_restored RENAME TO tasrif'
docker compose up -d web backup
```
Replace `tasrif` with your `PGUSER` and `PGDATABASE` (the role and database
names in `.env`). Drop `tasrif_before_restore` once you are satisfied. For a
plain backup, skip the `gpg` step and use the `.dump` file directly. The restored
database has the schema of the backup, not of the images now running.

### Smoke test

[`docker/smoke.sh`](docker/smoke.sh) starts the compose stack in an isolated
project from images that already exist and checks it end to end: health over
HTTP/2, the HTTP redirect, security headers, the admin guard for RSC requests,
login and its rate limit against forged client headers, the `/entry/` and
`/api/` limits, TLS versions, the `400` rule, recreating `web` while probing
every 200 ms, certificate reload, log rotation, resource limits, the database
built by the first boot, and backups (plain, encrypted, uploaded, retained, restored into a
scratch database). It uses its own project name, ports, volumes and throwaway
secrets, prints one `PASS` or `FAIL` line per check, exits non-zero if any
check fails and always removes what it created.
```bash
docker build -f web.Dockerfile -t tasrif-web:test .
docker build -f db.Dockerfile -t tasrif-db:test .
WEB_IMAGE=tasrif-web:test DB_IMAGE=tasrif-db:test docker/smoke.sh
```
Useful variables: `COMPOSE_PROJECT_NAME` (default `tasrif-smoke`),
`SMOKE_HTTP_PORT` and `SMOKE_HTTPS_PORT` (18080 and 18443),
`SMOKE_MAX_GAP_SECONDS` (10), and `SMOKE_OLD_NGINX_TEMPLATE`, a path to an older
nginx template, which also reproduces the outage that template had when `web`
moved to a new address (`git show <revision>:nginx/templates/default.conf.template`).
The same job runs in CI. `fail2ban` and `certbot` are not part of it; see
[fail2ban](#fail2ban) and `docker/check-fail2ban.sh`, and `docker/check-nginx.sh`
for the template check inside the pinned nginx image.

### Local development

The app runs on the host with `pnpm dev`; only the database runs in Docker, built
from the same image as production. `.env` needs `PGHOST=127.0.0.1` and a `PGPORT`
(default 5432), the port the database is published on (localhost only).

```bash
pnpm db:start   # build the image, start the container, wait until it is healthy
pnpm dev        # http://localhost:3000
pnpm db:stop    # stop it; the data is kept
pnpm db:reset   # delete the container and its data
```

The database is built from `db/` on its first boot. After changing `db/` or the
schema, run `pnpm db:reset` and `pnpm db:start`. The container is named
`tasrif-dev-db` and keeps its data in the `tasrif-dev-db-data` volume.
