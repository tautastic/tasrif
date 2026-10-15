#!/bin/sh
set -e

interval=${NGINX_RELOAD_INTERVAL:-12h}

(
  while :; do
    sleep "$interval"
    nginx -s reload
  done
) &
