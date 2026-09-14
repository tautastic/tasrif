#!/bin/sh
set -e

(
  while :; do
    sleep 12h
    nginx -s reload
  done
) &