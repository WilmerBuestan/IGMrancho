#!/bin/sh
# Trae lo último de GitHub y reconstruye IGM Rancho (los datos y el .env no se tocan).
set -e
cd "$(dirname "$0")"
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
