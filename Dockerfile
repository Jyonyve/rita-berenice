# Stage 1: Base image with Node.js 22 LTS
FROM node:22-slim AS base
WORKDIR /app
RUN npm install -g pnpm

# Stage 2: Install all dependencies for the build
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM deps AS builder
COPY . .
# Build both client and server
RUN pnpm run build

# Stage 4: Production image (CORRECTED)
FROM base AS production
ENV NODE_ENV=production

# Copy package files and install ONLY production dependencies
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy the compiled server code
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/server/server.js"]
