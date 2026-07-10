---
id: 03-receive-payments
title: "Step 3: Receive Payment Webhooks"
sidebar_label: "3. Receive Payments"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Step 3: Receive Payment Webhooks

When Emeka transfers to his NUBAN, Kanall fires a `POST` to your webhook URL within seconds. Your job: verify the signature, respond `200 OK` immediately, then process asynchronously.

---

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

| Field | Description |
|---|---|
| `accountRef` | Your `externalRef` — use this to look up the distributor in your database |
| `amount` | Net naira credited to the balance (after Nomba's NIP fee) |
| `gross_amount` | What Emeka actually sent |
| `nomba_fee` | What Nomba deducted — informational only |
| `transactionGroupId` | Kanall's internal group ID — use this for idempotency and statement lookups |
| `status` | Always `"provisional"` on first delivery — see below |

---

## Verify the signature

Every delivery from Kanall includes an `X-Kanall-Signature: t={timestamp},v1={hmac_hex}` header. Before processing any event, verify it using HMAC-SHA256 against your `KANALL_WEBHOOK_SECRET` (retrieve it once with `POST /auth/webhook-secret`).

For the complete verification function in all languages, see the [Webhook Signature Verification guide](../guides/webhook-verification). The handlers below show it wired in directly.

---

## Webhook handler

Acknowledge Kanall immediately with `200 OK`, then process asynchronously. If your endpoint is slow or returns non-2XX, Kanall retries with exponential backoff — so never make the webhook wait on a database write.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
// routes/webhooks.js — Express
const express = require('express')
const router  = express.Router()
const { verifyKanallSignature } = require('../verify-signature')

const WEBHOOK_SECRET = process.env.KANALL_WEBHOOK_SECRET

router.post('/kanall', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['x-kanall-signature']

  if (!sig || !verifyKanallSignature(req.body, sig, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'invalid signature' })
  }

  // Acknowledge immediately — never block on DB writes here
  res.status(200).json({ received: true })

  // Parse and enqueue for async processing
  const event = JSON.parse(req.body)
  queue.add('handle-payment', event)
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

  const distributor = await db.query(
    'SELECT id FROM distributors WHERE kanall_ref = $1',
    [accountRef]
  )
  if (!distributor.rows.length) {
    console.error(`Unknown accountRef: ${accountRef}`)
    return
  }

  await db.query(
    `INSERT INTO payment_events (group_id, distributor_id, amount, status, received_at)
     VALUES ($1, $2, $3, $4, now())`,
    [transactionGroupId, distributor.rows[0].id, amount, status]
  )
}
```

</TabItem>
<TabItem value="python" label="Python">

```python
# views.py — Django
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json, os
from verify_signature import verify_kanall_signature

WEBHOOK_SECRET = os.environ['KANALL_WEBHOOK_SECRET']

