#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <image-tag>" >&2
  echo "Example: $0 dev-<sha>" >&2
  exit 1
fi

REPO_DIR="/home/nacho/.openclaw/workspace/Spotify-Insights"
COMPOSE_FILE="$REPO_DIR/docker-compose.dev.yml"
PROJECT_NAME="spotifydev"
IMAGE="ghcr.io/ignaciobelmonte/spotify-insights:${TAG}"

cd "$REPO_DIR"

echo "[deploy-dev] Using image: $IMAGE"

# Compose uses IMAGE env var
export SPOTIFY_INSIGHTS_IMAGE="$IMAGE"

# Pull + restart
sudo -E docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" pull app
sudo -E docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d

# Migrations are handled by container CMD (prisma migrate deploy) and do NOT delete the DB.

curl -fsS http://127.0.0.1:3001/api/health >/dev/null

echo "[deploy-dev] OK"
