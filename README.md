# E-Commerce Microservices Demo

A small e-commerce backend split into independently deployable microservices,
demonstrating REST-based synchronous communication, RabbitMQ-based
asynchronous communication, and production-grade resilience/consistency
patterns.

## Architecture

```
Customer
  |  POST /orders {customerId, productId, amount?}   (Idempotency-Key header optional)
  v
Order Service --GET--> Customer Service (validate customer exists)
  |                \--> Product Service  (validate product exists, get authoritative price)
  |                \--> Product Service  (PATCH /reserve - atomic stock decrement)
  |
  |- saves Order { orderId, customerId, productId, amount: SERVER PRICE, orderStatus: pending }
  |   (order is durably persisted BEFORE payment is attempted)
  |
  |--POST /payments {customerId, orderId, productId, amount}--> Payment Service
  |<---------------- {paymentId, orderId, status: accepted} --------|
  |
  |- updates Order { paymentInitiated: true, orderStatus: confirmed }
  \- responds to customer { customerId, orderId, productId, orderStatus }

Payment Service
  \- publishes TransactionCreatedEvent (publisher-confirmed) to RabbitMQ "payment.events"
       \-> transaction-history-queue --> Transaction Worker --> saves to transaction history DB
             (processing failure --dead-letters to--> transaction-history-dlq)

Order Service (resilience path - Payment Service unreachable after retries+breaker)
  \- order ALREADY saved as pending (see above) - nothing to roll back
  \- publishes PaymentRetryRequestedEvent {attempts: 1} to "payment.retry" exchange
       \-> payment-retry-queue --> Payment Retry Worker
             |- SUCCESS -> PATCH order to {paymentInitiated: true, orderStatus: confirmed}
             |- FAILURE, attempts remain -> requeue via payment-retry-delay-queue (TTL bounce)
             \- FAILURE, attempts exhausted -> PATCH order to {orderStatus: failed}, dead-letter
                to payment-retry-dlq for manual/alerted follow-up
```

Each service owns its own MongoDB database - no service reads another
service's collections directly. All cross-service communication happens
over REST (synchronous, internal-auth-protected where mutating) or RabbitMQ
(asynchronous, with publisher confirms and dead-letter queues).

## Services

| Service                | Port | Responsibility                                                       |
|-------------------------|------|------------------------------------------------------------------------|
| customer-service        | 3001 | Owns customer data, seeded with one demo customer                     |
| product-service         | 3002 | Owns product catalog + atomic stock reservation, seeded with demo data |
| order-service           | 3003 | Orchestrates order creation; idempotency, consistency, trust boundary |
| payment-service         | 3004 | Simulated payment processing (always succeeds, demo only)             |
| payment-retry-worker    | 3006 (dagger) | Reconciles orders after a Payment Service outage (bounded retries) |
| transaction-worker      | 3005 (dagger) | Consumes transaction events, persists transaction history          |

(dagger) These two are queue consumers with no business HTTP API; the port only serves `/health` and `/metrics`.

## Getting started (Docker)

```bash
docker compose up --build
```

This starts MongoDB, RabbitMQ, and all 6 services/workers. Customer and
Product services seed their demo data automatically on container startup.

RabbitMQ management UI: http://localhost:15672 (guest/guest)

## Example requests

```bash
curl -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"customerId": "001", "productId": "001"}'
```

