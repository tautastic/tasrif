#!/bin/sh
set -e

log_dir=/var/log/nginx-shared
max_bytes=${NGINX_LOG_MAX_BYTES:-52428800}
keep=${NGINX_LOG_KEEP:-3}
interval=${NGINX_LOG_CHECK_SECONDS:-300}
reopen_pending=0

reopen() {
  nginx -s reopen && reopen_pending=0
}

rotate() {
  i=$((keep - 1))
  rm -f "$log_dir/access.log.$keep" || return 1
  while [ "$i" -ge 1 ]; do
    if [ -f "$log_dir/access.log.$i" ]; then
      mv -f "$log_dir/access.log.$i" "$log_dir/access.log.$((i + 1))" || return 1
    fi
    i=$((i - 1))
  done
  mv -f "$log_dir/access.log" "$log_dir/access.log.1" || return 1
  reopen_pending=1
  reopen
}

(
  while :; do
    sleep "$interval"
    if [ "$reopen_pending" = 1 ]; then
      reopen || echo "98-rotate-logs: nginx did not reopen its logs, trying again in ${interval}s" >&2
    elif [ -f "$log_dir/access.log" ] && [ "$(wc -c <"$log_dir/access.log")" -ge "$max_bytes" ]; then
      rotate || echo "98-rotate-logs: log rotation failed, trying again in ${interval}s" >&2
    fi
  done
) &
