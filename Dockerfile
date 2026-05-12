# ── Stage: build-core ────────────────────────────────────────────────────────
# Clones mesahub-core and builds the Go binary from source.
# Override MESAHUB_CORE_VERSION at build time to pin a specific commit/tag:
#   docker build --build-arg MESAHUB_CORE_VERSION=trunk .
FROM golang:1.24-alpine AS build-core
RUN apk add --no-cache gcc musl-dev sqlite-dev git
ARG MESAHUB_CORE_VERSION=trunk
RUN git clone --depth 1 --branch ${MESAHUB_CORE_VERSION} \
    https://github.com/mesahub-db/mesahub-core.git /mesahub-core
WORKDIR /mesahub-core/server
RUN CGO_ENABLED=1 GOOS=linux go build -o /go/bin/mesahub-server ./cmd/server

# ── Stage: mesahub ───────────────────────────────────────────────────────────
# Standalone runnable mesahub-server container for local dev (docker compose).
FROM alpine:3.21 AS mesahub
RUN apk add --no-cache ca-certificates curl sqlite-libs
COPY --from=build-core /go/bin/mesahub-server /usr/local/bin/mesahub-server
VOLUME /data
EXPOSE 3002
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s \
  CMD curl -sf http://localhost:3002/api/health || exit 1
CMD ["mesahub-server"]

# ── Stage: builder ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root tsconfig first (needed by backend/frontend)
COPY tsconfig.json ./

# Install frontend dependencies and build
COPY services/frontend/package*.json ./services/frontend/
RUN cd services/frontend && npm install

COPY services/backend/package*.json ./services/backend/
RUN cd services/backend && npm install

# Copy frontend source and build
COPY services/frontend/src        ./services/frontend/src
COPY services/frontend/public     ./services/frontend/public
COPY services/frontend/index.html ./services/frontend/
COPY services/frontend/vite.config.ts     ./services/frontend/
COPY services/frontend/tsconfig.json ./services/frontend/
COPY services/frontend/postcss.config.js  ./services/frontend/
COPY services/frontend/tailwind.config.js ./services/frontend/
RUN npm --prefix services/frontend run build

# Build backend TypeScript
COPY services/backend/src ./services/backend/src
COPY services/backend/tsconfig.json ./services/backend/
RUN npm --prefix services/backend run build

# Dev stage — backend hot reload via tsx
FROM node:22-alpine AS dev
WORKDIR /app
RUN apk add --no-cache curl

COPY tsconfig.json ./
COPY --from=builder /app/services/backend/node_modules ./services/backend/node_modules
COPY services/backend/src       ./services/backend/src
COPY services/backend/tsconfig.json ./services/backend/
COPY services/backend/package.json  ./services/backend/

EXPOSE 3000
CMD ["npm", "--prefix", "services/backend", "run", "dev"]

# Production stage — Caddy + Node + mesahub-server
FROM caddy:2-alpine AS caddy-bin

FROM node:22-alpine AS prod
COPY --from=caddy-bin /usr/bin/caddy /usr/bin/caddy
RUN apk add --no-cache curl openssl
WORKDIR /app
RUN mkdir -p /usr/share/caddy

# mesahub-server (for embedded mode — skipped if MESAHUB_URL points to external host)
COPY --from=build-core /go/bin/mesahub-server /usr/local/bin/mesahub-server
RUN mkdir -p /data
VOLUME ["/data"]

COPY tsconfig.json ./
COPY --from=builder /app/services/backend/node_modules ./services/backend/node_modules
COPY --from=builder /app/services/backend/dist    ./services/backend/dist
COPY services/backend/package.json  ./services/backend/

COPY --from=builder /app/services/frontend/dist /usr/share/caddy

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80
CMD ["/app/start.sh"]
