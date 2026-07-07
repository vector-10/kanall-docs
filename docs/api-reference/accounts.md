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

## Initiate settlement (outbound transfer)

```
POST /v1/accounts/:accountRef/settle
```

Initiates an outbound bank transfer from a virtual account's confirmed ledger balance to an external Nigerian bank account.

**Settlement flow:**

1. Kanall verifies the account's confirmed ledger balance is sufficient
2. A settlement job is created and a provisional debit entry is posted atomically
3. A background worker submits the transfer to Nomba and polls for confirmation
4. On success the debit is confirmed. On failure after 5 attempts the debit is reversed and the balance restored

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | string | Yes | Amount in naira — decimal string, e.g. `"5000.00"` |
| `bankCode` | string | Yes | Nigerian bank code, e.g. `"044"` for Access Bank |
| `accountNumber` | string | Yes | Destination 10-digit account number |
| `narration` | string | No | Transfer description (optional) |

```bash
curl -X POST https://kanall.onrender.com/v1/accounts/driver-001/settle \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5000.00",
    "bankCode": "044",
    "accountNumber": "0123456789",
    "narration": "Driver payout - week 27"
  }'
```

**Response:** `202 Accepted`

```json
{
  "merchantTxRef": "knl_1751500000_abc12345",
  "status": "pending",
  "amount": "5000.00",
  "currency": "NGN",
  "accountRef": "driver-001"
}
```

The transfer is queued — `status: "pending"` does not mean it has succeeded. Use `GET /v1/transfers/:merchantTxRef` to track it.

**Error responses:**

| Status | Error | Reason |
|---|---|---|
| `400` | `insufficient funds` | Confirmed ledger balance is less than the requested amount |
| `400` | `invalid amount` | Amount is zero, negative, or not a valid decimal |
| `404` | `account not found` | `accountRef` does not exist or belongs to another tenant |

:::note Balance and needs_review entries
The settlement balance check includes both `confirmed` and `provisional` entries. Only `needs_review` and `reversed` entries are excluded — a payment flagged for operator review cannot be settled against. See [The Ledger](../concepts/ledger) for how confirmation works.
:::

---

## Get transfer status

```
GET /v1/transfers/:merchantTxRef
```

Returns the current status of a settlement job by its internal reference.

```bash
curl https://kanall.onrender.com/v1/transfers/knl_1751500000_abc12345 \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "merchantTxRef": "knl_1751500000_abc12345",
  "status": "success",
  "amount": "5000.00",
  "bankCode": "044",
  "accountNumber": "0123456789",
  "attemptCount": 1,
  "createdAt": "2026-07-01T12:00:00Z",
  "updatedAt": "2026-07-01T12:00:04Z"
}
```

**Transfer status values:**

| Status | Meaning |
|---|---|
| `pending` | Queued, not yet submitted to Nomba |
| `processing` | Submitted to Nomba, awaiting confirmation |
| `success` | Nomba confirmed the transfer. Ledger debit is confirmed. |
| `failed` | All retry attempts exhausted. Debit has been reversed. |
| `refunded` | Nomba accepted then reversed the transfer (rare). Debit reversed. |

**Error responses:**

| Status | Error | Reason |
|---|---|---|
| `404` | `transfer not found` | `merchantTxRef` does not exist or belongs to another tenant |

---

## Lookup bank account

```
POST /v1/transfers/lookup
```

Resolves a bank account number to an account name before initiating a settlement. Use this to confirm the destination before calling `/settle`.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `accountNumber` | string | Yes | 10-digit account number |
| `bankCode` | string | Yes | Nigerian bank code |

```bash
curl -X POST https://kanall.onrender.com/v1/transfers/lookup \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"accountNumber": "0123456789", "bankCode": "044"}'
```

**Response:** `200 OK`

```json
{
  "AccountNumber": "0123456789",
  "AccountName": "EMEKA OKAFOR"
}
```

---

## List supported banks

```
GET /v1/transfers/banks
```

Returns a list of Nigerian banks and their codes, sourced from Nomba.

```bash
curl https://kanall.onrender.com/v1/transfers/banks \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "banks": [
    { "Code": "044", "Name": "Access Bank" },
    { "Code": "058", "Name": "GTBank" },
    { "Code": "011", "Name": "First Bank" }
  ]
}
```

---

## Valid state transitions

| Current status | Allowed actions |
|---|---|
| `active` | expire |
| `expired` | none — terminal state |

`expired` is the only terminal state. All previously recorded ledger entries remain and are still queryable via the [Statement API](./statement).
