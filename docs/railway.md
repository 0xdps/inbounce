# Railway Deployment

Inbounce deploys as a **single Railway service** — one container runs Caddy (reverse proxy + static files) and the Node.js backend together. No separate frontend service is needed.

## Architecture on Railway

```
Railway Service: inbounce
  └── prod Docker image
        ├── Caddy  → listens on $PORT (injected by Railway)
        │     ├── /api/*     → proxy → localhost:$BACKEND_PORT
        │     ├── /s/*       → proxy → localhost:$BACKEND_PORT
        │     ├── /health    → proxy → localhost:$BACKEND_PORT
        │     └── /*         → static files (React SPA)
        └── Node  → listens on $BACKEND_PORT (default: 3000)
```

## Prerequisites

```bash
npm i -g @railway/cli   # install CLI
railway login           # authenticate
railway link            # link this directory to your Railway project
```

## Required environment variables

Set these in the Railway dashboard (Project → Service → Variables) or via the CLI:

```bash
railway variable set ADMIN_KEY=<strong-random-key>
railway variable set SESSION_SECRET=<at-least-32-random-chars>
railway variable set SQLITE_HUB_URL=https://your-sqlite-hub.up.railway.app
railway variable set SQLITE_HUB_DB=inbounce
railway variable set SQLITE_HUB_SERVICE_SECRET=<your-sqlite-hub-service-secret>
railway variable set NODE_ENV=production
railway variable set LOG_LEVEL=info
```

`PORT` and `BACKEND_PORT` are **not** required — Railway injects `PORT` automatically and `BACKEND_PORT` defaults to `3000` in `start.sh`.

## Deploying

```bash
# Via just (recommended)
just deploy "your release message"

# Directly via CLI
railway up --detach -m "your release message"
```

The build uses the `prod` Docker target (defined in `railway.json`). First deploy takes ~2–3 minutes due to multi-stage Docker build.

## Health check

Railway polls `GET /health` every 10 seconds after deploy with a 120-second timeout. The endpoint is served by the Node backend and returns `{ ok: true }`.

## Custom domain

```bash
railway domain add your-domain.com
```

Then add a `CNAME` record in your DNS pointing to the Railway-provided hostname. Caddy handles TLS termination automatically via Railway's proxy layer (`auto_https off` is set since Railway terminates TLS upstream).

## Useful commands

```bash
just deploy "message"     # trigger deploy
just railway-logs         # stream runtime logs
just railway-status       # show linked project/service/environment
just railway-open         # open dashboard in browser

# Direct CLI equivalents
railway logs --lines 200              # recent logs
railway redeploy --yes                # redeploy without code change
railway restart --yes                 # restart container only (no rebuild)
railway deployment list --limit 10    # deployment history
```

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_KEY` | ✅ | — | Password for the admin dashboard (`/`) |
| `SESSION_SECRET` | ✅ | — | Secret for signed session cookies (≥32 chars) |
| `SQLITE_HUB_URL` | ✅ | — | Base URL of your sqlite-hub instance |
| `SQLITE_HUB_DB` | ✅ | — | Database name on sqlite-hub |
| `SQLITE_HUB_SERVICE_SECRET` | ✅ | — | Service secret for sqlite-hub auth |
| `NODE_ENV` | — | `development` | Set to `production` in prod |
| `LOG_LEVEL` | — | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |
| `PORT` | — | injected by Railway | Port Caddy listens on |
| `BACKEND_PORT` | — | `3000` | Internal port for the Node backend |
