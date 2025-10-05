# Stage 1: Base image with pnpm
FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable pnpm && corepack install -g pnpm@10.17.1

# Stage 2: Install dependencies (workspace-aware)
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/

# Install all dependencies needed for building
RUN pnpm install --frozen-lockfile \
    --filter @rita-berenice/shared \
    --filter @rita-berenice/client \
    --filter @rita-berenice/server

# Stage 3: Build the application
FROM deps AS builder

# Copy source code for all production packages
COPY packages/shared ./packages/shared
COPY packages/client ./packages/client
COPY packages/server ./packages/server

# Copy build config files
COPY tsconfig.base.json tsconfig.json ./
COPY packages/client/vite.config.ts ./

# CRITICAL: Accept build args in builder stage
ARG VITE_APP_ENV
ARG VITE_API_DOMAIN
ARG VITE_APP_DOMAIN

# Set as ENV for Vite build
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN

# Build shared first (required dependency)
RUN pnpm --filter @rita-berenice/shared build

# Build client and server in parallel (independent, faster)
RUN pnpm --parallel --filter @rita-berenice/client --filter @rita-berenice/server build

# Stage 4: Production image (minimal)
FROM base AS production
ENV NODE_ENV=production

# Declare ARGs again for production stage
ARG VITE_API_DOMAIN
ARG VITE_APP_DOMAIN

# Pass to runtime ENV
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN

# Copy workspace config files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/

# Install ONLY production dependencies
RUN pnpm install --prod --frozen-lockfile \
    --filter @rita-berenice/shared \
    --filter @rita-berenice/client \
    --filter @rita-berenice/server

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server/server.js"]
