---
id: tenants
title: Tenants
sidebar_label: Tenants
---

# Tenants

A **tenant** is an organisation registered with Kanall. Every resource in the system — virtual accounts, customers, ledger entries, webhook deliveries — belongs to exactly one tenant.

## What a tenant represents

In Kanall's model, a tenant is your backend application or company. You register once, receive an API key, and use that key to provision virtual accounts for your own customers or entities.

```
Your Company (Tenant)
    │
    ├── virtual_account: driver-001 (Emeka, KYC Tier 2)
    ├── virtual_account: driver-002 (Fatima, KYC Tier 1)
    └── virtual_account: driver-003 (Chukwudi, KYC Tier 1)
```

Kanall is multi-tenant: many organisations can use the same Kanall deployment simultaneously, and their data is completely isolated from each other at the database level — every SQL query is scoped by `tenant_id`.

## Registration

Tenants register via `POST /register` with an organisation name, email, and password. A verification OTP is emailed to you. Confirm the OTP via `POST /auth/verify-email` to receive your API key. Kanall stores only a SHA-256 hash of the key — the raw value is never retrievable after that response.

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

## Business KYC

All tenants start with `kycStatus: "unverified"`. To verify your business, submit your organisation details via `POST /auth/business-kyc` from a dashboard session:

```json
{
  "businessType": "registered_business",
  "cacNumber": "RC-1234567"
}
```

Accepted `businessType` values: `sole_proprietor`, `registered_business`, `ngo`, `other`.

On success, `kycStatus` moves to `"verified"`. This is reflected in the `GET /auth/me` response.

:::note
Business KYC is at the tenant (company) level. Customer-level KYC tiers (CBN-mandated) are tracked separately on each Customer record. See [KYC](./kyc).
:::

## Outbound webhook signing

You can configure a per-tenant webhook signing secret via `POST /auth/webhook-secret`. Once set, Kanall signs every outbound delivery with `X-Kanall-Signature` using HMAC-SHA256. This lets you verify that deliveries are genuinely from Kanall and have not been tampered with.

The secret is stored encrypted (AES-256-GCM) server-side. See [Outbound signing](../api-reference/webhooks#outbound-signing) for the verification algorithm.

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
