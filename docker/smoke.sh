#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project=${COMPOSE_PROJECT_NAME:-tasrif-smoke}
http_port=${SMOKE_HTTP_PORT:-18080}
https_port=${SMOKE_HTTPS_PORT:-18443}
max_gap=${SMOKE_MAX_GAP_SECONDS:-10}
old_template=${SMOKE_OLD_NGINX_TEMPLATE:-}
web_image=${WEB_IMAGE:?WEB_IMAGE must name the web image to test}
db_image=${DB_IMAGE:?DB_IMAGE must name the database image to test}
workdir=$(mktemp -d "${TMPDIR:-/tmp}/tasrif-smoke.XXXXXX")
db_volume=${project}_db
frontend_network=${project}_frontend
certs_volume=${project}_certbot-etc
admin_password=$(openssl rand -hex 16)
passphrase=$(openssl rand -hex 16)
passed=0
failed=0
compose_files=(-f "$repo/docker-compose.yml")

cat >"$workdir/env" <<EOF
PGUSER=tasrif
PGPASSWORD=$(openssl rand -hex 16)
PGDATABASE=tasrif
POSTGRES_PASSWORD=$(openssl rand -hex 16)
AUTH_PASSWORD=$admin_password
AUTH_SECRET=$(openssl rand -hex 32)
DOMAIN=localhost
SITE_URL=https://smoke.invalid
HTTP_PORT=$http_port
HTTPS_PORT=$https_port
WEB_IMAGE=$web_image
DB_IMAGE=$db_image
DB_VOLUME_NAME=$db_volume
BACKUP_DIR=$workdir/backups
EOF

dc() {
  docker compose --project-name "$project" --project-directory "$repo" --env-file "$workdir/env" "${compose_files[@]}" "$@"
}

req() {
  curl -sk --max-time 10 --resolve "localhost:$https_port:127.0.0.1" "$@"
}

site() {
  printf 'https://localhost:%s%s' "$https_port" "$1"
}

pass() {
  printf 'PASS  %s\n' "$1"
  passed=$((passed + 1))
}

fail() {
  printf 'FAIL  %s\n' "$1"
  if [ -n "${2:-}" ]; then
    printf '      %s\n' "$2"
  fi
  failed=$((failed + 1))
}

expect() {
  if [ "$3" = "$2" ]; then
    pass "$1"
  else
    fail "$1" "expected '$2', got '$3'"
  fi
}

expect_match() {
  if [[ $3 =~ $2 ]]; then
    pass "$1"
  else
    fail "$1" "expected a match for '$2' in '${3:0:300}'"
  fi
}

expect_no_match() {
  if [[ $3 =~ $2 ]]; then
    fail "$1" "unexpected match for '$2' in '${3:0:300}'"
  else
    pass "$1"
  fi
}

cleanup() {
  local status=$?
  trap - EXIT ERR
  set +e
  if ((status != 0 || failed != 0)); then
    echo "--- container state and recent logs ---"
    dc ps -a 2>&1 || true
    dc logs --no-color --tail=40 2>&1 || true
  fi
  rm -f "$workdir/probe.run"
  release_squatters
  dc down --volumes --remove-orphans --timeout 5 >/dev/null 2>&1 || true
  docker volume rm -f "$db_volume" >/dev/null 2>&1 || true
  docker run --rm --entrypoint sh -v "$workdir:/w" "$db_image" -c 'rm -rf /w/backups /w/offsite' >/dev/null 2>&1 || true
  rm -rf "$workdir"
  if ((status == 0 && failed != 0)); then
    status=1
  fi
  echo "Result: $passed passed, $failed failed"
  exit "$status"
}

trap cleanup EXIT
trap 'echo "FAIL  script error on line $LINENO: $BASH_COMMAND" >&2' ERR

wait_for() {
  local description=$1 timeout=$2
  shift 2
  local deadline=$((SECONDS + timeout))
  until "$@" >/dev/null 2>&1; do
    if ((SECONDS >= deadline)); then
      echo "Timed out waiting for $description" >&2
      return 1
    fi
    sleep 0.5
  done
}

