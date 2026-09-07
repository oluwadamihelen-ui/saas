#!/usr/bin/env bash
# Restores a backup produced by backup-db.sh into the database DATABASE_URL
# points at. Destructive: --clean drops existing objects before recreating
# them, so this overwrites whatever is currently in that database.
#
# Usage:
#   ./scripts/restore-db.sh backups/saas_platform_20260101T000000Z.dump
#
# Set RESTORE_CONFIRM=yes to skip the interactive confirmation prompt (for
# scripted/CI use) -- otherwise this always asks first, since there is no
# undo once the target database's existing data has been dropped.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DUMP_FILE="${1:?Usage: ./scripts/restore-db.sh <path-to-dump-file>}"

if [ ! -f "${DUMP_FILE}" ]; then
  echo "Dump file not found: ${DUMP_FILE}" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (checked environment and .env)." >&2
  exit 1
fi

# Prisma's connection string convention adds query params (?schema=public)
# that plain libpq tools like pg_restore don't understand -- strip them.
PG_URL="${DATABASE_URL%%\?*}"

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore not found. Install the PostgreSQL client tools." >&2
  exit 1
fi

if [ "${RESTORE_CONFIRM:-}" != "yes" ]; then
  echo "This will DROP and recreate objects in the database at:"
  echo "  ${PG_URL}"
  echo "using: ${DUMP_FILE}"
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Restoring ${DUMP_FILE} ..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${PG_URL}" "${DUMP_FILE}"
echo "Restore complete."
