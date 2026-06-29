---
id: accounts
title: Accounts API
sidebar_label: Accounts
---

# Accounts API

## Provision a virtual account

```
POST /v1/accounts
```

Creates a new virtual account and provisions a NUBAN via Nomba.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `externalRef` | string | Yes | Your stable identifier for this entity (driver ID, customer ID, etc.) |
| `name` | string | Yes | Account holder name as it will appear on Nomba |
| `bvn` | string | No | BVN for KYC — stored encrypted (AES-256-GCM) |
| `callbackUrl` | string | No | URL to receive payment events for this account |
| `expectedAmount` | number | No | Fixed collection amount in naira. Enforced at rail level by Nomba. |

```bash
curl -X POST https://api.kanall.dev/v1/accounts \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "driver-001",
    "name": "Emeka Okafor",
    "callbackUrl": "https://app.naijadash.com/webhooks/payment"
  }'
```

**Response:** `201 Created` — Account object

```json
{
  "ID": "7f3b9e2a-4d1c-4e8b-9f2a-3c5d7e8b1a2c",
  "TenantID": "550e8400-e29b-41d4-a716-446655440000",
  "CustomerID": "nom_cust_...",
  "AccountRef": "driver-001",
  "Provider": "nomba",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Emeka Okafor",
  "BankName": "Nomba MFB",
  "Currency": "NGN",
  "Status": "active",
  "CallbackURL": "https://app.naijadash.com/webhooks/payment",
  "ExpectedAmount": null,
  "CreatedAt": "2026-07-01T10:30:00Z",
  "UpdatedAt": "2026-07-01T10:30:00Z"
}
```

---

## List accounts

```
GET /v1/accounts
GET /v1/accounts?after={cursor}
```

Returns a paginated list of virtual accounts for the authenticated tenant.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `after` | string | Cursor for the next page — value of `nextCursor` from previous response |

```bash
curl https://api.kanall.dev/v1/accounts \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "accounts": [ /* Account objects */ ],
  "pagination": {
    "limit": 20,
    "nextCursor": "9c4d1f3b-...",
    "hasMore": true
  }
}
```

---

## Get a single account

```
GET /v1/accounts/:accountRef
```

Returns a single virtual account by its `AccountRef` (your `externalRef`).

```bash
curl https://api.kanall.dev/v1/accounts/driver-001 \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK` — Account object

---

## Update an account

```
PATCH /v1/accounts/:accountRef
```

Updates mutable fields on a virtual account.

**Request body (all fields optional):**

| Field | Type | Description |
|---|---|---|
| `callbackUrl` | string | New webhook delivery URL |
| `expectedAmount` | number | New expected collection amount in naira |

```bash
curl -X PATCH https://api.kanall.dev/v1/accounts/driver-001 \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://app.naijadash.com/webhooks/v2/payment"
  }'
```

**Response:** `200 OK` — Updated account object

---

## Lifecycle actions

### Suspend

```
POST /v1/accounts/:accountRef/suspend
```

Stops the account from accepting payments. Valid from `active` status only.

```bash
curl -X POST https://api.kanall.dev/v1/accounts/driver-001/suspend \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK` — Account object with `"Status": "suspended"`

---

### Reactivate

```
POST /v1/accounts/:accountRef/reactivate
```

Returns a suspended account to active status.

```bash
curl -X POST https://api.kanall.dev/v1/accounts/driver-001/reactivate \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK` — Account object with `"Status": "active"`

---

### Expire

```
POST /v1/accounts/:accountRef/expire
```

Permanently closes an account. **This action is irreversible.** Valid from `active` or `suspended` status.

```bash
curl -X POST https://api.kanall.dev/v1/accounts/driver-001/expire \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK` — Account object with `"Status": "expired"`

---

## Valid state transitions

| Current status | Allowed actions |
|---|---|
| `active` | suspend, expire |
| `suspended` | reactivate, expire |
| `expired` | none — terminal state |
