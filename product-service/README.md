# Product Service

Owns the product catalog and stock counts. Products are seeded on startup; stock can be reserved or released through internal endpoints.

Base URL:

```text
http://localhost:3002
```

Internal API key:

```text
x456ythjenRQWP90hfhrnsagbrgfh
```

Seeded products:

```text
001 - Wireless Mouse
002 - Mechanical Keyboard
003 - 27" Monitor
```

## Endpoints

### GET /health

Checks whether the service and MongoDB connection are ready.

```powershell
curl.exe http://localhost:3002/health
```

### GET /metrics

Returns Prometheus metrics.

```powershell
curl.exe http://localhost:3002/metrics
```

### GET /products

Lists products with pagination.

```powershell
curl.exe "http://localhost:3002/products?page=1&pageSize=10"
```

Pagination examples:

```powershell
curl.exe "http://localhost:3002/products?page=1&pageSize=2"
curl.exe "http://localhost:3002/products?page=2&pageSize=2"
```

### GET /products/:productId

Returns one product and its current stock.

```powershell
curl.exe http://localhost:3002/products/001
```

### PATCH /products/:productId/reserve

Internal endpoint used by Order Service to decrement stock.

```powershell
curl.exe -X PATCH http://localhost:3002/products/001/reserve `
  -H "Content-Type: application/json" `
  -H "X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh" `
  -d "{\"quantity\":1}"
```

### PATCH /products/:productId/release

Internal endpoint used by Order Service to release previously reserved stock.

```powershell
curl.exe -X PATCH http://localhost:3002/products/001/release `
  -H "Content-Type: application/json" `
  -H "X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh" `
  -d "{\"quantity\":1}"
```

Useful checks:

```powershell
# Valid format, missing product: 404
curl.exe http://localhost:3002/products/999

# Invalid ID format: 400
curl.exe http://localhost:3002/products/prod-0001

# Missing internal key: 403
curl.exe -X PATCH http://localhost:3002/products/001/reserve `
  -H "Content-Type: application/json" `
  -d "{\"quantity\":1}"

# Invalid quantity: 400
curl.exe -X PATCH http://localhost:3002/products/001/reserve `
  -H "Content-Type: application/json" `
  -H "X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh" `
  -d "{\"quantity\":0}"
```
