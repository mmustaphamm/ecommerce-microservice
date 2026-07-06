FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY order-service/package.json order-service/tsconfig.json ./order-service/

RUN npm install

COPY shared/src ./shared/src
COPY order-service/src ./order-service/src

RUN npm run build --workspace=shared
RUN npm run build --workspace=order-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/dist ./shared/src
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/order-service/dist ./order-service/dist
COPY --from=builder /app/order-service/package.json ./order-service/package.json

EXPOSE 3003
CMD ["node", "order-service/dist/server.js"]
