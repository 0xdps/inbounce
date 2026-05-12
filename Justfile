# Inbounce — development & production task runner
# Run `just` to list available recipes.

COMPOSE_FILE := "docker-compose.yaml"
DEV_PORT     := "8080"

default:
    @just --list

# ============================================================================
# DEVELOPMENT
# ============================================================================

# Start development environment (Caddy + Backend + Frontend, hot reload)
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    [ -f .env.local ] || { echo "❌ .env.local missing — copy .env.example and fill in values"; exit 1; }
    echo "🚀 Starting Inbounce dev environment..."
    docker compose -f {{COMPOSE_FILE}} --profile dev up -d --build --force-recreate caddy
    echo ""
    echo "✅ Dev environment started → http://localhost:{{DEV_PORT}}"
    echo ""
    echo "Streaming logs (Ctrl+C to stop)..."
    docker compose -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend

# Stop all dev containers
down:
    docker compose -f {{COMPOSE_FILE}} --profile dev down --remove-orphans

# Tear down and rebuild dev environment from scratch
reset:
    docker compose -f {{COMPOSE_FILE}} --profile dev down -v
    docker compose -f {{COMPOSE_FILE}} --profile dev up --build

# Stream all logs
logs:
    docker compose -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend

# Stream backend logs
logs-be:
    docker compose -f {{COMPOSE_FILE}} --profile dev logs -f backend

# Stream frontend logs
logs-fe:
    docker compose -f {{COMPOSE_FILE}} --profile dev logs -f frontend

# Stream Caddy logs
logs-caddy:
    docker compose -f {{COMPOSE_FILE}} --profile dev logs -f caddy

# Start locally without Docker (requires Node installed)
dev-local:
    npm run dev:local

# Start backend locally (TypeScript hot reload with tsx)
dev-be-local:
    npm --prefix services/backend run dev

# Start frontend locally
dev-fe-local:
    npm --prefix services/frontend run dev

# Seed the database with fake data for testing
seed:
    cd services/backend && node scripts/seed.js

# Generate fake submissions using API key
# Usage: just generate-submissions <api_key> [count]
# Example: just generate-submissions abc123def456 50
generate-submissions api_key count='20' endpoint='http://localhost:{{DEV_PORT}}/api/submit':
    node scripts/generate-submissions.mjs {{api_key}} {{count}} {{endpoint}}

# ============================================================================
# RAILWAY DEPLOY
# ============================================================================

# Deploy via railway-deploy declarative tool
# Usage: just deploy-config <env> <project-id>
# Example: just deploy-config production 90ee1aad-e902-49e1-8956-5d53d902cf54
deploy-config deploy_env project_id:
    #!/usr/bin/env bash
    set -euo pipefail
    [ -f ".env.{{deploy_env}}" ] || { echo "⚠️  .env.{{deploy_env}} not found — copy .env.production.example and fill in values"; exit 1; }
    echo "🚀 Deploying to Railway (env: {{deploy_env}}, project: {{project_id}})..."
    PYENV_VERSION=railway-deploy-3.13 railway-deploy \
        --project {{project_id}} \
        --env {{deploy_env}} \
        --config inbounce.deploy.yml

# Deploy to Railway (requires: railway CLI authenticated + project linked)
deploy MESSAGE='deploy':
    railway up --detach -m "{{MESSAGE}}"

# Stream live Railway logs
railway-logs:
    railway logs --lines 200

# Show Railway service status
railway-status:
    railway status --json

# Open Railway dashboard in browser
railway-open:
    railway open

# ============================================================================
# BUILD
# ============================================================================

# Build backend (TypeScript compilation)
build-be:
    npm --prefix services/backend run build

# Build frontend
build-fe:
    npm --prefix services/frontend run build

# Build both
build:
    just build-be
    just build-fe

# Type-check backend
type-check-be:
    npm --prefix services/backend run type-check

# Type-check frontend
type-check-fe:
    npm --prefix services/frontend run type-check

# Type-check both
type-check:
    just type-check-be

# ============================================================================
# INFRASTRUCTURE
# ============================================================================

# Start landing page dev server (Astro, port 4321)
dev-landing:
    npm --prefix services/landing run dev

# Build landing page for production
build-landing:
    npm --prefix services/landing run build

# Install npm dependencies for all services
install:
    npm --prefix services/backend install
    npm --prefix services/frontend install
    npm --prefix services/landing install

# Remove all node_modules
clean:
    #!/usr/bin/env bash
    find services -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
    echo "✓ node_modules cleaned"