Note `amount` is no longer required in the request - Order Service derives
the authoritative price from Product Service (see edge case #6 below).

```bash
curl http://localhost:3001/customers/001
curl "http://localhost:3002/products?page=1&pageSize=10"
curl http://localhost:3003/health
curl http://localhost:3003/metrics
```

## Testing

```bash
npm test --workspaces
```

28 unit tests across all 6 workspaces, using fake repositories/clients
injected via the same interfaces used in production - no database, broker,
or network required. Integration tests (`*.routes.test.ts`) additionally
exercise the real Express app against an in-memory MongoDB
(`mongodb-memory-server`), which downloads a MongoDB binary on first run.

---

## Edge cases & design decisions (interview reference)

This section documents every gap identified in code review - what it was,
why it mattered, how it was fixed, and the senior-level reasoning behind
the fix. Everything below was flagged by either a colleague's review or a
self-audit before implementation began.

### 1. Payment retry queue existed but had no consumer -- the biggest gap

**The problem:** Order Service published a `payment.retry.requested` event
when Payment Service was down, but nothing ever consumed
`payment-retry-queue`. The design said "we'll reconcile later" without
actually implementing "later" - an order that hit this path stayed
`paymentInitiated: false` forever, with no path to resolution.

**The fix:** A new standalone service, **`payment-retry-worker`**, consumes
the queue and implements **bounded, delayed retries**:
- On success: calls back into Order Service (`PATCH /orders/:orderId/payment-status`)
  to mark the order `confirmed`.
- On failure with attempts remaining: republishes the event (with an
  incremented `attempts` count) to a **delay queue** configured with a
  fixed message TTL and a dead-letter-exchange pointing back at the main
  retry queue. This is the standard **"TTL + DLX bounce" pattern** for
  delayed retries in RabbitMQ, since core RabbitMQ has no native
  delay/schedule feature without a plugin (e.g.
  `rabbitmq-delayed-message-exchange`) - this demo intentionally avoids
  requiring a non-core plugin.
- On failure with attempts exhausted (default: 3): calls Order Service to
  mark the order permanently `failed`, then re-throws so the message is
  nacked to a **terminal DLQ** (`payment-retry-dlq`) as a durable,
  inspectable record for alerting/manual follow-up.

**Senior talking point:** *"A resilience mechanism that only degrades
gracefully but never recovers isn't actually resilient - it's just delayed
failure. Closing the loop with bounded retries and a terminal state is what
makes 'we'll reconcile later' an actual guarantee instead of a comment."*

### 2. No idempotency for order creation

**The problem:** If a client's request timed out or their network dropped
after `POST /orders` succeeded, a naive retry would create a second,
duplicate order - same customer, same product, two orders.

**The fix:** An optional `Idempotency-Key` header. Order Service checks for
an existing order with that key before creating a new one; if found, it
returns the existing order instead (a safe, side-effect-free replay). The
key is stored with a **unique sparse index** in MongoDB, and the code
handles the **race condition** where two concurrent requests with the same
key both pass the initial check: the loser's `insert` fails with MongoDB's
`E11000` duplicate-key error, which is caught and used to fetch-and-return
the winner's order (and release the stock the loser had already reserved -
see #5).

**Senior talking point:** *"A check-then-create without handling the
duplicate-key race is a TOCTOU (time-of-check-to-time-of-use) bug that only
shows up under real concurrency, which is exactly when you can least afford
it. The unique index is the actual source of truth; the pre-check is just
an optimization to avoid unnecessary work."*

### 3. Payment publishing was not fully guaranteed

**The problem:** `Publisher.publish()` originally used a plain
`channel.publish()` and checked its boolean return value. That boolean only
reflects local write-buffer pressure in the client library - it does
**not** mean the broker durably received the message. For a financial
transaction event, that gap is the difference between "we think we sent
it" and "the broker has confirmed it."

**The fix:** Switched to RabbitMQ **publisher confirms**
(`createConfirmChannel`), and `Publisher.publish()` now returns a Promise
that resolves only when the broker sends an explicit ack for that specific
message. Payment Service `await`s this before responding "accepted" to
Order Service - if the broker doesn't confirm, the whole request fails
(surfaces as a 5xx, which Order Service's existing retry/circuit-breaker
logic already treats as "payment service unavailable").

**Senior talking point (as originally framed):** *"For financial
transaction events, I used publisher confirms to avoid losing events after
payment acceptance."* A full **transactional outbox pattern** (writing the
event to a local DB table in the same transaction as a state change, then
relaying from that table to the broker) is the next level of guarantee
beyond publisher confirms - it protects against the process crashing
*between* a DB write and the publish call. It wasn't implemented here
because neither Payment Service nor Order Service currently pairs a DB
write with a publish in the same operation (Payment Service has no DB of
its own; Order Service's DB write happens *before* payment is attempted,
not atomically with a publish) - so the specific failure mode outbox solves
doesn't apply to this design as it stands. It's the right answer if that
changes.

### 4. Consistency issue between payment and order saving

**The problem:** The original flow was validate -> call payment -> save
order. If payment succeeded but the order save then failed (e.g. a DB
blip), you'd end up with a real transaction event for an order that was
never persisted - a "phantom charge."

**The fix:** Reordered to validate -> reserve stock -> **save order as
`pending` first** -> attempt payment -> update the already-saved order's
status based on the outcome. An order record is now guaranteed to exist
before money ever moves. If the post-payment update step itself fails
(e.g. a DB blip right after a successful payment), the order still exists
correctly as `pending` with the payment technically accepted - a much
smaller, self-healing inconsistency window than the original design, and
one a periodic reconciliation sweep (not implemented, but straightforward
to add) could close entirely by cross-checking Payment Service's/the
transaction history's records against orders stuck in `pending`.

