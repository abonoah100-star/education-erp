#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose --env-file .env -f compose.vps.yml)
test -f .env || { echo "ERROR: Missing .env file."; exit 1; }
docker network inspect education-erp-internal >/dev/null 2>&1 || { echo "ERROR: Missing Docker network education-erp-internal."; exit 1; }
echo "==> Building application images"
"${COMPOSE[@]}" build
echo "==> Applying database migrations"
"${COMPOSE[@]}" run --rm --no-deps backend npx prisma migrate deploy
echo "==> Loading controlled staging seed data"
"${COMPOSE[@]}" run --rm --no-deps backend npm run prisma:seed
echo "==> Starting application services"
"${COMPOSE[@]}" up -d --remove-orphans
echo "==> Application status"
"${COMPOSE[@]}" ps
