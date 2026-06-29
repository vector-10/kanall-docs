---
id: quickstart
title: Quick Start
sidebar_label: Quick Start
---

# Quick Start

In under 5 minutes you will have a registered tenant, a provisioned virtual account with a real NUBAN, and a confirmed payment in the ledger.

## Prerequisites

- `curl` or any HTTP client
- A running Kanall server (local or hosted)

Set your base URL:

```bash
export KANALL_URL=http://localhost:8080
```

---

## Step 1 — Register your organisation

```bash
curl -X POST $KANALL_URL/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Logistics",
    "email": "ops@acme.ng",
    "password": "your-secure-password"
  }'
```

**Response:**

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "ten_sk_4a3b2c1d...",
  "warning": "Store this API key securely — it will not be shown again."
}
```

:::warning
Save your `apiKey` immediately. Kanall stores only a hash. If you lose it, you must rotate (coming soon) or re-register.
:::

Set it for the remaining steps:

```bash
export API_KEY=ten_sk_4a3b2c1d...
```

---

## Step 2 — Provision a virtual account

```bash
curl -X POST $KANALL_URL/v1/accounts \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "driver-001",
    "name": "Emeka Okafor"
  }'
```

`externalRef` is your own stable identifier — your internal customer ID, driver ID, or any unique reference.

**Response:**

```json
{
  "ID": "7f3b9e2a-...",
  "TenantID": "550e8400-...",
  "AccountRef": "driver-001",
  "Provider": "nomba",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Emeka Okafor",
  "BankName": "Nomba MFB",
  "Currency": "NGN",
  "Status": "active",
  "CallbackURL": null,
  "ExpectedAmount": null,
  "CreatedAt": "2026-07-01T10:30:00Z",
  "UpdatedAt": "2026-07-01T10:30:00Z"
}
```

The `BankAccountNumber` is the NUBAN. Share it with whoever is paying this entity.

---

## Step 3 — Receive a payment

Give `BankAccountNumber` (`0123456789`) to your customer. When they transfer to that account number at any bank, Nomba fires a webhook to Kanall.

Kanall:
1. Verifies the Nomba signature
2. Checks the idempotency gate (`requestId` not yet seen)
3. Posts a `provisional` credit + debit pair to the ledger
4. Fires a webhook to your `callbackUrl` (if set)
5. The convergence sweep later promotes `provisional` → `confirmed`

---

## Step 4 — Check the ledger

```bash
curl $KANALL_URL/v1/accounts/driver-001/statement \
  -H "X-API-Key: $API_KEY"
```

**Response:**

```json
{
  "virtualAccount": { "AccountRef": "driver-001", "Status": "active", "..." : "..." },
  "lines": [
    {
      "entry": {
        "Direction": "credit",
        "Amount": "5000.00",
        "Fee": "0.60",
        "Currency": "NGN",
        "Status": "confirmed",
        "Narration": "Transfer from Chidi Emmanuel",
        "NombaTxnRef": "nom_txn_abc123",
        "CreatedAt": "2026-07-01T11:00:00Z"
      },
      "runningBalance": "5000.00"
    }
  ],
  "openingBalance": "0.00",
  "totalCredits": "5000.00",
  "totalDebits": "0.00",
  "closingBalance": "5000.00",
  "pagination": { "limit": 50, "nextCursor": null, "hasMore": false }
}
```

---

## Step 5 — Set up your webhook endpoint (optional but recommended)

When provisioning, pass `callbackUrl`:

```bash
curl -X POST $KANALL_URL/v1/accounts \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "driver-002",
    "name": "Fatima Yusuf",
    "callbackUrl": "https://your-backend.com/webhooks/payment"
  }'
```

Kanall will `POST` to that URL on every confirmed payment. See [Webhooks](./concepts/webhooks) for the payload shape and retry behaviour.

---

**What's next:**

- [Core Concepts](./concepts/tenants) — understand tenants, virtual accounts, the ledger, and webhooks in depth
- [API Reference](./api-reference/authentication) — full endpoint documentation
- [Tutorial: Logistics Integration](./tutorial/index) — end-to-end example with a real use case
