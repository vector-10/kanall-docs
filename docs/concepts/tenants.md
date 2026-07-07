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
Bokku Supermarket (Tenant)
    │
    ├── virtual_account: bokku-ikeja
    ├── virtual_account: bokku-lekki
    └── virtual_account: bokku-abuja
```

Kanall's isolation is absolute. If a virtual account belongs to your tenant, no other tenant can read it, modify it, or receive its webhooks — even if they know the account reference.

---

## Registration

Sign up at **[www.kanall-app.online](https://www.kanall-app.online)** (recommended), or via the API:

```json
{
  "name": "Bokku Supermarket",
  "email": "ops@bokku.ng",
  "password": "your-secure-password"
}
```

A verification code is sent to your email. Confirm it to receive your API key. The raw key is never stored — if you lose it, rotate it from the dashboard.

---

## Authentication

### Server-to-server (your backend → Kanall API)

Pass your API key in the `X-API-Key` header on every request:

```
X-API-Key: ten_sk_4a3b2c1d...
```

This is the only method your backend should use. Store it in environment variables, never in source code or client-side JavaScript.

### Dashboard (browser → Kanall)

The Kanall dashboard at [www.kanall-app.online](https://www.kanall-app.online) uses email and password login, which sets a secure session cookie. Dashboard sessions and API key sessions are completely separate.

When the dashboard refers to an **admin**, it means you — the operator from your company who manages accounts and reviews KYC submissions. It is not a Kanall superuser.

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

Configure a per-tenant webhook signing secret via `POST /auth/webhook-secret`. Once set, Kanall signs every outbound delivery with an `X-Kanall-Signature` header so you can verify that notifications are genuinely from Kanall.

See [Webhook Signature Verification](../guides/webhook-verification) for the verification algorithm.

---

## Tenant status

| Status | Meaning |
|---|---|
| `active` | Normal operation |
| `suspended` | API calls rejected with `403 Forbidden` — contact support |
