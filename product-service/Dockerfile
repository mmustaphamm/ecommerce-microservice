# Multi-stage build. Build context MUST be the repo root (see docker-compose.yml
# "context: ." + "dockerfile: product-service/Dockerfile"), because this
# service depends on the @ecommerce/shared workspace package alongside it.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY product-service/package.json product-service/tsconfig.json ./product-service/

RUN npm install

COPY shared/src ./shared/src
COPY product-service/src ./product-service/src

RUN npm run build --workspace=shared
RUN npm run build --workspace=product-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/dist ./shared/src
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/product-service/dist ./product-service/dist
COPY --from=builder /app/product-service/package.json ./product-service/package.json

EXPOSE 3002
CMD ["sh", "-c", "node product-service/dist/scripts/seed.js && node product-service/dist/server.js"]
