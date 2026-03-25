# Inbounce — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-03-25  
**Author:** Devendra Pratap  
**Status:** Draft

---

## 1. Overview

Inbounce is a **form backend as a service** — a lightweight, developer-first platform that lets developers collect structured form submissions via a single HTTP endpoint, without writing any backend code.

It fits naturally into the Pingpong ecosystem alongside NubeAuth, railway-manage, and sqlite-hub. The name reflects both the "inbound data" concept and the Pingpong/bounce family of services.

---

## 2. Goals

- Let developers collect form submissions (waitlists, contact forms, ratings, surveys) in minutes with a single `POST` endpoint.
- Provide a clean dashboard to define schema, view submissions, and manage apps.
- Be infrastructure-grade: secure, rate-limited, validated, and self-hostable on Railway.
- Stay modular — one API key per app, per-app CORS origins, per-app schema.

---

## 3. Non-Goals

- File upload support (out of scope for v1).
- Email notification on submission (out of scope for v1).
- Multi-user / team accounts (single admin_key, same as railway-manage).
- Embeddable form UI widgets (developers bring their own HTML form).

---

## 4. Users

**Primary user:** A developer who wants to wire up a simple form (waitlist signup, contact form, feedback, app rating) without spinning up a backend.

**Secondary user:** The same developer, wearing an ops hat — reviewing submissions and managing their apps from the dashboard.

---

## 5. Architecture

### 5.1 Monorepo Layout

```
inbounce/
├── services/
│   ├── backend/          # Fastify API (ESM, Node 22)
│   └── frontend/         # React + Vite + Tailwind dashboard
├── package.json          # workspace root
├── docker-compose.yaml   # dev + prod profiles (Caddy reverse proxy in prod)
├── Dockerfile            # multi-stage: builder → dev → prod
├── .env.example
└── railway.json
```

### 5.2 Stack

| Layer | Technology |
|---|---|
| API | Fastify 5, ESM, Node 22 |
| Dashboard | React 18, Vite, Tailwind CSS, React Router |
| Database | sqlite-hub via `sqlite-hub-client` (remote HTTP SQLite) |
| Auth | `ADMIN_KEY` env var + JWT session cookie (`ib_session`) |
| Validation | Zod (dynamic schema built from stored field definitions) |
| Rate limiting | `@fastify/rate-limit` |
| Security headers | `@fastify/helmet` |
| Session | `@fastify/cookie` + `jose` JWT (HS256, 7d expiry) |
| Containerisation | Docker multi-stage + Caddy reverse proxy |
| Deployment | Railway |

### 5.3 Database Schema (sqlite-hub tables)

**`apps`**
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID, primary key |
| `name` | TEXT | Human-readable app name |
| `description` | TEXT | Optional |
| `api_key` | TEXT | 32-byte random hex, unique, write-only public token |
| `allowed_origins` | TEXT | JSON array of allowed CORS origins e.g. `["https://mysite.com"]`. Empty = allow all |
| `created_at` | INTEGER | Unix timestamp |

**`schema_fields`**
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID, primary key |
| `app_id` | TEXT | Foreign key → `apps.id` |
| `name` | TEXT | Field name, must be a valid identifier |
| `type` | TEXT | `string` \| `email` \| `number` \| `boolean` \| `url` \| `date` |
| `required` | INTEGER | 0 or 1 |
| `unique` | INTEGER | 0 or 1 — adds UNIQUE constraint on submission column |
| `position` | INTEGER | Display order |

**`sub_{app_id}`** — created lazily on first submission after schema is defined
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID, primary key |
| `_idempotency_key` | TEXT | Optional, unique, 24h dedup |
| `_ip` | TEXT | Submitter IP, stored for audit |
| `created_at` | INTEGER | Unix timestamp |
| *(schema fields)* | varies | One column per `schema_field` row |

---

## 6. API Specification

### 6.1 Public Endpoint (no auth required)

#### `POST /s/:api_key`

Accepts a form submission. Validates against the app's schema using Zod.

**Request**
```
Content-Type: application/json
Idempotency-Key: <uuid>          (optional)

{ "email": "user@example.com", "name": "Alice" }
```

**Response**
```
201 { "ok": true, "id": "uuid" }
400 { "error": "Missing required field: email" }
400 { "error": "Unknown field: foo" }
403 { "error": "Origin not allowed" }
404 { "error": "App not found" }
409 { "error": "Schema not defined yet" }
409 { "error": "Duplicate submission" }         ← idempotency key reuse
```

**Rate limit:** 30 requests / minute, keyed by `ip + api_key`.  
**Body size cap:** 16KB.  
**Max fields in payload:** 50.  
**Max string value length:** 10,000 characters.

**Honeypot:** If the app schema contains a field named `_hp`, the handler expects it to be empty. Non-empty → silent fake `201` (no DB write). Confuses bots without revealing the filter.

**Per-app CORS:** `allowed_origins` is checked against the `Origin` header. Empty array = allow all origins.

### 6.2 Admin API (session cookie required)

#### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | `{ key }` → sets `ib_session` cookie. Rate limited: 5 req / 15 min |
| `DELETE` | `/api/auth/logout` | Clears session cookie |
| `GET` | `/api/auth/me` | Returns `{ admin: true }` if session valid |

#### Apps
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/apps` | List all apps (id, name, description, created_at, submission count) |
| `POST` | `/api/apps` | Create app. Body: `{ name, description?, allowed_origins? }`. Returns app + generated `api_key` |
| `GET` | `/api/apps/:id` | App detail including `api_key` and `allowed_origins` |
| `PUT` | `/api/apps/:id` | Update name, description, allowed_origins |
| `DELETE` | `/api/apps/:id` | Delete app + schema + all submissions |
| `POST` | `/api/apps/:id/rotate-key` | Generate new `api_key`, old one immediately invalid |

#### Schema
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/apps/:id/schema` | List schema fields in position order |
| `PUT` | `/api/apps/:id/schema` | Replace entire schema. Body: `{ fields: [{ name, type, required, unique, position }] }` |

