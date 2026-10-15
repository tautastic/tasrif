#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
image=$(grep -oE 'nginx:[0-9][0-9.]*-alpine' "$repo/docker-compose.yml" | head -n 1)
workdir=$(mktemp -d "${TMPDIR:-/tmp}/tasrif-nginx-check.XXXXXX")
failed=0

network="tasrif-nginx-check-$$"
trap 'docker rm -f "$network-stub" "$network-nginx" >/dev/null 2>&1 || true; docker network rm "$network" >/dev/null 2>&1 || true; rm -rf "$workdir"' EXIT

mkdir -p "$workdir/live/localhost" "$workdir/logs"
chmod 777 "$workdir/logs"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj /CN=localhost \
  -keyout "$workdir/live/localhost/privkey.pem" -out "$workdir/live/localhost/fullchain.pem" 2>/dev/null

run_in_image() {
  docker run --rm -e DOMAIN=localhost -e "PUBLIC_HTTPS_PORT=$1" \
    -v "$repo/nginx/templates:/etc/nginx/templates:ro" \
    -v "$repo/nginx/docker-entrypoint.d/25-ipv6-listen.sh:/docker-entrypoint.d/25-ipv6-listen.sh:ro" \
    -v "$workdir/live:/etc/letsencrypt/live:ro" \
    -v "$workdir/logs:/var/log/nginx-shared" \
    "$image" "${@:2}"
}

for port in 443 8443; do
  if output=$(run_in_image "$port" nginx -t 2>&1); then
    echo "PASS  nginx -t accepts the rendered template in $image (PUBLIC_HTTPS_PORT=$port)"
  else
    echo "FAIL  nginx -t rejects the rendered template in $image (PUBLIC_HTTPS_PORT=$port)"
    echo "$output"
    failed=1
  fi
done

rendered=$(run_in_image 443 nginx -T 2>&1 || true)
for directive in "http2 on;" "ssl_protocols TLSv1.2 TLSv1.3;" "resolver 127.0.0.11" "limit_req_zone \$binary_remote_addr zone=login"; do
  if grep -qF -- "$directive" <<<"$rendered"; then
    echo "PASS  rendered configuration contains '$directive'"
  else
    echo "FAIL  rendered configuration lacks '$directive'"
    failed=1
  fi
done

cat >"$workdir/stub.js" <<'JS'
const http = require("node:http");
const cacheControl = "s-maxage=3600, stale-while-revalidate=31532400";
http
  .createServer((request, response) => {
    if (request.url.startsWith("/entry/old")) {
      response.writeHead(308, { Location: "/entry/new", "Cache-Control": cacheControl });
    } else if (request.url.startsWith("/entry/ok")) {
      response.writeHead(200, { "Cache-Control": cacheControl, "Content-Type": "text/plain" });
      response.write("ok");
    } else {
      response.writeHead(404, { "Content-Type": "text/plain" });
    }
    response.end();
  })
  .listen(3000);
JS

cat >"$workdir/client.js" <<'JS'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const probe = async (path) => {
  const response = await fetch(`https://nginx${path}`, { redirect: "manual" });
  const headers = Object.fromEntries(response.headers);
  console.log(
    [
      path,
      response.status,
      headers["cache-control"] ?? "-",
      headers["strict-transport-security"] ? "hsts" : "no-hsts",
      headers["x-content-type-options"] ?? "-",
      headers["x-frame-options"] ?? "-",
      headers["referrer-policy"] ?? "-",
      headers.location ?? "-",
    ].join("|"),
  );
};
(async () => {
  for (const path of ["/entry/old", "/entry/ok", "/entry/missing"]) {
    await probe(path);
  }
})();
JS

docker network create "$network" >/dev/null
docker run -d --name "$network-stub" --network "$network" --network-alias web \
  -v "$workdir/stub.js:/stub.js:ro" node:24-slim node /stub.js >/dev/null
docker run -d --name "$network-nginx" --network "$network" --network-alias nginx \
  -e DOMAIN=localhost -e PUBLIC_HTTPS_PORT=443 \
  -v "$repo/nginx/templates:/etc/nginx/templates:ro" \
  -v "$repo/nginx/docker-entrypoint.d/25-ipv6-listen.sh:/docker-entrypoint.d/25-ipv6-listen.sh:ro" \
  -v "$workdir/live:/etc/letsencrypt/live:ro" \
  -v "$workdir/logs:/var/log/nginx-shared" \
  "$image" >/dev/null
sleep 4
probes=$(docker run --rm --network "$network" -v "$workdir/client.js:/client.js:ro" node:24-slim node /client.js 2>/dev/null || true)

secure="hsts|nosniff|SAMEORIGIN|strict-origin-when-cross-origin"
expect_probe() {
  if grep -qxF -- "$2" <<<"$probes"; then
    echo "PASS  $1"
  else
    echo "FAIL  $1 (expected '$2')"
    echo "$probes"
    failed=1
  fi
}
expect_probe "a permanent redirect under /entry/ gets a one day max-age and keeps the security headers" \
  "/entry/old|308|public, max-age=86400|$secure|/entry/new"
expect_probe "a cached entry page keeps the upstream cache header and the security headers" \
  "/entry/ok|200|s-maxage=3600, stale-while-revalidate=31532400|$secure|-"
expect_probe "an entry 404 is marked no-store and carries the security headers" \
  "/entry/missing|404|no-store|$secure|-"

exit "$failed"
