---
id: 03-receive-payments
title: "Step 3: Receive Payment Webhooks"
sidebar_label: "3. Receive Payments"
---

# Step 3: Receive Payment Webhooks

When Emeka transfers to his NUBAN, Kanall fires a `POST` to your `callbackUrl` within seconds. Your job: respond `200 OK` fast, then process asynchronously.

## Webhook payload

```json
{
  "eventType": "payment.received",
  "transactionGroupId": "9c4d1f3b-2e5a-4b7c-8d0e-1f2a3b4c5d6e",
  "accountRef": "distributor-emeka",
  "amount": "45000.00",
  "gross_amount": "45050.00",
  "nomba_fee": "50.00",
  "currency": "NGN",
  "senderName": "Emeka Okafor",
  "narration": "Transfer from Emeka Okafor",
  "status": "provisional"
}
```

Key fields:

| Field | Description |
|---|---|
| `accountRef` | Your `externalRef` — use this to look up the distributor in your database |
| `amount` | Net naira credited to the balance (after Nomba's NIP fee) |
| `gross_amount` | What Emeka actually sent |
| `nomba_fee` | What Nomba deducted — informational only |
| `transactionGroupId` | Kanall's internal group ID — use this for idempotency and statement lookups |
| `status` | Always `"provisional"` on first delivery — see below |

## Webhook handler (Express)

```js
// routes/webhooks.js
const express = require('express')
const router = express.Router()
const queue = require('../queue')  // your async job queue

router.post('/payment', express.json(), async (req, res) => {
  // Acknowledge Kanall immediately — never make the webhook wait on DB writes
  res.status(200).json({ received: true })

  // Enqueue for async processing
  queue.add('handle-payment', req.body)
})

module.exports = router
```

```js
// workers/handle-payment.js
async function handlePayment(event) {
  const { accountRef, transactionGroupId, amount, status } = event

  // Idempotency — skip if already processed
  const existing = await db.query(
    'SELECT id FROM payment_events WHERE group_id = $1',
    [transactionGroupId]
  )
  if (existing.rows.length > 0) return

  // Find the distributor
  const distributor = await db.query(
    'SELECT id, name FROM distributors WHERE kanall_ref = $1',
    [accountRef]
  )
  if (!distributor.rows.length) {
    console.error(`Unknown accountRef: ${accountRef}`)
    return
  }

  const distributorId = distributor.rows[0].id

  // Record the event
  await db.query(
    `INSERT INTO payment_events (group_id, distributor_id, amount, status, received_at)
     VALUES ($1, $2, $3, $4, now())`,
    [transactionGroupId, distributorId, amount, status]
  )

  // Do not clear invoices on provisional — wait for confirmed
}
```

## Handling provisional vs confirmed

`status` is always `"provisional"` at first delivery — Kanall has received the webhook from Nomba but the confirmation pipeline hasn't verified the payment against Nomba's transaction ledger yet. This usually resolves within seconds.

**Do not clear invoices or release credit holds on `provisional` events.**

When the payment is confirmed, Kanall does not send a second webhook. Instead, query the statement if you need to verify the status of a specific entry, or design your system to act on `provisional` and reconcile against the statement at end-of-day.

```js
async function handlePayment(event) {
  const { status, transactionGroupId, accountRef, amount } = event

  // Always record the event for your own audit trail
  await recordEvent(event)

  if (status === 'provisional') {
    // Display "awaiting confirmation" in your UI — don't clear the invoice yet
    await db.query(
      'UPDATE payment_events SET status = $1 WHERE group_id = $2',
      ['pending_confirmation', transactionGroupId]
    )
    return
  }
}
```

For real-time invoice clearing, query `GET /v1/accounts/:accountRef/statement` a few seconds after the provisional webhook and check whether the entry has moved to `confirmed`.

## Retry behaviour

If your endpoint returns non-2XX, Kanall retries with exponential backoff:

| Attempt | Delay after previous failure |
|---|---|
| 1 (initial) | Immediate |
| 2 | 2 minutes |
| 3 | 5 minutes |
| 4 | 11 minutes |
| 5 | 24 minutes |
| 6 | 53 minutes |

After 6 total attempts, the delivery is marked `dead_letter`. Check `GET /v1/webhooks/dead-letters` and reconcile missed events via the statement API.

**Always respond `200 OK` first**, then process. A slow database query should never cause a missed delivery.

## Test locally with ngrok

```bash
ngrok http 3000
# Forwarding: https://abc123.ngrok.io -> localhost:3000
```

Update Emeka's `callbackUrl` to the ngrok tunnel:

```bash
curl -X PATCH https://kanall.onrender.com/v1/accounts/distributor-emeka \
  -H "X-API-Key: $KANALL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "callbackUrl": "https://abc123.ngrok.io/webhooks/payment" }'
```

---

**Next:** [Reconcile and report →](./04-reconcile)
