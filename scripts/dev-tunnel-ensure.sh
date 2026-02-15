#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/nacho/.openclaw/workspace/Spotify-Insights"
BOARD="/home/nacho/.openclaw/state/projects/spotify-insights.json"

# Ensure dev app responds locally
if ! curl -fsS "http://127.0.0.1:3001/api/health" >/dev/null; then
  echo "DEV app not healthy on localhost:3001" >&2
  exit 1
fi

# Start/ensure a quick tunnel process exists
if ! pgrep -f "cloudflared tunnel --url http://127.0.0.1:3001" >/dev/null 2>&1; then
  nohup cloudflared tunnel --url http://127.0.0.1:3001 --no-autoupdate --loglevel info > /tmp/cloudflared-dev.log 2>&1 &
  sleep 4
fi

# Best-effort extract latest URL from log
url=$( (grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-dev.log 2>/dev/null || true) | tail -n1 )

if [[ -z "${url}" ]]; then
  echo "No tunnel URL found yet" >&2
  exit 1
fi

# Update .env.dev
sed -i "s|^APP_URL=.*$|APP_URL=${url}|" "${REPO_DIR}/.env.dev" || true
sed -i "s|^SPOTIFY_REDIRECT_URI=.*$|SPOTIFY_REDIRECT_URI=${url}/api/auth/callback|" "${REPO_DIR}/.env.dev" || true

# Recreate app so env is applied
cd "${REPO_DIR}"
sudo docker compose -p spotifydev -f docker-compose.dev.yml up -d --force-recreate app >/dev/null

# Update board runtime.dev tunnelUrl + redirect
python3 - <<PY
import json, datetime
path='${BOARD}'
with open(path,'r') as f:
    data=json.load(f)
rt=data.setdefault('runtime',{}).setdefault('dev',{})
rt['tunnelUrl']='${url}'
rt['spotifyRedirectUri']='${url}/api/auth/callback'
meta=data.setdefault('meta',{})
meta['updatedAt']=datetime.datetime.utcnow().replace(microsecond=0).isoformat()+'Z'
with open(path,'w') as f:
    json.dump(data,f,indent=2)
    f.write('\n')
PY

echo "OK ${url}"
