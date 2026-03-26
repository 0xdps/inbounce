# Inbounce

A form backend as a service — collect structured form submissions via a single HTTP endpoint, no backend code required.

Define a schema, get an API key, start receiving submissions in minutes. Works with plain HTML forms, `fetch`, or `curl`.

---

## How it works

1. **Create an app** in the dashboard → receive an `api_key`
2. **Define a schema** — fields, types, required/unique constraints
3. **Submit data** — `POST /s/<api_key>` from any client

```
POST https://<your-domain>/s/<api_key>
Content-Type: application/json

{ "name": "Alice", "email": "alice@example.com" }
```

The `api_key` is a **public** form identifier, not a secret. Submissions are rate-limited to 30 req/min per IP per app.

---

## Plain HTML form (no JavaScript)

```html
<form action="https://<your-domain>/s/<api_key>" method="POST">
  <input type="text"  name="name"  required />
  <input type="email" name="email" required />
  <!-- honeypot — leave empty, bots fill it, we discard silently -->
  <input type="text" name="_hp" style="display:none" tabindex="-1" />
  <button type="submit">Send</button>
</form>
```

---

## Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | Node.js + Fastify             |
| Frontend | React 18 + Vite + Tailwind    |
| Database | SQLite (via sqlite-hub)       |
| Proxy    | Caddy                         |
| Deploy   | Docker + Railway              |

---

## Project layout

```
services/
  backend/      Fastify API (submissions, apps, schema, auth)
  frontend/     React admin dashboard
  landing/      Marketing site
Dockerfile      Multi-stage build (builder → prod)
start.sh        Container entrypoint (Node + Caddy)
railway.json    Railway deploy config
```

---

## Self-hosting on Railway

1. Fork / clone the repo
2. Create a Railway project and link it to the repo
3. Set the required environment variables:

| Variable | Description |
|---|---|
| `ADMIN_KEY` | Password to log in to the admin dashboard |
| `SESSION_SECRET` | Secret used to sign session cookies (min 32 chars) |
| `SQLITE_HUB_URL` | Base URL of your sqlite-hub instance |
| `SQLITE_HUB_DB` | Database name on sqlite-hub |
| `SQLITE_HUB_SERVICE_SECRET` | Service-to-service auth secret for sqlite-hub |

Railway will build the Docker image and expose port `8080` automatically.

---

## Local development

```sh
# Install dependencies
npm --prefix services/backend install
npm --prefix services/frontend install

# Start backend (port 3000)
node --watch services/backend/index.js

# Start frontend dev server (port 5173)
npm --prefix services/frontend run dev
```

Or use Docker Compose:

```sh
docker compose up
```

---

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/s/:api_key` | None | Submit form data |
| `GET` | `/api/apps` | Session | List apps |
| `POST` | `/api/apps` | Session | Create app |
| `GET` | `/api/apps/:id` | Session | Get app + schema |
| `PATCH` | `/api/apps/:id` | Session | Update app |
| `DELETE` | `/api/apps/:id` | Session | Delete app |
| `GET` | `/api/apps/:id/submissions` | Session | List submissions |
| `GET` | `/api/apps/:id/submissions/distribution` | Session | Field value distribution |
| `POST` | `/api/auth/login` | None | Admin login |
| `POST` | `/api/auth/logout` | Session | Logout |
| `GET` | `/health` | None | Health check |
