#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
image=$(grep -oE 'crazymax/fail2ban:[0-9][0-9.]*' "$repo/docker-compose.yml" | head -n 1)
sample=$repo/fail2ban/tests/access.log
expected_login=7
expected_botsearch=7
failed=0

matched_lines() {
  docker run --rm --entrypoint fail2ban-regex -v "$sample:/sample/access.log:ro" \
    -v "$repo/fail2ban/filter.d:/filters:ro" "$image" /sample/access.log "$1" \
    | sed -n 's/^Lines: [0-9]* lines, [0-9]* ignored, \([0-9]*\) matched.*/\1/p'
}

check() {
  local name=$1 expected=$2 actual=$3
  if [ "$actual" = "$expected" ]; then
    echo "PASS  $name matches $actual sample lines"
  else
    echo "FAIL  $name matches '$actual' sample lines, expected $expected"
    failed=1
  fi
}

check "nginx-login filter" "$expected_login" "$(matched_lines /filters/nginx-login.conf)"
check "nginx-botsearch filter" "$expected_botsearch" "$(matched_lines nginx-botsearch)"

if docker run --rm --entrypoint fail2ban-client \
  -v "$sample:/var/log/nginx/access.log:ro" \
  -v "$repo/fail2ban/filter.d/nginx-login.conf:/etc/fail2ban/filter.d/nginx-login.conf:ro" \
  -v "$repo/fail2ban/jail.d/nginx-login.conf:/etc/fail2ban/jail.d/nginx-login.conf:ro" \
  -v "$repo/fail2ban/jail.d/nginx-botsearch.conf:/etc/fail2ban/jail.d/nginx-botsearch.conf:ro" \
  "$image" -t >/dev/null 2>&1; then
  echo "PASS  jail and filter configuration is accepted by $image"
else
  echo "FAIL  jail and filter configuration is rejected by $image"
  failed=1
fi

exit "$failed"
