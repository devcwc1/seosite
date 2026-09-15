#!/usr/bin/env bash
#
# Rebuild an Orbit install from a directory produced by export-state.sh.
#
#   bash import-state.sh <target-checkout-dir>
#
# Run it from inside the transfer directory. It is safe to re-run: the only
# destructive step is the database restore, which asks first.
#
set -euo pipefail
# NOTE: MSYS_NO_PATHCONV is set per-command, never exported. Exported, Git
# Bash also stops translating paths for git.exe and every `git -C /d/...`
# fails with exit 128.

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:?usage: bash import-state.sh <target-checkout-dir>}"

PG_CONTAINER="${PG_CONTAINER:-orbit-postgres-1}"
step() { printf '\n== %s\n' "$*"; }

# -- 1. code ---------------------------------------------------------------
step "Cloning the repository into $TARGET"
if [ -d "$TARGET/.git" ]; then
  echo "   already a checkout, leaving it alone"
else
  git clone "$BUNDLE_DIR/orbit-repo.bundle" "$TARGET"
  # The bundle is a one-shot artifact, not a server to keep pointing at.
  git -C "$TARGET" remote remove origin || true
fi

# -- 2. secrets ------------------------------------------------------------
step "Restoring env files"
( cd "$BUNDLE_DIR/secrets" && find . -type f -name '.env' -print0 ) |
  while IFS= read -r -d '' f; do
    install -D "$BUNDLE_DIR/secrets/$f" "$TARGET/$f"
    echo "   $f"
  done
echo "   !! DATABASE_URL in apps/orbit-admin/.env points at localhost:5432."
echo "      Correct if this machine reaches Postgres differently."

# -- 3. dependencies and database ------------------------------------------
step "Installing dependencies (npm ci)"
( cd "$TARGET" && npm ci )

step "Starting Postgres"
( cd "$TARGET" && docker compose up -d postgres )
echo "   waiting for health..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null)" = healthy ]; do
  sleep 2
done

step "Restoring the database"
PGUSER="$(grep -m1 '^POSTGRES_USER=' "$TARGET/.env" | cut -d= -f2- | tr -d '\r"')"
PGDB="$(grep -m1 '^POSTGRES_DB=' "$TARGET/.env" | cut -d= -f2- | tr -d '\r"')"
echo "   this DROPS and recreates every table in $PGDB."
read -rp "   type 'yes' to continue: " ok
[ "$ok" = yes ] || { echo "   skipped"; exit 0; }
docker exec -i "$PG_CONTAINER" pg_restore -U "$PGUSER" -d "$PGDB" \
  --clean --if-exists --no-owner --no-privileges < "$BUNDLE_DIR/orbit_admin.dump"

# -- 4. media --------------------------------------------------------------
step "Restoring uploaded media"
if [ -f "$BUNDLE_DIR/media-host.tgz" ]; then
  mkdir -p "$TARGET/apps/orbit-admin/media"
  tar -xzf "$BUNDLE_DIR/media-host.tgz" -C "$TARGET/apps/orbit-admin/media"
  echo "   host media restored"
fi
if [ -f "$BUNDLE_DIR/media-volume.tgz" ]; then
  docker volume create orbit_media >/dev/null
  MSYS_NO_PATHCONV=1 docker run --rm -i -v orbit_media:/v postgres:16-alpine \
    tar -xzf - -C /v < "$BUNDLE_DIR/media-volume.tgz"
  echo "   volume media restored"
fi

printf '\n== Done. Start it with:  npm run dev\n'
