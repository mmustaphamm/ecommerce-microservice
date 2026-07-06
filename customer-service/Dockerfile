# Multi-stage build. Build context MUST be the repo root (see docker-compose.yml
# "context: ." + "dockerfile: customer-service/Dockerfile"), because this
# service depends on the @ecommerce/shared workspace package alongside it.

FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first for better layer caching - dependencies only get
# reinstalled when a package.json actually changes, not on every source edit.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY customer-service/package.json customer-service/tsconfig.json ./customer-service/

RUN npm install

COPY shared/src ./shared/src
COPY customer-service/src ./customer-service/src

RUN npm run build --workspace=shared
RUN npm run build --workspace=customer-service

# ---- Runtime stage: only production deps + compiled JS, no TS toolchain ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/dist ./shared/src
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/customer-service/dist ./customer-service/dist
COPY --from=builder /app/customer-service/package.json ./customer-service/package.json

EXPOSE 3001
CMD ["sh", "-c", "node customer-service/dist/scripts/seed.js && node customer-service/dist/server.js"]
