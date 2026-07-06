# E-Commerce Microservices

A Dockerized e-commerce backend built as independent Node.js/TypeScript microservices. The project models a realistic checkout flow with separate ownership of customers, products, orders, payments, transaction history, and payment retry handling.

The root README explains how the full system works. Endpoint-level examples live in each service README:

```text
customer-service/README.md
product-service/README.md
order-service/README.md
```

## What The System Does

The system accepts an order request, validates the customer, validates the product, reserves stock, initiates payment, records the order, publishes a transaction event, and stores transaction history asynchronously.

It is designed around a few practical backend goals:

- Keep each service responsible for its own data.
- Avoid direct database sharing between services.
- Use REST only when an immediate answer is needed.
- Use RabbitMQ for work that can happen asynchronously.
- Avoid overselling product stock.
- Avoid duplicate orders from client retries.
- Keep orders recoverable when Payment Service or RabbitMQ has temporary issues.
- Expose health and metrics endpoints for basic operations visibility.

## Services

| Service | Port | Responsibility |
| --- | ---: | --- |
| Customer Service | 3001 | Owns customer records and answers internal customer lookups |
| Product Service | 3002 | Owns product catalog, price, and stock counts |
| Order Service | 3003 | Coordinates the checkout workflow |
| Payment Service | 3004 | Simulates payment acceptance and publishes transaction events |
| Transaction Worker | 3005 | Consumes transaction events and stores transaction history |
| Payment Retry Worker | 3006 | Reconciles orders that could not complete payment immediately |
| MongoDB | 27017 | Stores service-owned databases |
| RabbitMQ | 5672 / 15672 | Handles asynchronous events and exposes the management UI |

The workers are queue consumers. They expose monitoring endpoints, but they do not provide business APIs.

## High-Level Architecture

```text
Client
  |
  | create order
  v
Order Service
  |-- validate customer ----------> Customer Service
  |-- fetch product/price --------> Product Service
  |-- reserve stock --------------> Product Service
  |-- initiate payment -----------> Payment Service
  |
  v
MongoDB order_db

Payment Service
  |
  | transaction.created event
  v
RabbitMQ
  |
  v
Transaction Worker
  |
  v
MongoDB payment_db
```

The Order Service is the orchestrator. It does not own customers, products, or payment history. It asks the services that own those concepts for the facts it needs, then stores only order-specific state.

## Data Ownership

Each service owns its own database or collection boundary. Other services communicate with it through APIs or RabbitMQ messages instead of reading its data directly.

| Database | Owner | Stores |
| --- | --- | --- |
| `customer_db` | Customer Service | Customer records |
| `product_db` | Product Service | Product catalog, prices, stock |
| `order_db` | Order Service | Orders, order status, idempotency keys |
| `payment_db` | Transaction Worker | Transaction history |

This keeps service boundaries clear. For example, Order Service does not query `product_db` directly. It calls Product Service to get the product price and reserve stock.

## Main Order Flow

When a client creates an order, Order Service performs the workflow in this order:

1. Validate that the customer exists by calling Customer Service.
2. Fetch the product from Product Service.
3. Use Product Service's price as the authoritative amount.
4. Reserve one unit of product stock through Product Service.
5. Persist the order in `order_db`.
6. Mark the order as `payment_pending`.
7. Call Payment Service.
8. If payment is accepted, mark the order as `confirmed`.
9. Return the order response to the client.

The important detail is that the order is persisted before payment is attempted. That prevents a successful payment from existing without an order record.

## Product Stock Handling

Stock is owned by Product Service and stored directly on each product record.

During order creation, Order Service asks Product Service to reserve stock. Product Service performs the stock reservation with an atomic MongoDB update: the stock check and decrement happen in the same database operation.

That avoids the classic oversell race where two requests both read `stock = 1` and both succeed. With the atomic update, only one request can reserve the final unit.

If Order Service reserves stock but then fails before creating the order, it calls Product Service to release the reserved stock as compensation.

## Payment And Transaction History

Payment Service is intentionally simple: it simulates payment acceptance for the demo.

After accepting a payment, it publishes a `transaction.created` event to RabbitMQ. Transaction Worker consumes that event and saves the transaction history to `payment_db`.

This is asynchronous because the client does not need to wait for the transaction-history write before receiving the order response. That keeps the checkout path faster and reduces coupling between payment acceptance and historical reporting.

## Payment Retry Flow

