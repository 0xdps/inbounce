# Development Guide

This guide covers local development, testing, and debugging for Inbounce.

## Prerequisites

- **Node.js**: v22+ (https://nodejs.org)
- **npm**: v10+
- **Docker** (optional, for containerized development)

## Quick Start

### 1. Install Dependencies

```bash
npm --prefix services/backend install
npm --prefix services/frontend install
```

### 2. Set Up Environment

Create `.env.local` in the project root:

```bash
# Backend
ADMIN_KEY=dev-key-change-in-production
SESSION_SECRET=$(openssl rand -base64 32)
DEBUG_INBOUND=true

# SQLite Hub (use local instance or mock for development)
SQLITE_HUB_URL=http://localhost:4000
SQLITE_HUB_DB=inbounce_dev
SQLITE_HUB_SERVICE_SECRET=dev-secret
```

### 3. Start Services

**Terminal 1 — Backend (port 3000)**
```bash
npm --prefix services/backend run dev
```

**Terminal 2 — Frontend (port 5173)**
```bash
npm --prefix services/frontend run dev
```

The frontend will open at `http://localhost:5173`.

### Using Docker Compose

```bash
docker compose up
```

This starts both services and a SQLite Hub instance. Open http://localhost:3000.

## Project Structure

```
services/backend/src/
├── core/
│   ├── db.ts              SQLite connection & schema init
│   ├── config.ts          Environment configuration
│   ├── logger.ts          Logging utility
│   ├── slug.ts            Slug generation, validation, uniqueness
│   ├── tables.ts          Per-app table creation/dropping
│   ├── schema-builder.ts  Zod schema compilation
│   ├── caches.ts          In-memory schema & app metadata caches
│   └── cache.ts           (Legacy, can be removed)
├── http/
│   ├── routes/
│   │   ├── apps.ts        App CRUD endpoints
│   │   ├── schema.ts      Schema field management
│   │   ├── submissions.ts Submission listing, stats, distribution
│   │   ├── inbound.ts     Public submission endpoint (/s/:slug)
│   │   └── auth.ts        Admin login/logout
│   ├── middleware/
│   │   └── auth.ts        Session verification, JWT signing
│   └── server.ts          Fastify instance setup, plugin registration
└── index.ts               Entry point, server startup

services/frontend/src/
├── App.tsx                Main router, auth context
├── main.tsx               React DOM entry point
├── lib/
│   └── api.ts             HTTP client for backend API
├── pages/
│   ├── Login.tsx          Admin login page
│   ├── Apps.tsx           App list page
│   ├── AppDetail.tsx      App detail page (tabs: submissions, schema, setup)
│   ├── SchemaBuilder.tsx  Schema field editor
│   └── Submissions.tsx    Submission viewer, stats, distribution
└── components/
    ├── Layout.tsx         Header, sidebar, navigation
    ├── Logo.tsx           Brand logo
    └── Select.tsx         Dropdown select component
```

## TypeScript Development

### Type Checking

```bash
# Check backend types (strict)
npm run type-check

# Build backend TypeScript → JavaScript
npm --prefix services/backend run build

# Frontend uses Vite's transpilation (no separate type-check)
```

### Adding Types

**Backend**: Add types to function signatures, imports, and interface definitions.

```typescript
// Good
export async function getApp(slug: string): Promise<App | null> {
  return await db.findOne('apps', { slug });
}

// Bad (implicit any)
export async function getApp(slug) {
  return await db.findOne('apps', { slug });
}
```

**Frontend**: Components are loosely typed (use `any` as needed for now).

```typescript
function Component({ prop }: { prop: any }) {
  return <div>{prop}</div>;
}
```

## Testing

### Manual Testing

1. **Create an app**:
   - Go to http://localhost:5173/apps
   - Login with `ADMIN_KEY`
   - Click "New app"
   - Copy the slug (e.g., `my-form-a1b2c3`)

2. **Define schema**:
   - Click on the app
   - Go to "Schema" tab
   - Add fields (name, email, message)
   - Save

3. **Submit data**:
   ```bash
   curl -X POST http://localhost:3000/s/my-form-a1b2c3 \
     -H "Content-Type: application/json" \
     -d '{"name":"Alice","email":"alice@example.com","message":"Hello"}'
   ```

4. **View submissions**:
   - Go back to "Submissions" tab
   - See the submission listed

### Testing Caching

Set `DEBUG=inbounce:*` to see cache hits/misses:

```bash
DEBUG=inbounce:* npm --prefix services/backend run dev
```

### Testing Rate Limiting

```bash
# First 30 requests succeed
for i in {1..30}; do
  curl -X POST http://localhost:3000/s/my-form-a1b2c3 \
    -H "Content-Type: application/json" \
    -d '{"name":"Test '$i'"}'
done

# 31st request silently accepted but not stored
curl -X POST http://localhost:3000/s/my-form-a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{"name":"Test 31"}'
# Returns { ok: true } but submission discarded
```

## Debugging

### Backend

Use `DEBUG=*` to see all logs:

```bash
DEBUG=* npm --prefix services/backend run dev
```

Or enable specific modules:

```bash
DEBUG=inbounce:* npm --prefix services/backend run dev
DEBUG=inbounce:db,inbounce:cache npm --prefix services/backend run dev
```

### Frontend

Open DevTools (F12) in browser:

- **Console**: Log statements, errors
- **Network**: API requests/responses
- **Application → Cookies**: Check `ib_session` cookie

### Database

Query the database directly:

```bash
# Using sqlite-hub CLI (if available)
sqlite-hub query "SELECT * FROM apps"

# Or via curl to the API
curl -H "Authorization: Bearer $SERVICE_SECRET" \
  http://localhost:4000/query -d 'SELECT * FROM apps'
```

## Common Issues

### Backend won't start: `Cannot find module '@backend/*'`

The path aliases require TypeScript compilation. Make sure you ran:

```bash
npm --prefix services/backend install
npm --prefix services/backend run build
```

### Frontend shows `api.js not found`

Frontend imports reference `.js` files (compiled output). Make sure:

```bash
npm --prefix services/backend run build
```

### SQLite Hub connection error

Check that `SQLITE_HUB_URL` is reachable:

```bash
curl http://localhost:4000/health
```

If using Docker Compose, ensure both services are running:

```bash
docker compose ps
```

## Performance Profiling

### Measure submission latency

Add timing logs to `services/backend/src/http/routes/inbound.ts`:

```typescript
const start = Date.now();
// ... submission handling ...
const elapsed = Date.now() - start;
logger.info({ slug, elapsed }, 'Submission processed');
```

### Check cache hit rate

Look at logs for cache invalidation events:

```bash
DEBUG=inbounce:cache npm --prefix services/backend run dev
```

## Database Schema

### Core Tables

```sql
-- Global apps table
CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  api_key TEXT NOT NULL UNIQUE,
  allowed_origins TEXT NOT NULL,  -- JSON array
  created_at INTEGER NOT NULL
);

-- Per-app schema fields (created on-demand)
CREATE TABLE sef_<slug> (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'string', 'email', 'number', 'boolean', 'url', 'date'
  required BOOLEAN NOT NULL,
  unique BOOLEAN NOT NULL,
  compound_key TEXT,
  position INTEGER NOT NULL
);

-- Per-app submissions (created on-demand)
CREATE TABLE sub_<slug> (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,  -- JSON
  ip TEXT,
  geo TEXT,  -- JSON
  dup_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER,
  idempotency_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
```

## Deployment

### Local Docker Build

```bash
docker build -t inbounce:latest .
docker run -p 8080:80 inbounce:latest
```

### Railway Deployment

See `railway.json` and README.md for Railway deployment instructions.

## Contributing

1. Create a feature branch: `git checkout -b feature/xyz`
2. Make changes and run tests
3. Type-check: `npm run type-check`
4. Build: `npm run build`
5. Commit with descriptive message
6. Push and open PR

## Resources

- **Fastify**: https://www.fastify.io/docs/latest/
- **React**: https://react.dev
- **Zod**: https://zod.dev
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs
