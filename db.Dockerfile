# syntax=docker/dockerfile:1
FROM postgres:18-trixie

COPY --chmod=755 docker/db/init.sh /docker-entrypoint-initdb.d/tasrif-init.sh
COPY --chmod=755 docker/db/healthcheck.sh /usr/local/bin/db-healthcheck
COPY --chmod=755 docker/db/backup.sh /usr/local/bin/db-backup
COPY db/ /opt/tasrif/db/
