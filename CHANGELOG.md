# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-28

### Initial Release

Inbounce v1.0 — Production-ready form backend as a service.

#### Core Features

- **Form Submissions**: Accept structured JSON submissions via HTTP POST
- **Schema Management**: Define custom schemas with field types, constraints, and validation
- **Per-App Data Isolation**: Each app has its own submission and schema tables
- **Admin Dashboard**: React-based dashboard for managing apps and viewing submissions
- **Rate Limiting**: 30 requests/minute per IP per slug (resistant to key rotation)
- **Caching**: In-memory schema and app metadata caches for performance
- **CORS Support**: Configure allowed origins per app

#### Technical Stack

- **Backend**: Node.js 22 + Fastify 5 + TypeScript (strict mode)
- **Frontend**: React 18 + Vite 6 + Tailwind CSS 3
- **Database**: SQLite (via sqlite-hub for shared instances)
- **Validation**: Zod schemas with compile-time and runtime validation
- **Deployment**: Docker + Railway support included
- **Proxy**: Caddy reverse proxy for production

#### API Endpoints

- `POST /api/submit` — Public submission endpoint (API key authentication)
- `GET/POST/PUT/DELETE /api/apps` — App management
- `GET/PUT /api/apps/:slug/schema` — Schema management
- `GET/DELETE /api/apps/:slug/submissions` — Submission management
- `POST /api/auth/login` — Admin authentication

#### Dashboard Features

- App creation with auto-generated slugs
- Schema builder (add, edit, reorder fields)
- Submission viewer with pagination
- Statistics (total, today, week, month)
- Field value distribution
- Geo-IP mapping
- One-click API key rotation
- CORS origin management

#### Performance Optimizations

- In-memory Zod schema compilation (eliminates DB queries)
- App metadata caching (API keys, origins)
- Idempotency key support (prevents duplicates)
- Compound key uniqueness constraints
- Honeypot field for bot detection

#### Security

- Session-based admin authentication (JWT in httpOnly cookies)
- Rate limiting by IP + slug
- CORS validation per app
- Input validation via Zod
- Honeypot protection

#### Deployment

- Multi-stage Docker build (builder → prod)
- Railway.json configuration
- Docker Compose for local development
- Caddy reverse proxy included
- SQLite Hub integration for managed databases

#### Developer Experience

- 100% TypeScript with strict compiler
- Path aliases for cleaner imports
- Hot-reload development (backend via tsx, frontend via Vite)
- Comprehensive type definitions
- Full test coverage ready (TBD)

#### Project Structure

```
services/backend/    - Fastify API server
services/frontend/   - React admin dashboard
services/landing/    - Marketing/landing site
Dockerfile          - Production build
docker-compose.yml  - Local dev environment
```

### Known Limitations

- Multi-instance cache conflicts: Each process has local cache; scaling to multiple instances requires external cache (Redis)
- Single admin user: No multi-user dashboard yet
- No webhooks: Can't notify external systems on new submissions
- No data export: CSV/JSON export not yet implemented

### Future Enhancements

- [ ] Webhooks on submission events
- [ ] CSV/JSON export per app
- [ ] Advanced submission filtering & search
- [ ] Multi-user dashboard with RBAC
- [ ] Comprehensive analytics
- [ ] Custom domains
- [ ] Customizable rate limits
- [ ] Redis cache backend
- [ ] GraphQL API

### Contributors

- Devendra Pratap Singh (@devendrapratapsingh)
