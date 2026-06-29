---
id: 03-receive-payments
title: "Step 3: Receive Payment Webhooks"
sidebar_label: "3. Receive Payments"
---

# Step 3: Receive Payment Webhooks

When a retailer transfers to their NUBAN, Kanall fires a `POST` to your `callbackUrl` within seconds. Your job: respond `200 OK` fast, then process asynchronously.

## Webhook payload

```json
{
  "event": "payment_received",
  "accountRef": "retailer-00142",
  "tenantId": "550e8400-...",
  "transactionRef": "nom_txn_abc123",
  "amount": "45000.00",
  "fee": "0.60",
  "currency": "NGN",
  "narration": "Transfer from Mama Ngozi",
  "senderName": "NGOZI OKONKWO",
  "senderBank": "Access Bank",
  "senderAccount": "0987654321",
  "status": "provisional",
  "timestamp": "2026-07-01T11:00:00Z"
}
```

Key fields:

| Field | Description |
|---|---|
| `accountRef` | Your `externalRef` — use this to find the retailer in your database |
| `amount` | In naira (Kanall converts from kobo internally) |
| `status` | `provisional` on first delivery. Becomes `confirmed` after Kanall's convergence sweep verifies with Nomba. |
| `transactionRef` | Nomba's transaction ID — store this for your own idempotency check |

## Webhook handler (Express)

```js
// routes/webhooks.js
const express = require('express')
const router = express.Router()
const db = require('../db')
const queue = require('../queue')  // your async job queue

router.post('/payment', express.json(), async (req, res) => {
  // Acknowledge Kanall immediately — do not make the webhook wait on DB writes
  res.status(200).json({ received: true })

  const event = req.body

  // Enqueue for async processing so a slow DB does not cause a retry
  queue.add('handle-payment', event)
})

module.exports = router
```

```js
// workers/handle-payment.js
async function handlePayment(event) {
  const { accountRef, transactionRef, amount, status } = event

  // Idempotency — skip if already processed
  const existing = await db.query(
    'SELECT id FROM payment_events WHERE transaction_ref = $1',
    [transactionRef]
  )
  if (existing.rows.length > 0) return

  // Find retailer
  const retailer = await db.query(
    'SELECT id, name FROM retailers WHERE kanall_ref = $1',
    [accountRef]
  )
  if (!retailer.rows.length) {
    console.error(`Unknown accountRef: ${accountRef}`)
    return
  }

  const retailerId = retailer.rows[0].id

  // Record the event
  await db.query(
    `INSERT INTO payment_events (transaction_ref, retailer_id, amount, status, received_at)
     VALUES ($1, $2, $3, $4, now())`,
    [transactionRef, retailerId, amount, status]
  )

  if (status === 'confirmed') {
    // Clear any open invoices for this amount
    await clearInvoice(retailerId, parseFloat(amount))
  }

  // provisional — wait for confirmation before clearing invoices
  // The convergence sweep will send another event with status: 'confirmed'
}
```

## Handling provisional vs confirmed

Kanall sends the webhook as soon as a payment is received — before the convergence sweep confirms it. This means your first webhook carries `status: "provisional"`.

**Do not clear invoices or release credit holds on `provisional` events.** Wait for `confirmed`.

```js
async function handlePayment(event) {
  const { status, transactionRef, accountRef, amount } = event

  // Always record the event
  await recordEvent(event)

  if (status === 'provisional') {
    // Mark as pending — display "awaiting confirmation" in your UI
    await db.query(
      'UPDATE payment_events SET status = $1 WHERE transaction_ref = $2',
      ['pending', transactionRef]
    )
    return
  }

  if (status === 'confirmed') {
    // Funds are real — clear the invoice
    await db.query(
      'UPDATE payment_events SET status = $1 WHERE transaction_ref = $2',
      ['confirmed', transactionRef]
    )
    await clearInvoice(accountRef, parseFloat(amount))
    return
  }

  if (status === 'reversed') {
    // Kanall did not confirm the payment — mark the event as reversed
    await db.query(
      'UPDATE payment_events SET status = $1 WHERE transaction_ref = $2',
      ['reversed', transactionRef]
    )
  }
}
```

## Retry behaviour

If your endpoint returns non-2XX, Kanall retries with exponential backoff:

| Attempt | Delay |
|---|---|
| 2nd | 2 minutes |
| 3rd | 5 minutes |
| 4th | 11 minutes |
| 5th | 24 minutes |
| 6th | 53 minutes |

After 6 total attempts, the delivery is marked dead letter. Check `GET /v1/webhooks/dead-letters` and reconcile missed events via the statement API.

**Always respond `200 OK` first**, then process. A slow database query should never cause a missed delivery.

## Test locally with ngrok

```bash
ngrok http 3000
# Forwarding: https://abc123.ngrok.io -> localhost:3000
```

Update your retailer's `callbackUrl` to the ngrok URL:

```bash
curl -X PATCH https://api.kanall.dev/v1/accounts/retailer-00142 \
  -H "X-API-Key: $KANALL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "callbackUrl": "https://abc123.ngrok.io/webhooks/payment" }'
```

---

**Next:** [Reconcile and report →](./04-reconcile)
