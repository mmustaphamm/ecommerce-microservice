# Customer Service

Owns customer data for the demo. Customers are seeded on startup; this service does not expose create, update, or delete endpoints.

Base URL:

```text
http://localhost:3001
```

Internal API key:

```text
x456ythjenRQWP90hfhrnsagbrgfh
```

## Endpoints

### GET /health

Checks whether the service and MongoDB connection are ready.

```powershell
curl.exe http://localhost:3001/health
```

### GET /metrics

Returns Prometheus metrics.

```powershell
curl.exe http://localhost:3001/metrics
```

### GET /customers/:customerId

Returns a seeded customer by ID. This is an internal endpoint used by Order Service, so it requires `X-Internal-Api-Key`.

Seeded IDs: `001`, `002`, `003`.

```powershell
curl.exe http://localhost:3001/customers/001 `
  -H "X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh"
```

Useful checks:

```powershell
# Missing internal key: 403
curl.exe http://localhost:3001/customers/001

# Invalid ID format: 400
curl.exe http://localhost:3001/customers/abc `
  -H "X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh"

# Valid format, missing customer: 404
curl.exe http://localhost:3001/customers/999 `
  -H "X-Internal-Api-Key: x456ythjenRQWP90hfhrnsagbrgfh"
```
