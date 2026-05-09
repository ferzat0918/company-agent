#!/usr/bin/env bash
# =============================================================================
#  backup-db.sh — pg_dump backup script for Supabase Self-Hosted
#
#  Dumps all databases from the Supabase Postgres container.
#  Produces timestamped backups and keeps only the last 7.
# =============================================================================
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
CONTAINER_NAME="${CONTAINER_NAME:-supabase-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# ── Ensure backup directory exists ───────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Perform backup ───────────────────────────────────────────────────────────
BACKUP_FILE="${BACKUP_DIR}/supabase_${TIMESTAMP}.sql"

echo "[backup-db] Dumping all databases from container '${CONTAINER_NAME}'..."
docker exec "$CONTAINER_NAME" \
    pg_dumpall -U "$DB_USER" \
    > "$BACKUP_FILE"

# shellcheck disable=SC2181
if [ $? -eq 0 ]; then
    gzip "$BACKUP_FILE"
    echo "[backup-db] Backup saved: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))"
else
    echo "[backup-db] ERROR: pg_dumpall failed." >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi

# ── Rotate old backups (keep last N) ─────────────────────────────────────────
echo "[backup-db] Rotating backups — keeping last ${RETENTION_COUNT}..."
ls -1t "${BACKUP_DIR}"/supabase_*.sql.gz 2>/dev/null \
    | tail -n +$((RETENTION_COUNT + 1)) \
    | while read -r old; do
        rm -v "$old"
    done

echo "[backup-db] Done."
