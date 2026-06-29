---
id: tenants
title: Tenants
sidebar_label: Tenants
---

# Tenants

A **tenant** is an organisation registered with Kanall. Every resource in the system — virtual accounts, ledger entries, webhook deliveries — belongs to exactly one tenant.

## What a tenant represents

In Kanall's model, a tenant is your backend application or company. You register once, receive an API key, and use that key to provision virtual accounts for your own customers or entities.

```
Your Company (Tenant)
    │
    ├── virtual_account: driver-001 (Emeka)
    ├── virtual_account: driver-002 (Fatima)
    └── virtual_account: driver-003 (Chukwudi)
```

Kanall is multi-tenant: many organisations can use the same Kanall deployment simultaneously, and their data is completely isolated from each other at the database level — every SQL query is scoped by `tenant_id`.

## Registration

Tenants register via `POST /register` with an organisation name, email, and password. On success, an API key is returned **once** and never shown again. Kanall stores only a SHA-256 hash of the key.

```json
{
  "name": "Acme Logistics",
  "email": "ops@acme.ng",
  "password": "your-secure-password"
}
```

## Authentication

### Server-to-server (your backend → Kanall API)

Pass your API key in the `X-API-Key` header on every request:

```
X-API-Key: ten_sk_4a3b2c1d...
```

This is the only method your backend should use. API keys are long-lived and should be stored in your environment variables, never in source code or client-side code.

### Dashboard (browser → Kanall)

The Kanall web dashboard authenticates with email and password, which creates a server-side session stored in an `httpOnly` cookie (`kanall_session`). The raw session token never leaves the cookie — only its SHA-256 hash is stored in the database.

Dashboard sessions and API key sessions are separate. An API key does not grant dashboard access and vice versa.

## Tenant isolation

All repository queries include a `WHERE tenant_id = $1` clause. There is no admin override that bypasses tenant scoping in the application layer. If a virtual account was provisioned by Tenant A, Tenant B cannot read, modify, or receive webhooks for it — even if they guess the correct `AccountRef`.

## Tenant status

| Status | Description |
|---|---|
| `active` | Normal operation — all API calls succeed |
| `suspended` | API calls are rejected with `403 Forbidden`. Contact support. |

Suspension is an operator-level action and is not accessible via the tenant API.

## Rate limits

Kanall applies per-tenant rate limits at the API key level:

| Endpoint | Limit |
|---|---|
| `POST /register` | 5 req/min per IP |
| `POST /v1/accounts` | 20 req/min per API key |
| `GET /v1/accounts` | 100 req/min per API key |
| `GET /v1/accounts/:ref/statement` | 60 req/min per API key |

Requests that exceed the limit receive `429 Too Many Requests`.
