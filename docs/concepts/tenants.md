---
id: tenants
title: Tenants
sidebar_label: Tenants
---

# Tenants

Your company is a tenant. Every virtual account, ledger entry, customer record, and webhook delivery in Kanall belongs to exactly one tenant — and no tenant can ever see another's data.

You register once, get an API key, and everything you create with that key is permanently scoped to your organisation.

---

## What a tenant owns

```
StarLine Gas (Tenant)
    │
    ├── virtual_account: distributor-emeka
    ├── virtual_account: distributor-fatima
    └── virtual_account: distributor-chukwudi
```

Every SQL query in Kanall includes a `WHERE tenant_id = $1` clause. There is no admin path that bypasses tenant scoping — if a virtual account belongs to Tenant A, Tenant B cannot read, modify, or receive webhooks for it, even with a correct `AccountRef`.

---

## Registration

Sign up at **[kanall.vercel.app](https://kanall.vercel.app)** (recommended), or via the API:

```json
{
  "name": "StarLine Gas",
  "email": "ops@starlinegas.ng",
  "password": "your-secure-password"
}
```

A verification OTP is sent to your email. Confirm it to receive your API key. Kanall stores only a SHA-256 hash of the key — the raw value is never retrievable after that response. If you lose it, rotate from the dashboard.

---

## Authentication

### Server-to-server (your backend → Kanall API)

Pass your API key in the `X-API-Key` header on every request:

```
X-API-Key: ten_sk_4a3b2c1d...
```

This is the only method your backend should use. Store it in environment variables, never in source code or client-side JavaScript.

### Dashboard (browser → Kanall)

The Kanall dashboard at [kanall.vercel.app](https://kanall.vercel.app) uses email and password login, which sets a server-side `httpOnly` session cookie (`kanall_session`). Dashboard sessions and API key sessions are completely separate.

---

## Business KYC

All tenants start as `unverified`. To verify your business, submit your organisation details via the dashboard or `POST /auth/business-kyc`:

```json
{
  "businessType": "registered_business",
  "cacNumber": "RC-1234567"
}
```

Accepted `businessType` values: `sole_proprietor`, `registered_business`, `ngo`, `other`.

:::note
Business KYC is at the tenant (company) level. Customer-level KYC tiers (CBN-mandated transaction limits) are tracked separately on each Customer record. See [KYC](./kyc).
:::

---

## Outbound webhook signing

Configure a per-tenant webhook signing secret via `POST /auth/webhook-secret`. Once set, Kanall signs every outbound delivery with an `X-Kanall-Signature` header so you can verify that deliveries are genuinely from Kanall.

See [Outbound signing](../api-reference/webhooks#outbound-signing) for the verification algorithm.

---

## Tenant status

| Status | Meaning |
|---|---|
| `active` | Normal operation |
| `suspended` | API calls rejected with `403 Forbidden` — contact support |

---

## Rate limits

| Endpoint group | Limit |
|---|---|
| `POST /register` | 5 req/min per IP |
| `POST /v1/accounts` | 20 req/min per API key |
| `GET /v1/accounts`, `GET /v1/accounts/:ref`, `GET /v1/accounts/:ref/balance`, `GET /v1/accounts/:ref/history` | 100 req/min per API key |
| `PATCH /v1/accounts/:ref` | 20 req/min per API key |
| `GET /v1/accounts/:ref/statement` | 60 req/min per API key |
| `GET /v1/customers`, `GET /v1/customers/:id` | 100 req/min per API key |
| `PATCH /v1/customers/:id`, `POST /v1/customers/:id/kyc` | 20 req/min per API key |

Requests that exceed the limit receive `429 Too Many Requests`.