health_of() {
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$(dc ps -q "$1")"
}

service_healthy() {
  [ "$(health_of "$1")" = healthy ]
}

status_of() {
  req -o /dev/null -w '%{http_code}' "$@"
}

make_certificate() {
  local dir=$workdir/cert-$1
  mkdir -p "$dir"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=localhost/O=$1" \
    -addext "subjectAltName=DNS:localhost" -keyout "$dir/privkey.pem" -out "$dir/fullchain.pem" 2>/dev/null
  docker run --rm --entrypoint sh -v "$certs_volume:/etc/letsencrypt" -v "$dir:/src:ro" "$nginx_image" \
    -c 'mkdir -p /etc/letsencrypt/live/localhost && cp /src/fullchain.pem /src/privkey.pem /etc/letsencrypt/live/localhost/'
}

served_fingerprint() {
  openssl s_client -connect "127.0.0.1:$https_port" -servername localhost </dev/null 2>/dev/null \
    | openssl x509 -noout -fingerprint -sha256
}

in_helper() {
  docker run --rm --network "$frontend_network" --entrypoint sh "$nginx_image" -c "$1"
}

in_backups() {
  local script=$1
  shift
  docker run --rm --entrypoint bash -v "$workdir/backups:/b" "$db_image" -c "$script" "$@"
}

health_ok() {
  [ "$(status_of "$(site /api/health)")" = 200 ]
}

web_address() {
  docker inspect --format "{{(index .NetworkSettings.Networks \"$frontend_network\").IPAddress}}" "$(dc ps -q web)"
}

squatter=${project}-squatter

release_squatters() {
  docker ps -aq --filter "name=$squatter" | xargs -r docker rm -f >/dev/null 2>&1 || true
}

claim_address() {
  local target=$1 name address
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    name=$squatter-$i
    docker run -d --name "$name" --network "$frontend_network" --entrypoint sleep "$nginx_image" 600 >/dev/null
    address=$(docker inspect --format "{{(index .NetworkSettings.Networks \"$frontend_network\").IPAddress}}" "$name")
    if [ "$address" = "$target" ]; then
      return 0
    fi
  done
  return 1
}

measure_recreate() {
  local label=$1 window=$2 mode=$3 log=$workdir/probe.log
  : >"$log"
  : >"$workdir/probe.run"
  (
    while [ -e "$workdir/probe.run" ]; do
      code=$(curl -sk -o /dev/null --max-time 2 --connect-timeout 1 -w '%{http_code}' \
        --resolve "localhost:$https_port:127.0.0.1" "$(site /api/health)" || true)
      printf '%s %s\n' "$(date +%s.%N)" "${code:-000}" >>"$log"
      sleep 0.2
    done
  ) &
  local probe_pid=$!
  sleep 1
  before_address=$(web_address)
  if [ "$mode" = moved ]; then
    dc stop web >/dev/null 2>&1
    claim_address "$before_address" || echo "WARN  could not take over the old web address $before_address"
  fi
  dc up -d --no-build --force-recreate web >/dev/null 2>&1
  after_address=$(web_address)
  local deadline=$((SECONDS + window))
  while ((SECONDS < deadline)); do
    if [ "$(tail -n 25 "$log" | awk '$2 == 200' | wc -l)" -ge 25 ]; then
      break
    fi
    sleep 0.5
  done
  rm -f "$workdir/probe.run"
  wait "$probe_pid"
  release_squatters
  awk '
    $2 != 200 { bad++; if (!inrun) { inrun = 1; start = $1 } last = $1 }
    $2 == 200 && inrun { inrun = 0; d = $1 - start; if (d > max) max = d }
    END {
      if (inrun) { d = last - start + 0.2; if (d > max) max = d; open = 1 }
      printf "%s %.1f %d %d\n", (open ? "unrecovered" : "recovered"), max + 0, bad + 0, NR
    }' "$log" >"$workdir/gap.result"
  read -r gap_state gap_seconds gap_bad gap_total <"$workdir/gap.result"
  printf 'INFO  %s: web %s -> %s, %s, longest failing window %ss, %s of %s probes (every 200 ms) did not return 200\n' \
    "$label" "$before_address" "$after_address" "$gap_state" "$gap_seconds" "$gap_bad" "$gap_total"
}

