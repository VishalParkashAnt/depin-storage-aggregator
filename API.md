# DePIN Storage Aggregator - API Documentation

Base URL: `http://localhost:3000/api`

## Authentication

Currently, the API uses a simple email-based identification system. For production, implement proper authentication (JWT, OAuth, etc.).

---

## Health Check

### GET /health

Check if the API is running.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## Storage Plans

### GET /storage/plans

Get all available storage plans.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| provider | string | Filter by provider slug (e.g., "filecoin") |
| providerId | string | Filter by provider ID |
| minStorage | number | Minimum storage in GB |
| maxStorage | number | Maximum storage in GB |
| minPrice | number | Minimum price in cents |
| maxPrice | number | Maximum price in cents |
| page | number | Page number (default: 1) |
| pageSize | number | Items per page (default: 20, max: 100) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "providerId": "uuid",
      "providerName": "Filecoin",
      "providerSlug": "filecoin",
      "name": "Filecoin Starter",
      "description": "Entry-level decentralized storage",
      "storageSizeGb": 1,
      "storageSizeBytes": "1073741824",
      "durationDays": 180,
      "priceUsdCents": 99,
      "priceUsd": "0.99",
      "priceNative": "0.01",
      "nativeCurrency": "FIL",
      "network": "TESTNET",
      "features": ["Cryptographic proof", "3x replication"],
      "isAvailable": true
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

### GET /storage/plans/:planId

Get a specific storage plan by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "providerName": "Filecoin",
    "name": "Filecoin Starter",
    "storageSizeGb": 1,
    "priceUsd": "0.99",
    ...
  }
}
```

---

## Providers

### GET /providers

Get all active storage providers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Filecoin",
      "slug": "filecoin",
      "description": "Decentralized storage network",
      "website": "https://filecoin.io",
      "logoUrl": "/logos/filecoin.svg",
      "network": "TESTNET",
      "status": "ACTIVE",
      "lastSyncedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /providers/:slug

Get a specific provider by slug.

### POST /providers/sync

Trigger synchronization for all providers.

**Response:**
```json
{
  "success": true,
  "data": {
    "results": {
      "filecoin": { "success": true },
      "arweave": { "success": true },
      "storj": { "success": true },
      "greenfield": { "success": true },
      "akash": { "success": true }
    }
  }
}
```

### POST /providers/:slug/sync

Trigger synchronization for a specific provider.

---

## Payments

### POST /payments/checkout

Create a Stripe checkout session for purchasing storage.

**Request Body:**
```json
{
  "userId": "uuid",
  "planId": "uuid",
  "idempotencyKey": "optional-unique-key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_xxx",
    "sessionUrl": "https://checkout.stripe.com/...",
    "orderId": "uuid"
  }
}
```

### POST /payments/webhook

Stripe webhook endpoint. This should be called by Stripe.

**Headers:**
- `stripe-signature`: Webhook signature from Stripe

**Request Body:** Raw Stripe event payload

### GET /payments/config/stripe

Get Stripe publishable key for frontend.

**Response:**
```json
{
  "success": true,
  "data": {
    "publishableKey": "pk_test_xxx"
  }
}
```

---

## Orders

### GET /orders

Get orders with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | Filter by user ID |
| status | string | Filter by status |
| providerId | string | Filter by provider ID |
| startDate | string | Filter orders created after date |
| endDate | string | Filter orders created before date |
| page | number | Page number |
| pageSize | number | Items per page |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "orderNumber": "ORD-XXX-XXX",
      "userId": "uuid",
      "provider": {
        "id": "uuid",
        "name": "Filecoin",
        "slug": "filecoin"
      },
      "plan": {
        "id": "uuid",
        "name": "Filecoin Starter",
        "storageSizeGb": 1,
        "durationDays": 180
      },
      "storageSizeGb": 1,
      "durationDays": 180,
      "priceUsdCents": 99,
      "priceUsd": "0.99",
      "status": "COMPLETED",
      "statusMessage": null,
      "storage": {
        "id": "fil_xxx",
        "endpoint": "https://gateway.lighthouse.storage/ipfs/xxx",
        "metadata": {}
      },
      "payment": {
        "status": "SUCCEEDED",
        "processedAt": "2024-01-01T00:00:00.000Z"
      },
      "blockchain": {
        "txHash": "0x...",
        "status": "CONFIRMED",
        "network": "TESTNET",
        "confirmations": 10,
        "explorerUrl": "https://calibration.filfox.info/message/0x..."
      },
      "paidAt": "2024-01-01T00:00:00.000Z",
      "allocatedAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2024-07-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### GET /orders/:orderId

Get a specific order by ID.

### GET /orders/stats

Get order statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 100,
    "completedOrders": 85,
    "pendingOrders": 10,
    "failedOrders": 5,
    "totalRevenueCents": 50000
  }
}
```

### POST /orders/:orderId/cancel

Cancel a pending order.

---

## Users

### POST /users/login

Get or create a user by email (simple authentication for MVP).

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "Optional Name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Optional Name",
    "walletAddress": null
  }
}
```

### POST /users

Create a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "walletAddress": "0x..."
}
```

### GET /users/:userId

Get user details.

### PUT /users/:userId

Update user information.

**Request Body:**
```json
{
  "name": "New Name",
  "walletAddress": "0x..."
}
```

### GET /users/:userId/orders

Get user with their orders.

---

## Order Status Flow

```
PENDING_PAYMENT → PAYMENT_PROCESSING → PAYMENT_COMPLETED
                                           ↓
                              BLOCKCHAIN_PENDING → BLOCKCHAIN_PROCESSING
                                                          ↓
                                              BLOCKCHAIN_CONFIRMED → COMPLETED
```

**Error States:**
- `PAYMENT_FAILED` - Payment was declined
- `BLOCKCHAIN_FAILED` - Blockchain transaction failed
- `CANCELLED` - Order was cancelled
- `REFUNDED` - Order was refunded

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {} 
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate resource |
| PAYMENT_ERROR | 402 | Payment failed |
| BLOCKCHAIN_ERROR | 500 | Blockchain transaction failed |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Internal server error |

---

## Rate Limiting

API requests are rate limited to 100 requests per 15 minutes per IP address.

When rate limited, you'll receive:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

---

## Webhooks

### Stripe Webhook Events

The following Stripe events are handled:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Mark payment as succeeded, trigger blockchain tx |
| `checkout.session.expired` | Mark payment and order as cancelled |
| `payment_intent.succeeded` | Confirm payment status |
| `payment_intent.payment_failed` | Mark payment and order as failed |

Configure your Stripe webhook to send events to:
```
POST https://your-domain.com/api/payments/webhook
```

---

## Testing

### Test Cards (Stripe Sandbox)

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Declined |
| 4000 0027 6000 3184 | Requires 3D Secure |

Use any future expiry date and any 3-digit CVC.