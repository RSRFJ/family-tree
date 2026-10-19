#!/bin/sh
set -eu
umask 077
: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${PGPASSWORD:?}"

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="/backups/familytree-$STAMP.dump"

echo "[backup] start $STAMP"
echo "[backup] prune expired sessions and audit_log older than 1 year"
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 \
  -c "DELETE FROM sessions WHERE expires_at < now(); DELETE FROM preview_sessions WHERE expires_at < now(); DELETE FROM audit_log WHERE created_at < now() - interval '1 year'" \
  || echo "[backup] cleanup failed (continue)" >&2
if ! pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -Fc --no-owner --no-privileges -f "$OUT"; then
  echo "[backup] FAILED" >&2; rm -f "$OUT"; exit 1
fi
if [ ! -s "$OUT" ]; then
  echo "[backup] empty dump" >&2; rm -f "$OUT"; exit 1
fi
sha256sum "$OUT" > "$OUT.sha256"
# 只允许 root 和 web 容器补充组 1001 读取备份
chown root:1001 "$OUT" "$OUT.sha256" 2>/dev/null || true
chmod 640 "$OUT" "$OUT.sha256" 2>/dev/null || true

ls -1t /backups/familytree-*.dump 2>/dev/null | tail -n +8 | while read -r f; do
  echo "[backup] prune $f"; rm -f "$f" "$f.sha256"
done

echo "[backup] done $(du -h "$OUT" | cut -f1)"