echo "Project $project, web image $web_image, database image $db_image, ports $http_port/$https_port"

docker volume create "$db_volume" >/dev/null
dc create --no-build nginx >/dev/null
nginx_image=$(docker inspect --format '{{.Config.Image}}' "$(dc ps -aq nginx)")
make_certificate first
dc up -d --no-build nginx >/dev/null
wait_for "web to be healthy" 180 service_healthy web
wait_for "nginx to be healthy" 120 service_healthy nginx

pattern_count=$(dc exec -T db psql -U tasrif -d tasrif -At -c "SELECT count(*) FROM morph_pattern")
expect_match "db: first boot loaded the seeded morphological patterns" "^[1-9][0-9]*$" "$pattern_count"
ledger_schema=$(dc exec -T db psql -U tasrif -d tasrif -At -c "SELECT count(*) FROM pg_namespace WHERE nspname = 'drizzle'")
expect "db: first boot leaves no migration bookkeeping behind" "0" "$ledger_schema"

health=$(req -o /dev/null -w '%{http_code} %{http_version}' "$(site /api/health)")
expect "GET /api/health returns 200 over HTTP/2 through nginx" "200 2" "$health"
redirect=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: localhost' "http://127.0.0.1:$http_port/entry/x?y=1")
expect "HTTP redirects to HTTPS and keeps the path, query and port" "301 https://localhost:$https_port/entry/x?y=1" "$redirect"

expect_match "a valid percent-encoded Arabic URL is passed through (not 400, not 5xx)" "^(200|404)$" \
  "$(status_of "$(site /entry/%D9%83%D8%AA%D8%A8)")"
expect_match "a valid percent-encoded query string is passed through" "^200$" "$(status_of "$(site '/search?q=%D9%83')")"
expect "a lone percent sign in a query string is passed through" "200" "$(status_of "$(site '/search?q=100%')")"
expect "a NUL byte in the path is answered with 400" "400" "$(status_of "$(site /entry/%00)")"
expect "a NUL byte in the query string is answered with 400" "400" "$(status_of "$(site '/search?q=a%00b')")"
expect "truncated percent-encoding in the path is answered with 400" "400" "$(status_of "$(site /lang/%E0%A4%A)")"
expect "non-hex percent-encoding in the path is answered with 400" "400" "$(status_of "$(site /entry/%zz)")"
expect "a percent sign at the end of the path is answered with 400" "400" "$(status_of "$(site /entry/x%)")"

headers=$(req -D - -o /dev/null "$(site /)" | tr '[:upper:]' '[:lower:]')
expect_match "response has Content-Security-Policy with default-src 'self' and frame-ancestors" "content-security-policy: default-src 'self'.*frame-ancestors 'self'" "$headers"
expect_match "response has Strict-Transport-Security" "strict-transport-security: max-age=[0-9]+" "$headers"
expect_match "response has X-Content-Type-Options nosniff" "x-content-type-options: nosniff" "$headers"
expect_match "response has X-Frame-Options" "x-frame-options: sameorigin" "$headers"
expect_match "response has Referrer-Policy" "referrer-policy: strict-origin-when-cross-origin" "$headers"
expect_match "response has Permissions-Policy" "permissions-policy: camera=\(\)" "$headers"
expect_no_match "X-Powered-By is absent" "x-powered-by" "$headers"
expect_no_match "nginx does not announce its version" "server: nginx/" "$headers"

robots=$(req "$(site /robots.txt)")
expect_match "SITE_URL reaches the web container (robots.txt sitemap)" "Sitemap: https://smoke.invalid/sitemap/0.xml" "$robots"

