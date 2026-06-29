---
id: authentication
title: Authentication
sidebar_label: Authentication
---

# Authentication

## API key authentication

All server-to-server requests to the Kanall API require an API key in the `X-API-Key` header:

```
X-API-Key: ten_sk_4a3b2c1d...
```

You receive your API key once when you register via `POST /register`. Kanall stores only a SHA-256 hash — the raw key is never retrievable after the registration response.

**Rules:**

- Keep your API key in environment variables only — never in source code, client-side JavaScript, or version control
- If your key is compromised, contact support to rotate it
- All API key requests are rate-limited per key (see [Rate limits](../concepts/tenants#rate-limits))

## Obtaining an API key

```bash
curl -X POST https://api.kanall.dev/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Organisation",
    "email": "ops@yourcompany.ng",
    "password": "secure-password-min-8-chars"
  }'
```

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "ten_sk_4a3b2c1d...",
  "warning": "Store this API key securely — it will not be shown again."
}
```

## Session authentication (dashboard only)

The Kanall web dashboard authenticates with email and password. On login, the server sets an `httpOnly` session cookie (`kanall_session`) with a 7-day expiry. This cookie is used automatically by the browser — you never handle it in JavaScript.

Dashboard sessions and API keys are completely independent. An API key does not grant dashboard access.

## Unauthenticated endpoints

The following endpoints do not require authentication:

| Endpoint | Purpose |
|---|---|
| `POST /register` | Create a new tenant |
| `POST /auth/login` | Dashboard login |
| `GET /health` | Health check |
| `POST /v1/webhooks/nomba` | Nomba's inbound webhook (authenticated by HMAC signature, not API key) |

All other `/v1/*` endpoints require `X-API-Key`.

## Error responses

A missing or invalid API key returns:

```json
HTTP/1.1 401 Unauthorized

{
  "error": "unauthorized"
}
```

A suspended tenant returns:

```json
HTTP/1.1 403 Forbidden

{
  "error": "tenant is suspended"
}
```
