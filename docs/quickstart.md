---
id: quickstart
title: Quick Start
sidebar_label: Quick Start
---

# Quick Start

In under 5 minutes you will have an API key, a provisioned virtual account with a real NUBAN, and a payment in the ledger.

We'll follow **StarLine Gas** — a gas distribution company that needs each of its distributors to have a dedicated collection account.

:::note What is a tenant?
In Kanall, your company is a **tenant**. Your API key identifies your tenant — every virtual account, ledger entry, and webhook delivery you create is permanently scoped to it. You'll see `TenantID` in API responses; that's you.
:::

---

## Step 1 — Get your API key

### Option A: Dashboard (recommended)

1. Go to **[www.kanall-app.online](https://www.kanall-app.online)** and sign up
2. Verify the one-time code sent to your email
3. Your API key is shown immediately after verification — copy and store it now

:::warning
Your API key is shown **once**. Kanall stores only a one-way hash — the raw key is never retrievable after this screen. If you lose it, rotate it from the dashboard at any time.
:::

### Option B: API

```bash
curl -X POST https://kanall.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "StarLine Gas",
    "email": "ops@starlinegas.ng",
    "password": "your-secure-password"
  }'
```

Kanall sends a one-time code to your email. Verify it:

```bash
curl -X POST https://kanall.onrender.com/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "otp": "847291"
  }'
```

**Response:**

```json
{
  "apiKey": "ten_sk_4a3b2c1d...",
  "warning": "Store this API key securely — it will not be shown again."
}
```

---

Either way, set your key for the steps below:

```bash
export API_KEY=ten_sk_4a3b2c1d...
```

---

## Step 1b — Set your webhook URL (do this once)

Before provisioning any accounts, tell Kanall where to send payment notifications. You only do this once — every account you create will deliver to this URL automatically.

```bash
curl -X POST https://kanall.onrender.com/auth/webhook-url \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://app.starlinegas.ng/webhooks/kanall"}'
```

---

## Step 2 — Provision a virtual account

StarLine Gas has a distributor named **Emeka Okafor** on Route 7. He needs a dedicated account so customer payments land with his name attached and can be tracked independently.

```bash
curl -X POST https://kanall.onrender.com/v1/accounts \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "distributor-emeka",
    "name": "Emeka Okafor"
  }'
```

`externalRef` is your stable identifier — your internal distributor ID, customer ID, or any unique reference. Kanall uses it as the account's lookup key.

**Response:**

```json
{
  "AccountRef": "distributor-emeka",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Emeka Okafor",
  "BankName": "Nomba MFB",
  "Status": "active"
}
```

`BankAccountNumber` is the NUBAN. Share it with whoever is paying Emeka — they transfer to this number at any Nigerian bank.

---

## Step 3 — Receive a payment

A customer sends ₦5,025 to `0123456789`. Nomba fires a webhook to Kanall.

Kanall verifies the signature, checks idempotency, and posts a `provisional` ledger entry. Moments later the confirmation pipeline promotes it to `confirmed`. Your `callbackUrl` receives a payment event:

```json
{
  "eventType": "payment.received",
  "accountRef": "distributor-emeka",
  "amount": "5000.00",
  "gross_amount": "5025.00",
  "nomba_fee": "25.00",
  "currency": "NGN",
  "senderName": "Chidi Emmanuel",
  "status": "provisional"
}
```

`amount` is the net after Nomba's ₦25 NIP fee. `status` will become `confirmed` in seconds — you can poll the statement or wait for the confirmation if your flow requires it.

---

## Step 4 — Check the ledger

```bash
curl https://kanall.onrender.com/v1/accounts/distributor-emeka/statement \
  -H "X-API-Key: $API_KEY"
```

**Response:**

```json
{
  "lines": [
    {
      "entry": {
        "Direction": "credit",
        "Amount": "5000.00",
        "Fee": "25.00",
        "Status": "confirmed",
        "Narration": "Transfer from Chidi Emmanuel"
      },
      "runningBalance": "5000.00"
    }
  ],
  "closingBalance": "5000.00"
}
```

Emeka's balance is ₦5,000. The ₦25 fee is recorded but excluded from the balance — it went to Nomba.

---

## Step 5 — Settle (optional)

At the end of the week, StarLine Gas pays Emeka his collected balance:

```bash
curl -X POST https://kanall.onrender.com/v1/accounts/distributor-emeka/settle \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5000.00",
    "bankCode": "044",
    "accountNumber": "0987654321",
    "narration": "Emeka payout - week 28"
  }'
```

**Response:** `202 Accepted`

```json
{
  "merchantTxRef": "knl_1751500000_abc12345",
  "status": "pending"
}
```

The transfer is queued. Track it with `GET /v1/transfers/knl_1751500000_abc12345`.

---

## What's next

- [Tutorial: StarLine Gas end-to-end](./tutorial/) — the full integration story: multiple distributors, one-time collection accounts, fee calculation, and settlement
- [Core Concepts](./concepts/tenants) — how the ledger, confirmation pipeline, and webhooks actually work
- [API Reference](./api-reference/authentication) — every endpoint, field, and error response
