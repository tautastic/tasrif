#!/usr/bin/env bash
set -Eeuo pipefail

if [ ! -f .env ]; then
  echo ".env not found — copy .env.example to .env and fill it in first" >&2
  exit 1
fi
set -a
source .env
set +a

: "${DOMAIN:?DOMAIN must be set in .env}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set in .env}"

rsa_key_size=4096
live_path="/etc/letsencrypt/live/$DOMAIN"

echo "### Creating a temporary self-signed certificate for $DOMAIN ..."
docker compose run --rm --entrypoint "/bin/sh -c \"\
  mkdir -p $live_path && \
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
    -keyout $live_path/privkey.pem \
    -out $live_path/fullchain.pem \
    -subj /CN=localhost\"" certbot

echo "### Starting nginx ..."
docker compose up -d nginx

echo "### Deleting the temporary certificate ..."
docker compose run --rm --entrypoint "/bin/sh -c \"\
  rm -rf /etc/letsencrypt/live/$DOMAIN && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf\"" certbot

echo "### Requesting a Let's Encrypt certificate for $DOMAIN ..."
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $CERTBOT_EMAIL -d $DOMAIN \
    --rsa-key-size $rsa_key_size --agree-tos --non-interactive" certbot

echo "### Reloading nginx ..."
docker compose exec nginx nginx -s reload

echo "Done — certificates live in the certbot-etc volume and renew automatically every 12h via the certbot service."