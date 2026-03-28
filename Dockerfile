# Builder stage
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

# Production stage — Caddy + Node
FROM caddy:2-alpine AS caddy-bin

FROM node:22-alpine AS prod
COPY --from=caddy-bin /usr/bin/caddy /usr/bin/caddy
RUN apk add --no-cache curl
WORKDIR /app
RUN mkdir -p /usr/share/caddy

COPY tsconfig.json ./
COPY --from=builder /app/services/backend/node_modules ./services/backend/node_modules
COPY --from=builder /app/services/backend/dist    ./services/backend/dist
COPY services/backend/package.json  ./services/backend/

COPY --from=builder /app/services/frontend/dist /usr/share/caddy

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80
CMD ["/app/start.sh"]
