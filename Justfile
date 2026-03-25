# Inbounce Development & Production Task Runner

COMPOSE_FILE := "docker-compose.yaml"
CADDY_INTERNAL_PORT := "8080"
PORTLESS_ALIAS := "inbounce"
PORTLESS_PROXY_PORT := "1355"

DEV_CADDY_SERVICE := "caddy"

default:
    @just --list

# Validate local prerequisites
doctor:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v docker >/dev/null 2>&1 || { echo "❌ docker is required"; exit 1; }
    docker info >/dev/null 2>&1 || { echo "❌ Docker daemon is not running"; exit 1; }
    command -v node >/dev/null 2>&1 || { echo "❌ node is required"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }
    command -v just >/dev/null 2>&1 || { echo "❌ just is required"; exit 1; }
    [ -f .env ] || { echo "❌ .env missing. Run: just env-setup"; exit 1; }
    npx portless --help >/dev/null 2>&1 || { echo "❌ Portless not available via npx"; exit 1; }
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev config >/dev/null
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev config >/dev/null
    fi
    echo "✅ doctor: environment is ready"

# ============================================================================
# DEVELOPMENT RECIPES
# ============================================================================

# Start development environment (Caddy + Backend + Frontend, hot reload)
dev:
    #!/usr/bin/env bash
    set -euo pipefail

    [ -f .env ] || { echo "❌ .env missing. Run: just env-setup"; exit 1; }
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE="docker-compose"
    else
        COMPOSE="docker compose"
    fi

    echo "🚀 Starting Inbounce Development Environment"
    echo ""

    echo "Starting Portless proxy..."
    npx portless proxy start >/dev/null 2>&1 || true

    echo "Starting containers..."
    $COMPOSE -f {{COMPOSE_FILE}} --profile dev up -d --build --force-recreate {{DEV_CADDY_SERVICE}}

    tries=0
    max_tries=90
    PORT=""
    while [ $tries -lt $max_tries ]; do
        PORT=$($COMPOSE -f {{COMPOSE_FILE}} --profile dev port {{DEV_CADDY_SERVICE}} {{CADDY_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}')
        if [ -n "$PORT" ]; then break; fi
        tries=$((tries + 1))
        sleep 1
    done

    if [ -z "$PORT" ]; then
        echo "❌ Could not detect Caddy port. Check container status:"
        $COMPOSE -f {{COMPOSE_FILE}} --profile dev ps
        exit 1
    fi

    echo ""
    echo "✅ Services started!"
    echo "  → http://localhost:$PORT"
    echo ""

    npx portless alias {{PORTLESS_ALIAS}} $PORT >/dev/null 2>&1 || true
    echo "✅ Portless alias ready:"
    echo "  → http://{{PORTLESS_ALIAS}}.localhost:{{PORTLESS_PROXY_PORT}}"
    echo ""

    health_tries=0
    health_max=120
    while [ $health_tries -lt $health_max ]; do
        if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
            echo "✅ Service is healthy"
            break
        fi
        health_tries=$((health_tries + 1))
        sleep 1
    done
    if [ $health_tries -ge $health_max ]; then
        echo "⚠️  Service did not become healthy within timeout"
    fi

    cleanup() {
        $COMPOSE -f {{COMPOSE_FILE}} --profile dev down --remove-orphans >/dev/null 2>&1 || true
        npx portless alias --remove {{PORTLESS_ALIAS}} >/dev/null 2>&1 || true
    }
    trap cleanup EXIT INT TERM

    echo ""
    echo "Streaming logs (backend + frontend). Ctrl+C to stop."
    $COMPOSE -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend

# Start development in background (silent)
dev-bg:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev up --build -d
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev up --build -d
    fi

# Start locally without Docker (requires Node installed)
dev-local:
    npm run dev:local

# Start backend locally
dev-be-local:
    cd services/backend && node index.js

# Start frontend locally
dev-fe-local:
    cd services/frontend && npm run dev

# Seed the database with fake data for testing
seed:
    cd services/backend && node scripts/seed.js

# ============================================================================
# RAILWAY DEPLOY RECIPES
# ============================================================================

# Deploy via railway-deploy declarative tool (requires: pip install -e ../railway-deploy)
deploy-config ENV='production' PROJECT='':
    #!/usr/bin/env bash
    set -euo pipefail
    command -v railway-deploy >/dev/null 2>&1 || python3 -c "import railway_deploy" 2>/dev/null || {
        echo "❌ railway-deploy not installed."
        echo "   Run: pip install -e ../railway-deploy"
        exit 1
    }
    [ -n "{{PROJECT}}" ] || { echo "❌ PROJECT is required: just deploy-config ENV=production PROJECT=<railway-project-id>"; exit 1; }
    [ -f ".env.{{ENV}}" ] || { echo "⚠️  .env.{{ENV}} not found — copy .env.production.example and fill in values"; exit 1; }
    CMD="railway-deploy"
    command -v railway-deploy >/dev/null 2>&1 || CMD="python3 ../railway-deploy/railway.py"
    echo "🚀 Deploying to Railway (env: {{ENV}}, project: {{PROJECT}})..."
    $CMD --project {{PROJECT}} --env {{ENV}} --config inbounce.deploy.yml

# Deploy to Railway (requires: railway CLI authenticated + project linked)
deploy MESSAGE='deploy':
    #!/usr/bin/env bash
    set -euo pipefail
    command -v railway >/dev/null 2>&1 || { echo "❌ railway CLI not installed. Run: npm i -g @railway/cli"; exit 1; }
    railway whoami --json >/dev/null 2>&1 || { echo "❌ Not authenticated. Run: railway login"; exit 1; }
    echo "🚀 Deploying to Railway..."
    railway up --detach -m "{{MESSAGE}}"
    echo "✅ Deploy triggered. Watch logs with: just railway-logs"

# Stream live Railway logs
railway-logs:
    railway logs --lines 200

# Show Railway service status
railway-status:
    railway status --json

# Open Railway dashboard in browser
railway-open:
    railway open

# Stop all dev containers
down:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev down
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev down
    fi
    npx portless alias --remove {{PORTLESS_ALIAS}} >/dev/null 2>&1 || true

# Stream all logs
logs:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend
    fi

# Stream backend logs only
logs-be:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f backend
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f backend
    fi

# Stream frontend logs only
logs-fe:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f frontend
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f frontend
    fi

# Stream Caddy logs only
logs-caddy:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f caddy
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f caddy
    fi

# Tear down and rebuild dev environment from scratch
reset:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev down -v
        docker-compose -f {{COMPOSE_FILE}} --profile dev up --build
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev down -v
        docker compose -f {{COMPOSE_FILE}} --profile dev up --build
    fi

# ============================================================================
# BUILD RECIPES
# ============================================================================

# Build frontend
build-fe:
    cd services/frontend && npm run build

# Syntax-check backend entry
build-be:
    node -c services/backend/index.js

# Build both
build:
    just build-be
    just build-fe

# ============================================================================
# INFRASTRUCTURE
# ============================================================================

# Install npm dependencies for backend and frontend
install:
    npm --prefix services/backend install
    npm --prefix services/frontend install

# Copy .env.example → .env (if .env does not exist)
env-setup:
    #!/usr/bin/env bash
    if [ ! -f .env ]; then
        cp .env.example .env
        echo "📝 Created .env — edit it with your actual values"
    else
        echo "✓ .env already exists"
    fi

# Remove all node_modules
clean:
    #!/usr/bin/env bash
    find services -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
    echo "✓ node_modules cleaned"
