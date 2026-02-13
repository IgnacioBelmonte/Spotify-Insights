# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app

# System deps for Prisma/runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* pnpm-workspace.yaml* ./
# Use npm inside the container to avoid pnpm "approve-builds" restrictions affecting Prisma engines
RUN npm i -g npm@10.9.4 \
 && (npm ci --legacy-peer-deps || npm i --legacy-peer-deps)

FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client + build
RUN npx prisma generate \
 && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy runtime files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

# Run migrations on start, then start Next
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && npm run start -- -H 0.0.0.0 -p 3000"]
