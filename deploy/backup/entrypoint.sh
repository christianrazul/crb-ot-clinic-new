#!/bin/sh
# crond starts jobs with an empty environment, so save the settings they need
# to a root-only file, make sure the restic repository exists, then run crond.
set -eu
umask 077
export -p | grep -E ' (PG[A-Z]*|RESTIC_[A-Z_]*|AWS_[A-Z_]*)=' > /run/backup.env
. /run/backup.env
if ! restic cat config >/dev/null 2>&1; then
  echo "Creating restic repository at $RESTIC_REPOSITORY"
  restic init
fi
exec crond -f -l 8
