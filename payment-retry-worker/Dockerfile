# Multi-stage build. Build context MUST be the repo root (see docker-compose.yml
# "context: ." + "dockerfile: payment-retry-worker/Dockerfile"), because this
# service depends on the @ecommerce/shared workspace package alongside it.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY payment-retry-worker/package.json payment-retry-worker/tsconfig.json ./payment-retry-worker/

RUN npm install

COPY shared/src ./shared/src
COPY payment-retry-worker/src ./payment-retry-worker/src

RUN npm run build --workspace=shared
RUN npm run build --workspace=payment-retry-worker

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/dist ./shared/src
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/payment-retry-worker/dist ./payment-retry-worker/dist
COPY --from=builder /app/payment-retry-worker/package.json ./payment-retry-worker/package.json

# No EXPOSE - this is not an HTTP service, just a queue consumer process.
CMD ["node", "payment-retry-worker/dist/worker.js"]
