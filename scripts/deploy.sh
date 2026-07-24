#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
for key in POSTGRES_PASSWORD REDIS_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do grep -q "^${key}=" .env || { echo "Missing ${key}"; exit 1; }; done
docker compose -f compose.yml up -d --build
docker compose -f compose.yml exec -T backend npx prisma migrate deploy
docker compose -f compose.yml exec -T backend npm run prisma:seed
docker compose -f compose.yml ps
