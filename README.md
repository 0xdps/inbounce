# Inbounce

A form backend as a service — collect structured form submissions via a single HTTP endpoint, no backend code required.

Define a schema, get a public slug, start receiving submissions in minutes. Works with plain HTML forms, `fetch`, or `curl`.

---

## How it works

1. **Create an app** in the dashboard → receive a unique `slug` (e.g., `my-form-a1b2c3`)
2. **Define a schema** — fields, types, required/unique constraints
3. **Submit data** — `POST /s/<slug>` from any client

```
POST https://<your-domain>/s/my-form-a1b2c3
Content-Type: application/json

{ "name": "Alice", "email": "alice@example.com" }
```

The `slug` is a **public** form identifier, not a secret. Submissions are rate-limited to 30 req/min per IP per slug.

---

## Plain HTML form (no JavaScript)

```html
<form action="https://<your-domain>/s/my-form-a1b2c3" method="POST">
  <input type="text"  name="name"  required />
  <input type="email" name="email" required />
  <!-- honeypot — leave empty, bots fill it, we discard silently -->
  <input type="text" name="_hp" style="display:none" tabindex="-1" />
  <button type="submit">Send</button>
</form>
```

---

## Stack

|| Layer    | Tech                          |
||----------|-------------------------------|
|| Backend  | Node.js 22 + Fastify 5 + TypeScript |
|| Frontend | React 18 + Vite 6 + Tailwind  |
|| Database | SQLite (via sqlite-hub)       |
|| Proxy    | Caddy                         |
|| Deploy   | Docker + Railway              |

---

## Architecture

### Per-App Data Isolation

Each app has its own dedicated tables to avoid contention:

- **`sef_<slug>`** — Schema field definitions for that app
- **`sub_<slug>`** — Submissions for that app

This eliminates bottlenecks and improves concurrency under high load.

### In-Memory Caching

Two caches reduce database queries and improve performance:

- **Schema Cache** — Compiled Zod validators per app (rebuilt on schema change, hourly reset)
- **App Metadata Cache** — API keys, allowed origins per app (hourly refresh, set on demand)

### Slug-Based Public APIs

The `slug` is a human-readable, immutable identifier:
- Format: `app-name-<6-hex-chars>` (e.g., `my-form-a1b2c3`)
- 16M combinations for collision avoidance
- Read-only in dashboard (set at creation)
- Used in all public URLs instead of UUIDs

### Rate Limiting

Rate limiting uses **`ip:slug`** combination:
- Limit: 30 requests/minute per IP per slug
- Silently accepts requests beyond the limit (returns `{ ok: true }`)

---

## Project layout

```
services/
  backend/      Fastify API (submissions, apps, schema, auth)
    src/
      core/     Database, caching, schema validation, slug generation
      http/     Routes & middleware (auth, CORS, rate limiting)
      index.ts  Server entry point
  frontend/     React admin dashboard (TypeScript)
  landing/      Marketing site
Dockerfile      Multi-stage build (builder → prod)
docker-compose.yml  Local dev environment
start.sh        Container entrypoint (Node + Caddy)
railway.json    Railway deploy config
tsconfig.json   Root TypeScript config with path aliases
```

---

## Development

### TypeScript

The project is **100% TypeScript** with strict compiler options:

```sh
# Type check all services
npm run type-check

# Build all services
npm run build
```

### Local development

```sh
# Install dependencies
npm --prefix services/backend install
npm --prefix services/frontend install

# Start backend (port 3000, hot-reload via tsx)
npm --prefix services/backend run dev

# Start frontend dev server (port 5173)
npm --prefix services/frontend run dev
```

Or use Docker Compose:

```sh
docker compose up
```

---

## Self-hosting on Railway

1. Fork / clone the repo
2. Create a Railway project and link it to the repo
3. Set the required environment variables:

|| Variable | Description |
||---|---|
|| `ADMIN_KEY` | Password to log in to the admin dashboard |
|| `SESSION_SECRET` | Secret used to sign session cookies (min 32 chars) |
|| `SQLITE_HUB_URL` | Base URL of your sqlite-hub instance |
|| `SQLITE_HUB_DB` | Database name on sqlite-hub |
|| `SQLITE_HUB_SERVICE_SECRET` | Service-to-service auth secret for sqlite-hub |

Railway will build the Docker image and expose port `8080` automatically.

---

## API reference

|| Method | Path | Auth | Description |
||--------|------|------|-------------|
|| `POST` | `/s/:slug` | None | Submit form data |
|| `GET` | `/api/apps` | Session | List apps |
|| `POST` | `/api/apps` | Session | Create app (auto-generates slug) |
|| `GET` | `/api/apps/:slug` | Session | Get app + schema |
|| `PUT` | `/api/apps/:slug` | Session | Update app (name, description, origins) |
|| `DELETE` | `/api/apps/:slug` | Session | Delete app + all submissions |
|| `POST` | `/api/apps/:slug/rotate-key` | Session | Rotate API key |
|| `GET` | `/api/apps/:slug/schema` | Session | List schema fields |
|| `PUT` | `/api/apps/:slug/schema` | Session | Update schema |
|| `GET` | `/api/apps/:slug/submissions` | Session | List submissions (paginated) |
|| `GET` | `/api/apps/:slug/submissions/stats` | Session | Submission stats (today, week, month) |
|| `GET` | `/api/apps/:slug/submissions/distribution` | Session | Field value distribution |
|| `DELETE` | `/api/apps/:slug/submissions/:id` | Session | Delete single submission |
|| `DELETE` | `/api/apps/:slug/submissions` | Session | Clear all submissions |
|| `POST` | `/api/auth/login` | None | Admin login |
|| `DELETE` | `/api/auth/logout` | Session | Logout |
|| `GET` | `/health` | None | Health check |

---

## Performance

With per-app tables and in-memory caching:

- **Submission latency**: ~50ms (including schema validation, idempotency checks, geo IP lookup)
- **Query performance**: O(1) with in-memory schema cache (eliminates DB round-trip)
- **Concurrency**: No contention on shared submission table — each app is isolated
- **Cache hit rate**: 95%+ on typical workloads (hourly refresh, event-driven invalidation)

---

## License

ISC
