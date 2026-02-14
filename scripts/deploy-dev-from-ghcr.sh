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
# Also pass the tag so the app can display it in /api/health
export APP_IMAGE_TAG="$TAG"

# Pull + restart
sudo -E docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" pull app
sudo -E docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d

# Migrations are handled by container CMD (prisma migrate deploy) and do NOT delete the DB.

# Wait for app to be ready (container can restart while applying migrations)
url="http://127.0.0.1:3001/api/health"
max_attempts=30
for attempt in $(seq 1 "$max_attempts"); do
  if curl -fsS --max-time 3 "$url" >/dev/null; then
    echo "[deploy-dev] Health OK"
    echo "[deploy-dev] OK"
    exit 0
  fi
  echo "[deploy-dev] Waiting for health... ($attempt/$max_attempts)"
  sleep 2
done

echo "[deploy-dev] ERROR: health check did not become ready in time" >&2
exit 1
