#!/bin/sh
set -eu

mkdir -p /app/data /app/storage /app/backups
chown -R nextjs:nodejs /app/data /app/storage /app/backups

echo "Gaya: volumes persistentes preparados; iniciando na porta ${PORT:-80}."
exec gosu nextjs "$@"
