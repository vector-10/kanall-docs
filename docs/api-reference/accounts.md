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
| `bvn` | string | No | BVN for KYC — stored encrypted (AES-256-GCM). Sets the linked customer to KYC Tier 1. |
| `callbackUrl` | string | No | URL to receive payment events for this account |
| `expectedAmount` | number | No | Fixed collection amount in naira. Enforced at rail level by Nomba. |

```bash
curl -X POST https://api.kanall.dev/v1/accounts \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "driver-001",
    "name": "Emeka Okafor",
    "bvn": "12345678901",
    "callbackUrl": "https://app.naijadash.com/webhooks/payment"
  }'
```

**Response:** `201 Created` — Account object

```json
{
  "ID": "7f3b9e2a-4d1c-4e8b-9f2a-3c5d7e8b1a2c",
  "TenantID": "550e8400-e29b-41d4-a716-446655440000",
  "CustomerID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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

:::note About customers
Provisioning a virtual account automatically creates (or reuses) a `Customer` record linked to the account via `CustomerID`. Customers hold KYC tier state independently of any individual account. See the [Customers API](./customers) and [KYC](../concepts/kyc) for details.
:::

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

Updates mutable fields on a virtual account. At least one field is required.

**Request body (all fields optional):**

| Field | Type | Description |
|---|---|---|
| `callbackUrl` | string | New webhook delivery URL |
| `expectedAmount` | number | New expected collection amount in naira |
| `name` | string | Rename the account holder name on record |

```bash
curl -X PATCH https://api.kanall.dev/v1/accounts/driver-001 \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Emeka C. Okafor",
    "callbackUrl": "https://app.naijadash.com/webhooks/v2/payment"
  }'
```

**Response:** `200 OK` — Updated account object

:::note
Renaming via `PATCH` updates the `BankAccountName` field in Kanall's ledger only. Nomba's upstream record retains the original provisioning name.
:::

---

## Get account balance

```
GET /v1/accounts/:accountRef/balance
```

Returns the current ledger balance for a virtual account — the sum of all confirmed credit entries minus all confirmed debit entries. Provisional and reversed entries are excluded.

```bash
curl https://api.kanall.dev/v1/accounts/driver-001/balance \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "accountRef": "driver-001",
  "balance": "47500.00",
  "currency": "NGN"
}
```

`balance` is a decimal string in naira (e.g. `"47500.00"`). Never parse as a float — use a decimal library.

---

## Get account state history

```
GET /v1/accounts/:accountRef/history
```

Returns a chronological log of all status transitions for the account (e.g. `active → expired`).

```bash
curl https://api.kanall.dev/v1/accounts/driver-001/history \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "history": [
    {
      "ID": "b1c2d3e4-...",
      "VirtualAccountID": "7f3b9e2a-...",
      "FromStatus": null,
      "ToStatus": "active",
      "Reason": "provisioned",
      "CreatedAt": "2026-07-01T10:30:00Z"
    },
    {
      "ID": "f5e6d7c8-...",
      "VirtualAccountID": "7f3b9e2a-...",
      "FromStatus": "active",
      "ToStatus": "expired",
      "Reason": "tenant requested expiry",
      "CreatedAt": "2026-07-02T09:15:00Z"
    }
  ]
}
```

`history` is `null` if no transitions have been recorded yet.

---

## Expire an account

```
POST /v1/accounts/:accountRef/expire
```

Permanently closes an account. **This action is irreversible.** Valid from `active` status only.

```bash
curl -X POST https://api.kanall.dev/v1/accounts/driver-001/expire \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK` — Account object with `"Status": "expired"`

---

## Valid state transitions

| Current status | Allowed actions |
|---|---|
| `active` | expire |
| `expired` | none — terminal state |

`expired` is the only terminal state. All previously recorded ledger entries remain and are still queryable via the [Statement API](./statement).
