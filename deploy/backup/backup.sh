#!/bin/sh
# Nightly: dump the database straight into restic (nothing unencrypted on disk),
# then thin out old snapshots. `backup.sh check` verifies a sample of the data.
set -eu
set -o pipefail
. /run/backup.env

if [ "${1:-}" = "check" ]; then
  restic check --read-data-subset=10%
  exit 0
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump --format=custom --no-owner --no-privileges \
  | restic backup --stdin --stdin-filename "crb-$stamp.dump" --tag postgres
restic forget --tag postgres --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
echo "Backup crb-$stamp.dump done"