If Payment Service is unavailable when Order Service tries to initiate payment, Order Service does not delete the order. Instead, it leaves the order in `payment_pending` and publishes a retry event to RabbitMQ.

Payment Retry Worker consumes retry events and tries to initiate the payment later.

On success:

```text
Payment Retry Worker -> Payment Service
Payment Retry Worker -> Order Service: mark order confirmed
```

On repeated failure:

```text
Payment Retry Worker -> Order Service: mark order failed
RabbitMQ -> payment retry dead-letter queue
```

Retries are bounded, so messages do not loop forever. Failed messages are moved to a dead-letter queue for inspection.

## RabbitMQ Topology

The system uses RabbitMQ for two main asynchronous flows.

Transaction history:

```text
payment.events exchange
  -> transaction-history-queue
  -> Transaction Worker
  -> transaction-history-dlq on processing failure
```

Payment retry:

```text
payment.retry exchange
  -> payment-retry-queue
  -> Payment Retry Worker
  -> payment-retry-delay-queue for delayed retry
  -> payment-retry-dlq after attempts are exhausted
```

The retry delay queue uses RabbitMQ's TTL + dead-letter exchange pattern. Messages wait in the delay queue, then return to the main retry queue when the TTL expires.

## Reliability And Efficiency

The system includes several safeguards that keep the workflow efficient and recoverable.

Idempotency:

Order creation accepts an `Idempotency-Key`. If a client retries the same request with the same key, Order Service returns the existing order instead of creating a duplicate.

Server-side pricing:

Clients may send `amount`, but Order Service does not trust it. It always fetches the product from Product Service and uses the product's stored price.

Atomic stock reservation:

Stock reservation is handled inside Product Service with a single guarded MongoDB update, avoiding oversell under concurrent requests.

Publisher confirms:

RabbitMQ publishing uses confirm channels, so a publish operation only succeeds after the broker acknowledges the message.

Startup retries:

Services that depend on RabbitMQ retry their initial connection. This avoids crashes during Docker startup when RabbitMQ is healthy but the AMQP port is not ready yet.

Graceful shutdown:

Services handle shutdown signals by closing HTTP servers and external connections cleanly.

Rate limiting:

HTTP services use basic rate limiting to reduce accidental or abusive request bursts.

Metrics:

Each service exposes Prometheus-format metrics. Workers also report dead-letter queue depth so operational failures are easier to detect.

## Internal Authentication

Internal-only endpoints require a shared header:

```text
X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh
```

This protects service-to-service operations such as stock reservation, payment initiation, and payment-status updates from casual direct access in the local demo environment.

For production, this should be replaced with stronger service identity, such as mTLS or signed short-lived service tokens managed through a secret manager.

## Seed Data

Customer and Product services seed demo data on startup.

Customers:

```text
001 - John Doe
002 - Jane Smith
003 - Ada Lovelace
```

Products:

```text
001 - Wireless Mouse         19.99   stock 100
002 - Mechanical Keyboard    79.99   stock 50
003 - 27" Monitor            249.99  stock 30
```

## Running The System

Prerequisites:

- Docker Desktop
- Node.js 20+ if running local workspace commands outside Docker

Start all services:

```powershell
docker compose up -d --build
```

Check status:

```powershell
docker compose ps
```

View logs:

```powershell
docker compose logs -f
```

Stop everything:

```powershell
docker compose down
```

RabbitMQ Management UI:

```text
http://localhost:15672
```

Login:

```text
guest / guest
```

## Quick Demo

Create an order:

```powershell
curl.exe -X POST http://localhost:3003/orders `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: demo-order-001" `
  -d "{\"customerId\":\"001\",\"productId\":\"001\"}"
```

The response includes an `orderId`. Use it to check order status:

```powershell
curl.exe http://localhost:3003/orders/ORDER_ID/status
```

Endpoint-level examples for each independently testable service are in the service READMEs.

## Testing

Run all tests:

```powershell
npm test --workspaces --if-present
```

Build all TypeScript workspaces:

```powershell
npm run build --workspaces --if-present
```

Some route tests use `mongodb-memory-server`, which starts a local MongoDB test process.

## Repository Layout

```text
customer-service/
product-service/
order-service/
payment-service/
transaction-worker/
payment-retry-worker/
shared/
docker-compose.yml
```

`shared/` is an npm workspace package containing shared DTOs, errors, logging, HTTP client utilities, RabbitMQ helpers, internal-auth middleware, metrics, validation, and graceful shutdown support.
