---
id: authentication
title: Authentication
sidebar_label: Authentication
---

# Authentication

Kanall has two authentication contexts: **API key** (server-to-server, for your backend) and **session** (browser-based, for the dashboard).

---

## API key authentication

All `/v1/*` endpoints require an API key in the `X-API-Key` header:

```
X-API-Key: ten_sk_4a3b2c1d...
```

**Rules:**
- Store your API key in environment variables only — never in source code, client-side JavaScript, or version control
- If your key is compromised, rotate it via `POST /auth/rotate-key` (dashboard session required)
- All API key requests are rate-limited per key (see [Tenants — Rate limits](../concepts/tenants#rate-limits))

### Obtaining an API key

Registration triggers an OTP email. Verify the OTP to receive your API key.

**Step 1 — Register:**

```bash
curl -X POST https://kanall.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Organisation",
    "email": "ops@yourcompany.ng",
    "password": "secure-password-min-8-chars"
  }'
```

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Step 2 — Verify email:**

```bash
curl -X POST https://kanall.onrender.com/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "otp": "847291"
  }'
```

```json
{
  "apiKey": "ten_sk_4a3b2c1d...",
  "warning": "Store this API key securely — it will not be shown again."
}
```

Kanall stores only a SHA-256 hash of the key. The raw value is never retrievable after this response.

---

## Session authentication (dashboard)

The Kanall web dashboard authenticates with email and password. On login, the server sets an `httpOnly` session cookie (`kanall_session`) with a 7-day expiry. The browser sends this cookie automatically — you never handle it in JavaScript.

Dashboard sessions and API keys are completely independent. An API key does not grant dashboard access.

### Login

```bash
curl -X POST https://kanall.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ops@yourcompany.ng", "password": "secure-password"}'
```

### Logout

```bash
curl -X POST https://kanall.onrender.com/auth/logout
```

---

## Session endpoints

These endpoints require a valid dashboard session cookie (`kanall_session`). They are not accessible with an API key.

### Get current tenant

```
GET /auth/me
```

Returns the authenticated tenant's profile.

```bash
curl https://kanall.onrender.com/auth/me
```

```json
{
  "id": "550e8400-...",
  "name": "Acme Logistics",
  "email": "ops@acme.ng",
  "status": "active",
  "apiKeySuffix": "...3c1d",
  "kycStatus": "verified",
  "businessType": "registered_business",
  "createdAt": "2026-06-30T08:00:00Z"
}
```

| Field | Description |
|---|---|
| `apiKeySuffix` | Last 4 characters of your API key — for visual confirmation only |
| `kycStatus` | Business verification status: `unverified`, `pending_review`, or `verified` |
| `businessType` | Your registered business type, or `null` if KYC not yet submitted |

---

### Rotate API key

```
POST /auth/rotate-key
```

Generates a new API key and immediately invalidates the previous one. Returns the new raw key — store it immediately.

```bash
curl -X POST https://kanall.onrender.com/auth/rotate-key
```

```json
{
  "apiKey": "ten_sk_9z8y7x6w..."
}
```

---

### Submit business KYC

```
POST /auth/business-kyc
```

Submits your organisation's business verification details. This moves your account from `unverified` to `verified`. Required before provisioning accounts in production.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `businessType` | string | Yes | One of: `sole_proprietor`, `registered_business`, `ngo`, `other` |
| `cacNumber` | string | No | CAC registration number (e.g. `RC-1234567`) |

```bash
curl -X POST https://kanall.onrender.com/auth/business-kyc \
  -H "Content-Type: application/json" \
  -d '{
    "businessType": "registered_business",
    "cacNumber": "RC-1234567"
  }'
```

```json
{
  "kycStatus": "verified",
  "businessType": "registered_business"
}
```

See [KYC concepts](../concepts/kyc) for the full two-layer KYC model (business + customer tiers).

---

### Manage webhook signing secret

```
POST /auth/webhook-secret
```

Returns your outbound webhook signing secret. If you have not generated one yet, this creates and stores a new secret. Calling it again reveals the existing secret.

```bash
curl -X POST https://kanall.onrender.com/auth/webhook-secret
```

```json
{
  "webhookSecret": "a3f8b2c9d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a2"
}
```

The secret is stored encrypted (AES-256-GCM) server-side. The raw value is only visible through this endpoint.

Use this secret to verify outbound deliveries from Kanall — see [Outbound webhook signing](./webhooks#outbound-signing).

---

### List misdirected payments

```
GET /auth/misdirected
```

Returns webhook events that passed signature verification but whose `aliasAccountReference` did not match any virtual account in the system. These are payments that arrived on Nomba's rails but cannot be attributed to a provisioned account.

This endpoint is **session-only** (dashboard access) — it is not available via API key. Misdirected events are system-wide; they have no tenant owner by definition.

```bash
curl https://kanall.onrender.com/auth/misdirected
```

```json
{
  "events": [
    {
      "ID": "e1f2a3b4-...",
      "NombaTxnRef": "nom_txn_xyz789",
      "SignatureValid": true,
      "Status": "processed",
      "Category": "misdirected",
      "ErrorMessage": "account ref 'unknown-ref-999' not found",
      "RetryCount": 0,
      "ReceivedAt": "2026-07-02T14:22:00Z",
      "ProcessedAt": "2026-07-02T14:22:01Z"
    }
  ]
}
```

`events` is `null` if there are no misdirected events.

---

## Unauthenticated endpoints

| Endpoint | Purpose |
|---|---|
| `POST /register` | Create a new tenant |
| `POST /auth/login` | Dashboard login |
| `POST /auth/verify-email` | Verify email OTP and receive API key |
| `GET /health` | Health check |
| `POST /webhooks/nomba` | Nomba inbound webhook (HMAC-authenticated, not API key) |

---

## Error responses

Missing or invalid API key:

```json
HTTP/1.1 401 Unauthorized

{ "error": "unauthorized" }
```

Suspended tenant:

```json
HTTP/1.1 403 Forbidden

{ "error": "tenant is suspended" }
```
