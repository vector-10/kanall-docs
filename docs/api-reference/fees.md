---
id: fees
title: Fees
sidebar_label: Fees
---

# Fees

## How Nomba's transfer fee works

Every time someone sends money to a virtual account NUBAN via bank transfer, Nomba deducts a fee before the money reaches your balance. This is a CBN-mandated NIP (NIBSS Instant Payment) fee, not a Kanall charge.

The fee is based on how much the payer sends:

| Amount the payer sends | Fee deducted |
|---|---|
| Below ₦5,000 | ₦10 |
| ₦5,000 – ₦50,000 | ₦25 |
| Above ₦50,000 | ₦50 |

**Example:** Your customer sends ₦5,025 to a virtual account NUBAN. Nomba deducts ₦25. Your balance gets ₦5,000. The outbound webhook Kanall sends you will show all three figures:

```json
{
  "amount":       "5000.00",
  "gross_amount": "5025.00",
  "nomba_fee":    "25.00"
}
```

## How Kanall handles fees in the ledger

Kanall records the **net** amount in the ledger — the amount that actually landed after Nomba's fee. The fee is stored in a separate column for transparency but is not included in your balance.

This means your balance always matches what's in Nomba's wallet. If you settle ₦5,000 out and your balance shows ₦5,000, the transfer will go through.

## Calculate the right amount to quote

If you need your customer to pay an exact amount — say ₦5,000 for a food order — you have to ask them to send a bit more so that after Nomba's cut, ₦5,000 lands.

Use this endpoint to calculate the right figure:

```
GET /v1/fees/calculate?amount=5000
```

```bash
curl "https://kanall.onrender.com/v1/fees/calculate?amount=5000" \
  -H "X-API-Key: ten_sk_..."
```

**Response:**

```json
{
  "receive_amount": "5000.00",
  "nomba_fee":      "25.00",
  "send_amount":    "5025.00"
}
```

| Field | Description |
|---|---|
| `receive_amount` | The amount that lands in your balance |
| `nomba_fee` | What Nomba will deduct |
| `send_amount` | What you should ask your customer to transfer |

Set `expectedAmount` to `send_amount` when creating a one-time virtual account for a checkout. That way, when the customer sends ₦5,025, Kanall confirms the match and auto-expires the account.

## What if the fee tier changes?

The CBN updates these tiers occasionally. Kanall will update the calculation endpoint when that happens. Your integration does not need to hardcode the tiers — just call the endpoint.
