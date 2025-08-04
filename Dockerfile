# Stage 1: Base image
FROM node:22-slim AS base
WORKDIR /app
RUN npm install -g pnpm

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
# It will automatically receive build-time secrets set with --stage build
FROM deps AS builder
COPY . .

# Use ARG to receive build-time variables from fly.toml
ARG VITE_API_DOMAIN
ARG VITE_APP_DOMAIN
ARG VITE_SUPERTOKENS_DOMAIN
ARG VITE_APP_ENV

# Set them as ENV for the 'pnpm run build' command
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN
ENV VITE_SUPERTOKENS_DOMAIN=$VITE_SUPERTOKENS_DOMAIN
ENV VITE_APP_ENV=$VITE_APP_ENV

RUN pnpm run build

# Stage 4: Production image
# This stage ONLY contains what's needed to RUN the app.
FROM base AS production
ENV NODE_ENV=production

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
