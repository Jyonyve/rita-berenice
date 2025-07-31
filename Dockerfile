# Stage 1: Base image with Node.js 22 LTS
FROM node:22-slim AS base
WORKDIR /app

# Stage 2: Install all dependencies, including devDependencies for the build
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM deps AS builder
COPY . .
# The build script in your package.json will compile TS to JS
# for both client and server into the 'dist' directory.
RUN pnpm run build

# Stage 4: Production image
FROM base AS production
ENV NODE_ENV=production
# Copy only the production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
# This matches the "start" script in your package.json
CMD ["node", "dist/server/server.js"]