rsc_status=$(req -o "$workdir/rsc.body" -D "$workdir/rsc.headers" -H 'RSC: 1' -w '%{http_code}' "$(site '/admin/entries?_rsc=smoke')")
rsc_location=$(awk 'tolower($1) == "location:" { sub(/\r$/, "", $2); print $2 }' "$workdir/rsc.headers")
expect "unauthenticated RSC request to /admin/entries is redirected" "307" "$rsc_status"
expect_match "the redirect points at the login page" "^/auth/login" "$rsc_location"
expect "the redirect body is only the login address, no page data" "$rsc_location" "$(cat "$workdir/rsc.body")"
expect "unauthenticated RSC request without the cache-busting parameter is redirected too" "307" \
  "$(status_of -H 'RSC: 1' "$(site /admin/entries)")"
plain_status=$(status_of "$(site /admin/entries)")
expect "unauthenticated request to /admin/entries is redirected" "307" "$plain_status"

wrong=$(req -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{"password":"definitely-wrong"}' "$(site /api/auth/login)")
expect "login with a wrong password returns 401" "401" "$wrong"
req -D "$workdir/login.headers" -o /dev/null -H 'Content-Type: application/json' \
  -d "{\"password\":\"$admin_password\"}" "$(site /api/auth/login)"
login_status=$(awk 'NR == 1 { print $2 }' "$workdir/login.headers")
cookie=$(awk 'tolower($1) == "set-cookie:" { sub(/\r$/, "", $2); print $2 }' "$workdir/login.headers")
expect "login with the right password returns 200" "200" "$login_status"
cookie_header=$(grep -i '^set-cookie:' "$workdir/login.headers" | tr '[:upper:]' '[:lower:]')
expect_match "login sets the admin_session cookie" "^admin_session=" "$cookie"
expect_match "the session cookie is HttpOnly, Secure and SameSite=strict" "httponly.*secure|secure.*httponly" "$cookie_header"
expect_match "the session cookie is SameSite=strict" "samesite=strict" "$cookie_header"
authenticated=$(req -L -o /dev/null -w '%{http_code} %{content_type}' -H 'RSC: 1' -H "Cookie: ${cookie%%;*}" "$(site '/admin/entries?_rsc=smoke')")
expect "the session cookie opens the admin RSC payload" "200 text/x-component" "$authenticated"
expect "the session cookie opens /admin/entries as a page" "200" \
  "$(status_of -H "Cookie: ${cookie%%;*}" "$(site /admin/entries)")"

echo "Rate limits from a second container (a different client address)"
limits=$(in_helper '
  for i in 1 2 3 4 5 6 7 8; do
    body=$(curl -sk -H "Host: localhost" -H "X-Forwarded-For: 10.1.$i.9" -H "X-Real-IP: 10.2.$i.9" \
      -H "Content-Type: application/json" -d "{\"password\":\"wrong-$i\"}" -w "|%{http_code}" https://nginx/api/auth/login)
    case "$body" in
      *"Too many login attempts"*) echo "login $i ${body##*|} app" ;;
      *) echo "login $i ${body##*|} other" ;;
    esac
  done
  curl -sk -H "Host: localhost" -o /dev/null -w "entry %{http_code}\n" "https://nginx/entry/smoke-[1-150]"
  curl -sk -H "Host: localhost" -o /dev/null -w "api %{http_code}\n" "https://nginx/api/health?n=[1-60]"
')
login_codes=$(awk '$1 == "login" { printf "%s ", $3 }' <<<"$limits")
expect "login: five failures return 401 even with forged X-Forwarded-For and X-Real-IP, then 429" \
  "401 401 401 401 401 429 429 429 " "$login_codes"
expect "login: the sixth attempt is refused by the application itself" "login 6 429 app" "$(grep '^login 6 ' <<<"$limits")"
limit_summary() {
  awk -v kind="$1" '$1 == kind { n++; if ($2 == 429) { limited++; if (!first) { first = n } } }
    END { printf "%d %d %d\n", n, limited, first }' <<<"$limits"
}
read -r entry_total entry_429 entry_first <<<"$(limit_summary entry)"
if ((entry_first >= 61 && entry_429 >= 10)); then
  pass "/entry/ limit: the first $((entry_first - 1)) of $entry_total requests were served (burst of 60), then $entry_429 answered 429"
else
  fail "/entry/ limit: burst of 60, then 429" "requests $entry_total, first 429 at request $entry_first, 429 count $entry_429"
fi
read -r api_total api_429 api_first <<<"$(limit_summary api)"
if ((api_first >= 21 && api_429 >= 10)); then
  pass "/api/ limit: the first $((api_first - 1)) of $api_total requests were served (burst of 20), then $api_429 answered 429"
else
  fail "/api/ limit: burst of 20, then 429" "requests $api_total, first 429 at request $api_first, 429 count $api_429"
fi
other_client=$(req -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d "{\"password\":\"$admin_password\"}" "$(site /api/auth/login)")
expect "a different client address is not affected by the limit" "200" "$other_client"

tls12=$(req --tlsv1.2 --tls-max 1.2 -o /dev/null -w '%{http_code}' "$(site /api/health)")
tls13=$(req --tlsv1.3 -o /dev/null -w '%{http_code}' "$(site /api/health)")
expect "TLS 1.2 is accepted" "200" "$tls12"
expect "TLS 1.3 is accepted" "200" "$tls13"
nginx_config=$(dc exec -T nginx nginx -T 2>/dev/null)
expect_match "nginx is configured for TLS 1.2 and 1.3 only" "ssl_protocols TLSv1\.2 TLSv1\.3;" "$nginx_config"
old_tls=$(echo | openssl s_client -connect "127.0.0.1:$https_port" -servername localhost -tls1_1 2>&1 || true)
if [[ $old_tls == *"no protocols available"* ]]; then
  echo "SKIP  TLS 1.1 handshake (the local openssl cannot speak TLS 1.1)"
else
  expect_match "TLS 1.1 is refused by the server" "alert protocol version|wrong version number|handshake failure" "$old_tls"
fi

echo "Recreating web while probing /api/health every 200 ms"
for mode in same moved; do
  measure_recreate "web recreated ($mode address), current template" 90 "$mode"
  expect "nginx recovers after web is recreated ($mode address)" "recovered" "$gap_state"
  if awk -v gap="$gap_seconds" -v max="$max_gap" 'BEGIN { exit !(gap <= max) }'; then
    pass "nginx returned errors for ${gap_seconds}s at most while web was recreated ($mode address, limit ${max_gap}s)"
  else
    fail "nginx returned errors for ${gap_seconds}s while web was recreated ($mode address)" "limit is ${max_gap}s"
  fi
  if [ "$mode" = moved ]; then
    expect "the recreated web container really got a different address" "different" \
      "$([ "$before_address" != "$after_address" ] && echo different || echo same)"
  fi
done

if [ -n "$old_template" ]; then
  echo "Reproducing the original defect with the template from $old_template"
  mkdir -p "$workdir/old-templates"
  cp "$old_template" "$workdir/old-templates/default.conf.template"
  cat >"$workdir/override-old-template.yml" <<EOF
services:
  nginx:
    volumes:
      - $workdir/old-templates:/etc/nginx/templates:ro
EOF
  compose_files+=(-f "$workdir/override-old-template.yml")
  dc up -d --no-build --force-recreate nginx >/dev/null 2>&1
  wait_for "nginx with the old template to be healthy" 120 service_healthy nginx
  expect "old template: nginx serves while web is untouched" "200" "$(status_of "$(site /api/health)")"
  measure_recreate "web recreated (moved address), old template" 30 moved
  if [ "$gap_state" = unrecovered ]; then
    pass "old template keeps returning errors after web gets a new address (defect reproduced)"
  else
    fail "old template did not reproduce the defect" "web became reachable again after ${gap_seconds}s"
  fi
  dc exec -T nginx nginx -s reload >/dev/null 2>&1
  wait_for "the old template to recover after a manual reload" 30 health_ok
  pass "old template only recovers after a manual nginx reload"
  compose_files=(-f "$repo/docker-compose.yml")
  dc up -d --no-build --force-recreate nginx >/dev/null 2>&1
  wait_for "nginx with the current template to be healthy" 120 service_healthy nginx
fi

echo "Certificate reload and log rotation with short intervals"
NGINX_RELOAD_INTERVAL=3 NGINX_LOG_MAX_BYTES=4000 NGINX_LOG_KEEP=2 NGINX_LOG_CHECK_SECONDS=1 \
  dc up -d --no-build --force-recreate nginx >/dev/null 2>&1
wait_for "nginx to be healthy" 120 service_healthy nginx
before_fingerprint=$(served_fingerprint)
make_certificate second
changed() {
  local current
  current=$(served_fingerprint) && [ -n "$current" ] && [ "$current" != "$before_fingerprint" ]
}
if wait_for "nginx to serve the renewed certificate" 20 changed; then
  pass "the reload loop makes nginx serve a renewed certificate"
else
  fail "the reload loop makes nginx serve a renewed certificate" "fingerprint did not change within 20s"
fi
for i in $(seq 1 60); do
  req -o /dev/null "$(site "/api/health?rotate=$i")"
done
rotated() {
  dc exec -T nginx sh -c 'test -f /var/log/nginx-shared/access.log.1'
}
if wait_for "the access log to rotate" 20 rotated; then
  pass "the access log is rotated once it exceeds NGINX_LOG_MAX_BYTES"
else
  fail "the access log is rotated once it exceeds NGINX_LOG_MAX_BYTES"
fi
fresh_log_written() {
  req -o /dev/null "$(site "/api/health?after-rotation=$SECONDS")"
  sleep 0.5
  dc exec -T nginx grep -q 'after-rotation=' /var/log/nginx-shared/access.log
}
if wait_for "nginx to write to the fresh access.log" 20 fresh_log_written; then
  pass "nginx keeps writing to a fresh access.log after rotation"
else
  fail "nginx keeps writing to a fresh access.log after rotation"
fi
regular=$(dc exec -T nginx sh -c 'test -L /var/log/nginx-shared/access.log && echo symlink || echo file')
expect "the shared access log is a regular file, not a stdout symlink" "file" "$regular"
stdout_log=$(dc logs --no-log-prefix nginx 2>&1)
expect_match "access log lines also reach docker logs" "GET /api/health\?after-rotation=" "$stdout_log"

echo "Resource limits and users"
for service in web nginx db; do
  limit=$(docker inspect --format '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}' "$(dc ps -q "$service")")
  expect_match "$service has a memory and cpu limit" "^[1-9][0-9]+ [1-9][0-9]+$" "$limit"
done
expect "web runs as an unprivileged user" "1000" "$(dc exec -T web id -u | tr -d '\r')"
expect "web publishes no ports" "0" "$(docker inspect --format '{{len .HostConfig.PortBindings}}' "$(dc ps -q web)")"
expect "db publishes no ports" "0" "$(docker inspect --format '{{len .HostConfig.PortBindings}}' "$(dc ps -q db)")"

echo "Backups"
dc exec -T db psql -U tasrif -d tasrif -q -c \
  "INSERT INTO lexical_entry (language, text, root, morph_pattern_id) VALUES ('ar', 'كَتَبَ', 'كتب', (SELECT id FROM morph_pattern WHERE description = 'a ~ u' LIMIT 1))" >/dev/null
entries=$(dc exec -T db psql -U tasrif -d tasrif -At -c "SELECT count(*) FROM lexical_entry")
expect "a test entry exists before the backup" "1" "$entries"
mkdir -p "$workdir/backups"
backup() {
  dc run --rm --no-deps -T "$@" --entrypoint db-backup backup
}
backup >/dev/null
plain=$(in_backups 'ls /b | grep -E "^tasrif-.*\.dump$" | head -n 1')
if [ -n "$plain" ]; then
  pass "a plain backup was written"
else
  fail "a plain backup was written"
fi
expect "the backup directory belongs to uid 999 and the dump is mode 600" "999 600" \
  "$(in_backups 'echo "$(stat -c %u /b) $(stat -c %a "/b/$1")"' _ "$plain")"
expect "the plain backup is a PostgreSQL custom-format archive" "PGDMP" "$(in_backups 'head -c 5 "/b/$1"' _ "$plain")"
dc exec -T db psql -U postgres -q -c "CREATE DATABASE smoke_restore" >/dev/null
in_backups 'cat "/b/$1"' _ "$plain" | dc exec -T db pg_restore -U postgres -d smoke_restore --no-owner --exit-on-error
restored=$(dc exec -T db psql -U postgres -d smoke_restore -At -c "SELECT count(*) || ':' || min(text) FROM lexical_entry")
expect "restoring the backup into a scratch database brings the entry back" "1:كَتَبَ" "$restored"
dc exec -T db psql -U postgres -q -c "DROP DATABASE smoke_restore" >/dev/null

sleep 1
backup -e "BACKUP_PASSPHRASE=$passphrase" >/dev/null
encrypted=$(in_backups 'ls /b | grep -E "^tasrif-.*\.dump\.gpg$" | head -n 1')
if [ -n "$encrypted" ]; then
  pass "an encrypted backup was written when BACKUP_PASSPHRASE is set"
  expect_no_match "the encrypted backup is not a readable archive" "PGDMP" "$(in_backups 'head -c 5 "/b/$1"' _ "$encrypted")"
  decrypt='gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "/b/$1" 3<<<"$PASS"'
  decrypted=$(docker run --rm --entrypoint bash -e "PASS=$passphrase" -v "$workdir/backups:/b:ro" "$db_image" \
    -c "$decrypt | pg_restore --list | grep -c 'TABLE DATA'" _ "$encrypted" || true)
  expect_match "the encrypted backup decrypts with the passphrase and lists table data" "^[1-9][0-9]*$" "$decrypted"
  wrong_passphrase=$(docker run --rm --entrypoint bash -e "PASS=not-the-passphrase" -v "$workdir/backups:/b:ro" "$db_image" \
    -c "$decrypt | wc -c" _ "$encrypted" 2>/dev/null || true)
  expect "a wrong passphrase yields no data" "0" "$(tr -d ' \n' <<<"$wrong_passphrase")"
else
  fail "an encrypted backup was written when BACKUP_PASSPHRASE is set"
fi

mkdir -p "$workdir/offsite"
chmod 777 "$workdir/offsite"
sleep 1
backup -e 'BACKUP_UPLOAD_COMMAND=cp "$1" /offsite/' -v "$workdir/offsite:/offsite" >/dev/null
uploaded=$(find "$workdir/offsite" -maxdepth 1 -name 'tasrif-*.dump' | wc -l | tr -d ' ')
expect "BACKUP_UPLOAD_COMMAND receives the finished file as \$1" "1" "$uploaded"
sleep 1
if backup -e 'BACKUP_UPLOAD_COMMAND=false' >/dev/null 2>&1; then
  fail "a failing upload command fails the backup run"
else
  pass "a failing upload command fails the backup run (the local dump is kept)"
fi

for _ in 1 2 3; do
  sleep 1
  backup -e BACKUP_KEEP=2 >/dev/null
done
remaining=$(in_backups 'ls /b | grep -cE "^tasrif-.*\.dump(\.gpg)?$"')
expect "retention keeps only the newest BACKUP_KEEP backups" "2" "$remaining"
leftovers=$(in_backups 'ls -A /b | grep -c "^\.work\." || true')
expect "no temporary working directories are left behind" "0" "$leftovers"
