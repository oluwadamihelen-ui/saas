#!/bin/sh
# Runs on every container start (not at image build time — see the
# Dockerfile's comment on why). `prisma migrate deploy` only applies
# migrations that haven't run yet, so restarting an already-up-to-date
# container is always safe and fast.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting Schoolum..."
exec npx next start -p 3001
