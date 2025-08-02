# Stage 1: Base image with Node.js 22 LTS
FROM node:22-slim AS base
WORKDIR /app
RUN npm install -g pnpm

# Stage 2: Install all dependencies for the build
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application WITH build args
FROM deps AS builder
COPY . .

# Accept build-time arguments
ARG VITE_APP_DOMAIN
ARG VITE_API_DOMAIN  
ARG VITE_SUPERTOKENS_DOMAIN
ARG VITE_APP_ENV

# Set as environment variables for the build
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN
ENV VITE_SUPERTOKENS_DOMAIN=$VITE_SUPERTOKENS_DOMAIN
ENV VITE_APP_ENV=$VITE_APP_ENV

# Build both client and server
RUN pnpm run build

# Stage 4: Production image
FROM base AS production
ENV NODE_ENV=production

# Copy package files and install ONLY production dependencies
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy the compiled server and client code
COPY --from=builder /app/dist ./dist

# Expose the port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server/server.js"]
