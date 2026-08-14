# Stage 1: Base image with pnpm
FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable pnpm && corepack install -g pnpm@10.18.0

# Stage 2: Install dependencies (workspace-aware)
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/

# Install all dependencies needed for building
RUN pnpm config set node-linker hoisted \
    && pnpm install --frozen-lockfile \
    --filter @rita-berenice/shared \
    --filter @rita-berenice/client \
    --filter @rita-berenice/server

# Stage 3: Build the application
FROM deps AS builder

# Copy static public assets used by the Vite client build.
COPY public ./public

# Copy source code for all production packages
COPY packages/shared/api ./packages/shared/api
COPY packages/shared/config ./packages/shared/config
COPY packages/shared/domain ./packages/shared/domain
COPY packages/shared/util ./packages/shared/util
COPY packages/shared/index.ts packages/shared/tsconfig.json ./packages/shared/

COPY packages/client/hook ./packages/client/hook
COPY packages/client/layout ./packages/client/layout
COPY packages/client/page ./packages/client/page
COPY packages/client/provider ./packages/client/provider
COPY packages/client/style ./packages/client/style
COPY packages/client/util ./packages/client/util
COPY packages/client/App.tsx packages/client/AppProviders.tsx packages/client/entry-client.tsx packages/client/entry-server.tsx packages/client/index.html packages/client/index.ts packages/client/routeConstants.ts packages/client/tsconfig.json packages/client/vite.config.ts ./packages/client/

COPY packages/server/config ./packages/server/config
COPY packages/server/db ./packages/server/db
COPY packages/server/route ./packages/server/route
COPY packages/server/service ./packages/server/service
COPY packages/server/store ./packages/server/store
COPY packages/server/util ./packages/server/util
COPY packages/server/drizzle.config.ts packages/server/index.ts packages/server/root.ts packages/server/server.ts packages/server/tsconfig.json ./packages/server/

# Copy build config files
COPY tsconfig.base.json tsconfig.json ./

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

# Runtime character and user images live in private object storage in production.
# Vite copies public assets into both browser and SSR output, so remove those
# runtime-only directories before copying build artifacts into production.
RUN rm -rf \
    /app/dist/client/assets/character \
    /app/dist/client/assets/user \
    /app/packages/client/dist/ssr/assets/character \
    /app/packages/client/dist/ssr/assets/user

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
RUN pnpm config set node-linker hoisted \
    && pnpm install --prod --frozen-lockfile \
    --filter @rita-berenice/shared \
    --filter @rita-berenice/client \
    --filter @rita-berenice/server

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
# Deploy-time schema migrations need the committed migration files in the runtime image.
COPY packages/server/db/migrations ./packages/server/db/migrations
RUN mkdir -p node_modules/@rita-berenice \
    && ln -s ../../packages/shared node_modules/@rita-berenice/shared

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "packages/server/dist/server.js"]
