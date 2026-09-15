#!/usr/bin/env bash
#
# Package everything about this Orbit install that a fresh machine cannot
# rebuild for itself, into one directory you can copy across.
#
#   bash scripts/export-state.sh [output-dir]
#
# What is NOT in here, deliberately:
#   - Docker images. They are rebuilt from the Dockerfiles on the far side.
#     A saved image is tied to this machine's architecture; a rebuild is not.
#   - The raw pgdata volume. Postgres data directories are tied to the server
#     major version, the platform and the endianness of the machine that wrote
#     them. A pg_dump restores onto any of them.
#   - node_modules. `npm ci` reproduces it from package-lock.json.
#
set -euo pipefail
# NOTE: MSYS_NO_PATHCONV is set per-command, never exported. Exported, Git
# Bash also stops translating paths for git.exe and every `git -C /d/...`
# fails with exit 128.

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$(dirname "$REPO")/orbit-transfer-$(date +%Y%m%d-%H%M%S)}"

PG_CONTAINER="${PG_CONTAINER:-orbit-postgres-1}"
MEDIA_VOLUME="${MEDIA_VOLUME:-orbit_media}"
HOST_MEDIA="$REPO/apps/orbit-admin/media"

say() { printf '  %s\n' "$*"; }

mkdir -p "$OUT/secrets"
echo "Exporting Orbit state -> $OUT"

# -- code ------------------------------------------------------------------
# There is no git remote, so the repository is the artifact. A bundle carries
# every branch and every commit in a single file and clones like a remote.
say "git bundle (all branches, full history)"
git -C "$REPO" bundle create "$OUT/orbit-repo.bundle" --all >/dev/null 2>&1
git -C "$REPO" branch --format='%(refname:short) %(objectname:short)' > "$OUT/branches.txt"

# -- database --------------------------------------------------------------
if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  PGUSER="$(grep -m1 '^POSTGRES_USER=' "$REPO/.env" | cut -d= -f2- | tr -d '\r"')"
  PGDB="$(grep -m1 '^POSTGRES_DB=' "$REPO/.env" | cut -d= -f2- | tr -d '\r"')"
  say "pg_dump ${PGDB} (custom format, compressed)"
  docker exec "$PG_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" -Fc \
    > "$OUT/orbit_admin.dump"
else
  echo "  !! $PG_CONTAINER is not running — cannot dump the database." >&2
  exit 1
fi

# -- media -----------------------------------------------------------------
# Uploaded files are content-addressed on disk and referenced by rows in
# media_assets. A dump without them leaves every image 404ing, so both halves
# travel together. Dev writes to the host directory; Docker writes to the
# volume. Whichever has files, take it.
if [ -d "$HOST_MEDIA" ] && [ -n "$(find "$HOST_MEDIA" -type f -print -quit)" ]; then
  say "media from host ($(find "$HOST_MEDIA" -type f | wc -l | tr -d ' ') files)"
  tar -czf "$OUT/media-host.tgz" -C "$HOST_MEDIA" .
fi
if docker volume inspect "$MEDIA_VOLUME" >/dev/null 2>&1 &&
   [ -n "$(MSYS_NO_PATHCONV=1 docker run --rm -v "$MEDIA_VOLUME":/v postgres:16-alpine \
             find /v -type f -print -quit 2>/dev/null)" ]; then
  say "media from volume $MEDIA_VOLUME"
  MSYS_NO_PATHCONV=1 docker run --rm -v "$MEDIA_VOLUME":/v postgres:16-alpine \
    tar -czf - -C /v . > "$OUT/media-volume.tgz"
fi

# -- secrets ---------------------------------------------------------------
# Gitignored, and the stack will not start without them: ORBIT_WRITE_TOKEN
# must be identical on both apps or order intake refuses every write.
say "env files -> secrets/ (PLAINTEXT — see WARNING in RESTORE.md)"
for f in .env apps/orbit-admin/.env apps/storefront/.env; do
  [ -f "$REPO/$f" ] && install -D "$REPO/$f" "$OUT/secrets/$f"
done

cp "$REPO/scripts/import-state.sh" "$OUT/import-state.sh"
cp "$REPO/scripts/RESTORE.md"      "$OUT/RESTORE.md"
echo
echo "Done. $(du -sh "$OUT" | cut -f1) in $OUT"
echo "Read $OUT/RESTORE.md on the target machine."
