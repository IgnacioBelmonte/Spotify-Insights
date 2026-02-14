#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/nacho/.openclaw/workspace/Spotify-Insights"
COMPOSE_FILE="$REPO_DIR/docker-compose.dev.yml"
PROJECT_NAME="spotifydev"

cd "$REPO_DIR"

echo "[deploy-dev] Starting deploy for branch/dev at $(git rev-parse --short HEAD)"

# Build + run dev stack only
sudo docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build

# Health check
curl -fsS http://127.0.0.1:3001/api/health >/dev/null

echo "[deploy-dev] OK"
