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
| `externalRef` | string | Yes | Your stable identifier for this entity (driver ID, customer ID, order ID, etc.) |
| `name` | string | Yes | Account holder name as it will appear on Nomba |
| `bvn` | string | No | BVN for KYC — stored encrypted. Sets the linked customer to KYC Tier 1. |
| `callbackUrl` | string | No | Per-account webhook URL override — use this for local testing only. In production, set your URL once via `POST /auth/webhook-url` instead. |
| `expectedAmount` | number | No | Naira amount the payer is expected to send. See note on fees below. |
| `expiresAt` | string | No | ISO 8601 timestamp after which the account stops accepting payments |
| `mode` | string | No | `"dedicated"` (default) or `"onetime"` — see [One-time accounts](#one-time-virtual-accounts) |

```bash
curl -X POST https://kanall.onrender.com/v1/accounts \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "driver-001",
    "name": "Emeka Okafor",
    "bvn": "12345678901",
    "callbackUrl": "https://app.starlinegas.ng/webhooks/payment"
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
  "Type": "dedicated",
  "CallbackURL": "https://app.starlinegas.ng/webhooks/payment",
  "ExpectedAmount": null,
  "ExpiresAt": null,
  "CreatedAt": "2026-07-01T10:30:00Z",
  "UpdatedAt": "2026-07-01T10:30:00Z"
}
```

:::note About customers
Provisioning a virtual account automatically creates (or reuses) a `Customer` record linked to the account via `CustomerID`. Customers hold KYC tier state independently of any individual account. See the [Customers API](./customers) and [KYC](../concepts/kyc) for details.
:::

---

## One-time virtual accounts

By default, every virtual account is **dedicated** — it stays open permanently, receives unlimited payments, and gets reused if you provision the same `externalRef` again.

For checkout-style scenarios (a food order, an e-commerce payment, a one-off invoice), you can create a **one-time** account instead. Set `"mode": "onetime"` in the provision request.

One-time accounts behave differently in three ways:

1. **No deduplication.** Each provisioning call creates a fresh account regardless of `externalRef`. This is intentional — you might have ten open checkouts for the same customer simultaneously.
2. **Auto-expire on payment match.** If you set `expectedAmount`, Kanall automatically expires the account the moment a payment for that exact amount arrives. The NUBAN stops accepting transfers immediately.
3. **Time limit.** If you set `expiresAt`, Nomba closes the account at that deadline even if no payment has been received.

You can combine all three. If both `expectedAmount` and `expiresAt` are set, whichever happens first wins.

**Scenario examples:**

| Use case | Fields to set | What happens |
|---|---|---|
| Fixed checkout (food order ₦5,025) | `mode: onetime`, `expectedAmount: 5025` | Expires the moment ₦5,025 lands |
| Time-limited open collection | `mode: onetime`, `expiresAt: "2026-07-07T23:59:00Z"` | Expires at midnight regardless of payment |
| Fixed checkout with deadline | `mode: onetime`, `expectedAmount: 5025`, `expiresAt: "2026-07-07T23:59:00Z"` | Whichever happens first |

:::tip Setting the right expectedAmount
Nomba deducts a transfer fee from every inbound payment. If your order is ₦5,000 and you set `expectedAmount: 5000`, but the payer sends exactly ₦5,000, only ₦4,975 lands in your balance. To receive exactly ₦5,000, ask the payer to send ₦5,025 and set `expectedAmount: 5025`. Use `GET /v1/fees/calculate` to get the right figure without manual calculation.
:::

---

## Fee calculation

```
GET /v1/fees/calculate?amount=5000
```

Nomba deducts a CBN NIP fee from every inbound bank transfer before the money reaches your balance. This endpoint tells you the gross amount a payer needs to send so you receive exactly the amount you specify.

**Query parameters:**

| Parameter | Description |
|---|---|
| `amount` | The naira amount you want to receive (decimal) |

```bash
curl "https://kanall.onrender.com/v1/fees/calculate?amount=5000" \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "receive_amount": "5000.00",
  "nomba_fee":      "25.00",
  "send_amount":    "5025.00"
}
```

| Field | Description |
|---|---|
| `receive_amount` | What lands in your balance |
| `nomba_fee` | What Nomba takes |
| `send_amount` | What you should ask the payer to transfer |

**Current fee tiers** (CBN NIP, confirmed July 2026):

| Transfer amount | Fee |
|---|---|
| Below ₦5,000 | ₦10 |
| ₦5,000 – ₦50,000 | ₦25 |
| Above ₦50,000 | ₦50 |

The fee is charged to the receiver (you), not the sender. These tiers are set by the CBN and updated here when they change.

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
curl https://kanall.onrender.com/v1/accounts \
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
curl https://kanall.onrender.com/v1/accounts/driver-001 \
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
curl -X PATCH https://kanall.onrender.com/v1/accounts/driver-001 \
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

Returns the current ledger balance for a virtual account — the sum of all confirmed and provisional credit entries minus all confirmed and provisional debit entries. `needs_review` and `reversed` entries are excluded.

```bash
curl https://kanall.onrender.com/v1/accounts/driver-001/balance \
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
curl https://kanall.onrender.com/v1/accounts/driver-001/history \
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
curl -X POST https://kanall.onrender.com/v1/accounts/driver-001/expire \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK` — Account object with `"Status": "expired"`

---

## Settlement and transfers

Settlement endpoints have moved to the [Transfers API](./transfers) page — initiate settlement, track transfer status, lookup an account name, and list supported banks.

---

## Valid state transitions

| Current status | Allowed actions |
|---|---|
| `active` | expire |
| `expired` | none — terminal state |

`expired` is the only terminal state. All previously recorded ledger entries remain and are still queryable via the [Statement API](./statement).