**Senior talking point:** *"I considered a full saga with explicit states
(ORDER_CREATED -> PAYMENT_PENDING -> PAYMENT_ACCEPTED/FAILED) but for a
single-service-boundary flow like this, 'persist first, mutate after' gets
90% of the consistency benefit with a fraction of the complexity. A full
saga/orchestrator pattern earns its cost once you have three or more steps
that each need independent compensation, or when the steps span multiple
write-your-own-database services in a longer chain."*

### 5. No product stock reservation or decrement

**The problem:** `Product.stock` existed in the schema but nothing ever
read or decremented it. Two customers could "order" the last unit
simultaneously and both succeed - a classic oversell race condition.

**The fix:** An atomic `PATCH /products/:productId/reserve` endpoint using
a single `findOneAndUpdate({ productId, stock: { $gte: quantity } }, { $inc:
{ stock: -quantity } })`. The `$gte` guard is evaluated and applied as one
indivisible MongoDB operation, so under concurrent requests only as many
can succeed as there is actual stock - the rest correctly receive "409
insufficient stock" instead of racing past each other. A compensating
`PATCH /products/:productId/release` endpoint rolls back the reservation if
a later, genuinely unexpected step fails (e.g. the order document fails to
save for a reason unrelated to payment).

**Senior talking point:** *"The key insight is that the guard and the
mutation have to be the SAME atomic database operation - checking stock
with one query and decrementing with a second query has a race window
between them no matter how fast they run. `findOneAndUpdate` with the
condition in the filter, not in application code, is what actually
closes that window."*

### 6. Amount was trusted from the client

**The problem:** `POST /orders` accepted `{customerId, productId, amount}`
and used the client-supplied `amount` directly - meaning a malicious or
buggy client could order a $999 product while claiming `amount: 0.01`, and
the system would happily charge and record a transaction for a penny.

**The fix:** `amount` is now optional in the request and, when sent, is
**purely advisory** - logged for detecting mismatched/buggy/malicious
clients, but never used as the actual charge. Order Service always fetches
the product from Product Service and uses its `price` as the sole source
of truth for what gets charged and persisted.

**Senior talking point:** *"Never trust a client-supplied value for
anything that affects money when you already have the source of truth one
hop away. This is a trust-boundary bug, not an edge case - it's the kind of
thing that fails a PCI/security review outright, independent of how
unlikely you think a malicious client is."*

---

### Additional gaps identified and fixed (self-audit, not in the original review)

**7. No circuit breaker, only retry-with-backoff.** Retry-with-backoff
alone means every incoming request during a Payment Service outage still
pays the cost of 3 retries before failing - hammering a known-dead service
under load. Added a **circuit breaker** (`opossum`) wrapping the
retry logic in the shared `HttpClient`: once enough calls fail, the breaker
trips open and fails fast immediately for a cooldown window, then allows a
trial request through (half-open) to check recovery. Retry and circuit
breaker are complementary, not redundant - retry absorbs a single blip, the
breaker protects against a sustained outage across many concurrent callers.

**8. No service-to-service authentication.** Any of these services could be
called directly by anyone with network access to the container - no API
gateway, no mTLS, no signed tokens. Added a lightweight
**shared-secret header check** (`internalAuthMiddleware` /
`X-Internal-Api-Key`) on every internal-only mutating endpoint (stock
reserve/release, payment initiation, order payment-status updates).
Documented explicitly as a **scoped-down stand-in**: a production system on
a shared network would want mTLS or short-lived signed service tokens
(e.g. SPIFFE/SPIRE), not a static secret - this is the minimum viable
control for a local demo, not a production-grade identity system.

**9. Health checks didn't reflect all critical dependencies.** Order
Service and Payment Service's `/health` only checked MongoDB (or nothing at
all) - if RabbitMQ silently disconnected, the service would report healthy
while actually degraded. `/health` now combines MongoDB **and** RabbitMQ
connectivity where relevant, via each connection wrapper's own
`isConnected()`.

**10. No graceful shutdown.** None of the services handled `SIGTERM`/
`SIGINT` - a rolling deploy or `docker compose down` would kill in-flight
requests and leave DB/broker connections in a dirty state. Added a shared
`registerGracefulShutdown` helper: stop accepting new HTTP connections,
drain in-flight ones, close Mongo/RabbitMQ cleanly, and force-exit after a
timeout so orchestrators aren't left waiting indefinitely.

