#!/bin/sh
set -e

if [ -f /proc/net/if_inet6 ]; then
  exit 0
fi

sed -i '/^[[:space:]]*listen[[:space:]]\+\[::\]/d' /etc/nginx/conf.d/default.conf
echo "$0: IPv6 is not available, removed the IPv6 listen directives"
