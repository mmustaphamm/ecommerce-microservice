# Multi-stage build. Build context MUST be the repo root (see docker-compose.yml
# "context: ." + "dockerfile: payment-service/Dockerfile"), because this
# service depends on the @ecommerce/shared workspace package alongside it.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY payment-service/package.json payment-service/tsconfig.json ./payment-service/

RUN npm install

COPY shared/src ./shared/src
COPY payment-service/src ./payment-service/src

RUN npm run build --workspace=shared
RUN npm run build --workspace=payment-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/payment-service/dist ./payment-service/dist
COPY --from=builder /app/payment-service/package.json ./payment-service/package.json

EXPOSE 3004
CMD ["node", "payment-service/dist/server.js"]