@csrf_exempt
def kanall_webhook(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    # request.body gives raw bytes — must use this before any JSON parsing
    sig = request.headers.get('X-Kanall-Signature', '')

    if not verify_kanall_signature(request.body, sig, WEBHOOK_SECRET):
        return JsonResponse({'error': 'invalid signature'}, status=401)

    # Acknowledge immediately
    event = json.loads(request.body)
    enqueue('handle_payment', event)

    return JsonResponse({'received': True})


def handle_payment(event):
    account_ref  = event['accountRef']
    group_id     = event['transactionGroupId']
    amount       = event['amount']
    status       = event['status']

    # Idempotency check
    if db.execute('SELECT id FROM payment_events WHERE group_id = %s', (group_id,)).fetchone():
        return

    distributor = db.execute(
        'SELECT id FROM distributors WHERE kanall_ref = %s', (account_ref,)
    ).fetchone()
    if not distributor:
        print(f'Unknown accountRef: {account_ref}')
        return

    db.execute(
        'INSERT INTO payment_events (group_id, distributor_id, amount, status, received_at) '
        'VALUES (%s, %s, %s, %s, now())',
        (group_id, distributor['id'], amount, status)
    )
```

</TabItem>
<TabItem value="go" label="Go">

```go
// handler/webhook.go
package handler

import (
    "encoding/json"
    "io"
    "net/http"
    "os"

    "github.com/yourorg/starline/webhook"
)

var webhookSecret = os.Getenv("KANALL_WEBHOOK_SECRET")

type PaymentEvent struct {
    EventType          string `json:"eventType"`
    TransactionGroupID string `json:"transactionGroupId"`
    AccountRef         string `json:"accountRef"`
    Amount             string `json:"amount"`
    GrossAmount        string `json:"gross_amount"`
    NombaFee           string `json:"nomba_fee"`
    Currency           string `json:"currency"`
    SenderName         string `json:"senderName"`
    Status             string `json:"status"`
}

func HandleKanallWebhook(w http.ResponseWriter, r *http.Request) {
    rawBody, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "bad request", http.StatusBadRequest)
        return
    }

    sig := r.Header.Get("X-Kanall-Signature")
    if !webhook.VerifySignature(rawBody, sig, webhookSecret) {
        http.Error(w, "invalid signature", http.StatusUnauthorized)
        return
    }

    // Acknowledge immediately
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"received":true}`))

    // Process asynchronously
    var event PaymentEvent
    if err := json.Unmarshal(rawBody, &event); err != nil {
        return
    }
    go handlePayment(event)
}

func handlePayment(event PaymentEvent) {
    // Check idempotency, look up distributor, record event
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
// WebhookController.java — Spring Boot
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;

@RestController
public class WebhookController {

    private final String secret = System.getenv("KANALL_WEBHOOK_SECRET");

    // @RequestBody byte[] gives us the raw body before Spring parses it
    @PostMapping("/webhooks/kanall")
    public ResponseEntity<String> handleWebhook(
            @RequestBody byte[] rawBody,
            @RequestHeader("X-Kanall-Signature") String sig) {
        try {
            String body = new String(rawBody, "UTF-8");

            if (!SignatureVerifier.verify(body, sig, secret)) {
                return ResponseEntity.status(401)
                    .body("{\"error\":\"invalid signature\"}");
            }

            // Process asynchronously
            // executor.submit(() -> handlePayment(body));

            return ResponseEntity.ok("{\"received\":true}");
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
}
```

</TabItem>
</Tabs>

:::warning Use raw body for signature verification
Parse the JSON body **after** verifying the signature. Many frameworks buffer and re-encode the body before it reaches your handler, which changes whitespace and breaks the HMAC. Use `express.raw()` in Express, `request.body` in Django, or `@RequestBody byte[]` in Spring Boot — before any JSON parsing middleware touches the body.
:::

---

## Handling provisional vs confirmed

`status` is always `"provisional"` at first delivery. Kanall has received the webhook from Nomba but the confirmation pipeline has not yet verified the payment against Nomba's transaction ledger. This typically resolves within a few seconds.

**Do not clear invoices or release credit holds on `provisional` events.**

When the payment is confirmed, Kanall does not send a second webhook. Instead, either:
- Query `GET /v1/accounts/:accountRef/statement` a few seconds later and check whether the entry moved to `confirmed`
- Or design your system to act on `provisional` and reconcile against the statement at end-of-day (covered in [Step 4](./04-reconcile))

---

## Retry behaviour

If your endpoint returns non-2XX, Kanall retries with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 (initial) | Immediate |
| 2 | 2 minutes |
| 3 | 5 minutes |
| 4 | 11 minutes |
| 5 | 24 minutes |
| 6 | 53 minutes |

After 6 total attempts, the delivery is marked `dead_letter`. Check `GET /v1/webhooks/dead-letters` and reconcile any missed events against the statement API.

---

## Test locally with ngrok

```bash
ngrok http 3000
# Forwarding: https://abc123.ngrok.io -> localhost:3000
```

Update your tenant webhook URL to the ngrok tunnel:

```bash
curl -X POST https://kanall.onrender.com/auth/webhook-url \
  -H "X-API-Key: $KANALL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://abc123.ngrok.io/webhooks/kanall"}'
```

Or override a single account's URL without changing the tenant default:

```bash
curl -X PATCH https://kanall.onrender.com/v1/accounts/distributor-emeka \
  -H "X-API-Key: $KANALL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"callbackUrl": "https://abc123.ngrok.io/webhooks/kanall"}'
```

---

## Common errors

| Problem | Cause | Fix |
|---|---|---|
| Signature fails after HMAC looks correct | Framework re-encoded the JSON body | Capture the raw byte stream before JSON parsing |
| Signature fails on replay | Timestamp more than 5 minutes old | Ensure your server clock is synced (NTP) |
| `401` on webhook endpoint | No signature or wrong secret | Confirm `KANALL_WEBHOOK_SECRET` matches the value from `POST /auth/webhook-secret` |
| Duplicate events processed | No idempotency check | Always check `transactionGroupId` before inserting |

---

**Next:** [Reconcile and report →](./04-reconcile)
