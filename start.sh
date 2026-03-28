#!/bin/sh
set -e

export BACKEND_PORT=${BACKEND_PORT:-3000}
export PORT=${PORT:-80}

echo "=========================================="
echo "  Inbounce — Starting Services"
echo "=========================================="

echo "[1/3] Starting backend on port $BACKEND_PORT..."
PORT=$BACKEND_PORT node /app/services/backend/dist/index.js &
BACKEND_PID=$!

echo "[2/3] Waiting for backend..."
max_attempts=30
attempt=0
until curl -sf http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "✗ Backend failed to start after ${max_attempts}s"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "✓ Backend ready"

echo "[3/3] Starting Caddy on port $PORT..."

cat > /tmp/Caddyfile <<EOF
{
  auto_https off
  admin off
}

:$PORT {

  # ── inbounce.app apex — redirect to admin (DNS misconfiguration safety net) ─
  @apex_host host inbounce.app
  handle @apex_host {
    redir https://manage.inbounce.app{uri} 301
  }

  # ── manage.inbounce.app + www.inbounce.app — Admin dashboard ─────────────
  @manage_host host manage.inbounce.app www.inbounce.app
  handle @manage_host {
    root * /usr/share/caddy

    handle /api/* {
      reverse_proxy localhost:${BACKEND_PORT}
    }

    handle /health {
      reverse_proxy localhost:${BACKEND_PORT}
    }

    handle /assets/* {
      header Cache-Control "public, max-age=31536000"
      file_server
    }

    handle {
      try_files {path} /index.html
      file_server
    }
  }

  # ── api.inbounce.app — All requests go straight to backend ───────────────
  @api_host host api.inbounce.app
  handle @api_host {
    reverse_proxy localhost:${BACKEND_PORT}
  }

  # ── Fallback — Railway URL / direct IP / healthcheck hits ───────────────
  handle {
    root * /usr/share/caddy

    handle /api/* {
      reverse_proxy localhost:${BACKEND_PORT}
    }

    handle /health {
      reverse_proxy localhost:${BACKEND_PORT}
    }

    handle /assets/* {
      header Cache-Control "public, max-age=31536000"
      file_server
    }

    handle {
      try_files {path} /index.html
      file_server
    }
  }

}
EOF

caddy fmt --overwrite /tmp/Caddyfile
echo "✓ Caddyfile ready"
exec caddy run --config /tmp/Caddyfile
