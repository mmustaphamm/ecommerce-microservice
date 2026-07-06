# Multi-stage build. Build context MUST be the repo root (see docker-compose.yml
# "context: ." + "dockerfile: transaction-worker/Dockerfile"), because this
# service depends on the @ecommerce/shared workspace package alongside it.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY transaction-worker/package.json transaction-worker/tsconfig.json ./transaction-worker/

RUN npm install

COPY shared/src ./shared/src
COPY transaction-worker/src ./transaction-worker/src

RUN npm run build --workspace=shared
RUN npm run build --workspace=transaction-worker

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/dist ./shared/src
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/transaction-worker/dist ./transaction-worker/dist
COPY --from=builder /app/transaction-worker/package.json ./transaction-worker/package.json

# No EXPOSE - this is not an HTTP service, just a queue consumer process.
CMD ["node", "transaction-worker/dist/worker.js"]