**11. No dead-letter-queue visibility.** Messages landing in
`transaction-history-dlq` or `payment-retry-dlq` just sat there with no
alerting. Both workers now expose a `/metrics` endpoint (Prometheus format)
with a `dead_letter_queue_depth` gauge, so an alert can fire the moment
messages start accumulating instead of someone discovering it weeks later.

**12. No rate limiting.** `POST /orders` had no protection against a client
hammering it. Added a basic per-IP rate limiter (`express-rate-limit`, 30
requests/minute). Documented as **single-instance-only**: a
multi-instance production deployment would need a shared store (Redis)
behind the limiter so limits apply across all instances, not per-process.

**13. No pagination.** `GET /products` returned every product
unconditionally - fine at 4 products, not fine at 40,000. Added
`page`/`pageSize` query params with a paginated response shape
(`{items, total, page, pageSize}`).

**14. No metrics/observability beyond logs.** Added basic Prometheus
instrumentation (`prom-client`) to every HTTP service: default Node.js
process metrics (memory, event loop lag, GC) plus an `http_requests_total`
counter by method/route/status, exposed at `/metrics`.

---

### Deliberately NOT implemented, with reasoning

Knowing what to leave out of a demo - and being able to explain why - is
itself part of the signal this section is meant to demonstrate.

- **Full transactional outbox pattern.** As explained in #3 above,
  publisher confirms already close the specific gap present in this
  design (no service currently pairs a DB write with a publish in the same
  atomic operation). A full outbox is the correct answer the moment that
  changes - e.g. if Payment Service gained its own database and needed to
  record a payment row *and* publish an event atomically.

- **Distributed tracing (OpenTelemetry + a tracing backend like Jaeger).**
  Correlation IDs are already propagated through every HTTP call and
  RabbitMQ message property, which gives request-level traceability through
  logs today. Wiring up full span-based tracing needs a backend
  (Jaeger/Tempo/etc.) to actually visualize - standing that up for a local
  demo would add infrastructure weight without a corresponding way to
  showcase it meaningfully in an interview setting. Correlation-ID-based log
  tracing is the right lightweight stand-in until distributed tracing is
  genuinely needed (multiple teams, dozens of services, need for latency
  breakdowns across hops).

- **mTLS / signed service tokens for internal auth.** A static shared
  secret (see #8) is the minimum viable control for this scope. Real mTLS
  needs a certificate authority and rotation story that's disproportionate
  to a local Docker Compose demo.

- **Redis-backed distributed rate limiting.** The current limiter is
  per-process/in-memory, which is correct for a single-instance demo but
  would under-count (allow too much traffic through) if this service were
  horizontally scaled. Swapping the store is a small, well-understood
  change (`express-rate-limit` supports a Redis store directly) - not
  implemented here purely because there's no multi-instance deployment in
  this demo to actually exercise it against.

- **A full saga/orchestrator with explicit state machine.** See #4 - the
  "persist first, mutate after" approach gets most of the benefit for this
  flow's actual complexity (one synchronous dependent call, one async
  reconciliation path). A true saga earns its complexity budget at three or
  more compensable steps across service boundaries, which this flow doesn't
  reach.

---

## Design decisions from the original build (still relevant)

- **Sync vs async communication**: Customer -> Order and Order -> Payment are
  synchronous REST calls because the caller needs an immediate answer to
  proceed. Payment -> Transaction history is asynchronous via RabbitMQ
  because nothing is waiting on it.

- **SOLID via constructor injection, not a DI framework**: every service
  layer depends on repository/client *interfaces*, injected via the
  constructor in a single composition root (`app.ts`). This satisfies
  Dependency Inversion and keeps everything unit-testable without the
  overhead of a framework like InversifyJS at this scale.

- **Shared code lives in `shared/`** as an npm workspace package
  (`@ecommerce/shared`): error classes, logger, the retrying+circuit-broken
  HTTP client, RabbitMQ connection/publisher/consumer wrapper,
  internal-auth middleware, rate limiter, metrics helper, graceful-shutdown
  helper, cross-service DTOs, and Joi validation middleware.

- **`productId` on the payment request**: the original spec describes
  Order -> Payment as `{customerId, orderId, amount}`, but Payment Service
  needs `productId` to publish a complete transaction event. Rather than
  have Payment Service call back to Product Service just to look it up,
  Order Service (which already has it) passes it through directly.
