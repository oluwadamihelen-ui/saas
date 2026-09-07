#!/usr/bin/env bash
# Dumps the platform's Postgres database to a timestamped, compressed file
# under backups/ using pg_dump's custom format (restorable with pg_restore,
# and with plain `pg_restore -l` to inspect contents without restoring).
#
# Usage:
#   ./scripts/backup-db.sh                 # uses DATABASE_URL from .env
#   ./scripts/backup-db.sh --keep 7         # also deletes backups older than
#                                           # the 7 most recent
#
# For real production use, point a cron job at this script and sync
# backups/ to remote storage (S3, GCS, etc.) afterward -- this script only
# handles the local dump; where it ends up long-term is a deployment
# decision, not a platform one.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (checked environment and .env)." >&2
  exit 1
fi

# Prisma's connection string convention adds query params (?schema=public)
# that plain libpq tools like pg_dump don't understand -- strip them, since
# a full-database dump doesn't need schema selection anyway.
PG_URL="${DATABASE_URL%%\?*}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install the PostgreSQL client tools." >&2
  exit 1
fi

KEEP=""
if [ "${1:-}" = "--keep" ]; then
  KEEP="${2:?--keep requires a number}"
fi

mkdir -p backups
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="backups/saas_platform_${TIMESTAMP}.dump"

echo "Backing up database to ${OUT} ..."
pg_dump --format=custom --no-owner --no-privileges --dbname="${PG_URL}" --file="${OUT}"
echo "Backup complete: ${OUT} ($(du -h "${OUT}" | cut -f1))"

if [ -n "${KEEP}" ]; then
  COUNT=$(find backups -maxdepth 1 -name 'saas_platform_*.dump' | wc -l)
  if [ "${COUNT}" -gt "${KEEP}" ]; then
    echo "Pruning old backups, keeping the ${KEEP} most recent ..."
    find backups -maxdepth 1 -name 'saas_platform_*.dump' -print0 \
      | xargs -0 ls -t \
      | tail -n +"$((KEEP + 1))" \
      | xargs -r rm -v
  fi
fi