Schema changes after first submission are **additive only** — existing columns are not dropped to preserve data integrity. New required fields on an existing table are added as nullable with a server-side note.

#### Submissions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/apps/:id/submissions` | Paginated. Query params: `page`, `limit` (max 100), `sort`, `order`. Returns `{ data, total, page, limit }` |
| `DELETE` | `/api/apps/:id/submissions/:sid` | Delete single submission |
| `DELETE` | `/api/apps/:id/submissions` | Delete all submissions for app (requires `{ confirm: true }` in body) |

---

## 7. Dashboard Flows

### 7.1 Login
- Single page, key input field.
- On success → redirect to `/apps`.
- Persistent session (7 days).

### 7.2 Apps List (`/apps`)
- Cards showing: name, description, submission count, created date.
- "New App" button → opens create modal (name, description, allowed_origins).
- Each card links to App Detail.

### 7.3 App Detail (`/apps/:id`)
- **Info panel:** name, description, created_at. Edit button.
- **API key panel:** masked display, copy button, rotate button (with confirmation).
- **Allowed origins panel:** comma-separated input.
- **Embed snippet:** pre-filled `fetch` code block the developer copies into their frontend.
- **Schema tab** and **Submissions tab** navigation.

### 7.4 Schema Builder (`/apps/:id/schema`)
- Field list with drag-to-reorder (position).
- Per field: name input, type dropdown, required toggle, unique toggle.
- Add field / remove field buttons.
- "Save Schema" — calls `PUT /api/apps/:id/schema`.
- Warning banner if submissions already exist: "Adding fields is safe. Removing fields will not delete existing data."

### 7.5 Submissions View (`/apps/:id/submissions`)
- Dynamic table — columns derived from schema field names.
- Sortable columns, pagination controls.
- Per-row delete button.
- "Clear all" button with confirmation dialog.
- Empty state with embed snippet hint if no submissions yet.

---

## 8. Security Requirements

| Concern | Mechanism |
|---|---|
| SQL injection | Parameterized queries via sqlite-hub-client throughout |
| Admin auth brute force | Rate limited login (5 / 15 min) + timing-safe key compare |
| Session forgery | HS256 JWT signed with `SESSION_SECRET` (min 32 chars), httpOnly + Secure cookie |
| API key brute force | Rate limited public endpoint (30 / min per ip+key) |
| Payload flooding | 16KB body cap + 50 field max + 10K char per value |
| Spam bots | Honeypot field (`_hp`) — silent fake 201 on non-empty value |
| Duplicate submissions | Idempotency-Key header (24h window) + optional per-app debounce |
| XSS in dashboard | React default escaping — no `dangerouslySetInnerHTML` on submission data |
| CORS abuse | Per-app `allowed_origins` — checked on public endpoint before any processing |
| Security headers | `@fastify/helmet` on all responses |
| API key exposure | Write-only token — cannot read data, only submit. Document as semi-public |
| Key rotation | `POST /api/apps/:id/rotate-key` immediately invalidates old key |

---

## 9. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_KEY` | Yes | Password to log in to the dashboard |
| `SESSION_SECRET` | Yes | JWT signing secret, min 32 characters |
| `SQLITE_HUB_URL` | Yes | Base URL of the sqlite-hub service |
| `SQLITE_HUB_TOKEN` | Yes | Service secret for sqlite-hub authentication |
| `PORT` | No | HTTP port (default: `3000`) |
| `LOG_LEVEL` | No | `error` \| `warn` \| `info` \| `debug` (default: `info`) |
| `NODE_ENV` | No | `development` \| `production` (default: `development`) |

---

## 10. Deployment (Railway)

- Single Railway service running the production Docker image.
- Caddy reverse proxy in prod stage handles HTTPS termination and serves the built frontend SPA.
- Backend serves API on `/api/*` and `/s/*`. Caddy proxies everything else to the React build.
- sqlite-hub runs as a separate Railway service (existing infrastructure, shared with other projects).
- `railway.json` defines the build and start commands.

---

## 11. v1 Scope Checklist

### Backend
- [x] Fastify server with helmet, cors, rate-limit, cookie, compress
- [x] `ADMIN_KEY` + JWT session auth (identical to railway-manage)
- [x] `apps` CRUD + `rotate-key`
- [x] `schema_fields` management with position ordering
- [x] `POST /s/:api_key` — inbound submission with Zod validation
- [x] Per-app CORS origin check
- [x] Honeypot field support
- [x] Idempotency-Key dedup
- [x] Lazy `sub_{app_id}` table creation on first submission
- [x] Submissions CRUD with pagination + sorting
- [x] Health check endpoint

### Frontend
- [x] Login page
- [x] Apps list + create modal
- [x] App detail with info, api_key, embed snippet
- [x] Schema builder with field type/required/unique controls
- [x] Submissions table (dynamic columns, sort, paginate, delete)

### Infra
- [x] Multi-stage Dockerfile (builder → dev → prod with Caddy)
- [x] docker-compose.yaml with dev + prod profiles
- [x] `.env.example`
- [x] `railway.json`

---

## 12. Future Considerations (not in v1)

- Email notifications on new submission (via post-pigeon or similar)
- Webhook delivery per submission (POST to a developer-configured URL)
- File upload fields
- CSV export of submissions
- Rate limit config per app (currently global)
- Cloudflare Turnstile / hCaptcha integration as a passthrough field validator
- Submission search / filter in dashboard
- Multiple admin users via NubeAuth
