# Order Service

Orchestrates order creation. It validates the customer, reads the product price, reserves stock, calls Payment Service, and stores the order status.

Base URL:

```text
http://localhost:3003
```

Internal API key:

```text
x456ythjenRQWP90hfhrnsagbrgfh
```

Demo IDs:

```text
customerId: 001, 002, 003
productId: 001, 002, 003
```

## Endpoints

### GET /health

Checks whether the service, MongoDB, and RabbitMQ connection are ready.

```powershell
curl.exe http://localhost:3003/health
```

### GET /metrics

Returns Prometheus metrics.

```powershell
curl.exe http://localhost:3003/metrics
```

### POST /orders

Creates an order. `amount` is optional; the service uses the authoritative product price from Product Service.

`Idempotency-Key` is optional but recommended so retrying the same request does not create duplicate orders.

```powershell
curl.exe -X POST http://localhost:3003/orders `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: demo-order-001" `
  -d "{\"customerId\":\"001\",\"productId\":\"001\"}"
```

With an optional amount:

```powershell
curl.exe -X POST http://localhost:3003/orders `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: demo-order-002" `
  -d "{\"customerId\":\"001\",\"productId\":\"002\",\"amount\":79.99}"
```

### GET /orders/:orderId/status

Returns the current order status. Replace `ORDER_ID` with the value returned by `POST /orders`.

```powershell
curl.exe http://localhost:3003/orders/ORDER_ID/status
```

### PATCH /orders/:orderId/payment-status

Internal endpoint used by Payment Retry Worker to mark retried payments as confirmed or failed.

```powershell
curl.exe -X PATCH http://localhost:3003/orders/ORDER_ID/payment-status `
  -H "Content-Type: application/json" `
  -H "X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh" `
  -d "{\"paymentInitiated\":true,\"orderStatus\":\"confirmed\"}"
```

Allowed `orderStatus` values:

```text
pending
stock_reserved
payment_pending
confirmed
failed
```

Useful checks:

```powershell
# Missing required field: 400
curl.exe -X POST http://localhost:3003/orders `
  -H "Content-Type: application/json" `
  -d "{\"customerId\":\"001\"}"

# Missing order status: 404
curl.exe http://localhost:3003/orders/missing-order-id/status

# Missing internal key on payment-status update: 403
curl.exe -X PATCH http://localhost:3003/orders/ORDER_ID/payment-status `
  -H "Content-Type: application/json" `
  -d "{\"paymentInitiated\":true,\"orderStatus\":\"confirmed\"}"
```
