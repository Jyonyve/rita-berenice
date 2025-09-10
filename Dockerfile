# Stage 1: Base image
FROM node:22-slim AS base
WORKDIR /app
RUN npm install -g pnpm

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM deps AS builder
COPY . .

# CRITICAL FIX: Accept build args in the builder stage
ARG VITE_APP_ENV
ARG VITE_API_DOMAIN
ARG VITE_APP_DOMAIN

# Set them as ENV for the build command (Vite needs these at build time)
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN

RUN pnpm run build

# Stage 4: Production image
FROM base AS production
ENV NODE_ENV=production

# CRITICAL FIX: Declare ARGs again in the production stage
# Docker build args don't carry over between stages automatically
ARG VITE_API_DOMAIN
ARG VITE_APP_DOMAIN

# Pass build args to runtime environment variables
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN

# Copy production dependencies manifest
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
# Install ONLY production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy the compiled server and client code
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# The runtime secrets (CHROMA_*) are automatically injected by Fly.io here
# when the container starts.
CMD ["node", "dist/server/server.js"]
