---
id: webhooks
title: Webhooks
sidebar_label: Webhooks
---

# Webhooks

Kanall connects to your backend with a single outbound notification: when a payment lands on any virtual account, Kanall delivers a signed event to your `callbackUrl`.

---

## Outbound: Kanall → your backend

If a virtual account has a `callbackUrl`, Kanall delivers a payment notification to that URL on every inbound payment.

**Payload shape:**

```json
{
  "eventType": "payment.received",
  "transactionGroupId": "9c4d1f3b-2e5a-4b7c-8d0e-1f2a3b4c5d6e",
  "accountRef": "bokku-ikeja",
  "amount": "4975.00",
  "gross_amount": "5000.00",
  "nomba_fee": "25.00",
  "currency": "NGN",
  "senderName": "Adebayo Foods Ltd",
  "narration": "Transfer from Adebayo Foods Ltd",
  "status": "provisional"
}
```

`amount` is the net naira amount credited to the balance — after Nomba's NIP fee is deducted. `gross_amount` is what the payer sent. `nomba_fee` is what Nomba kept. All three are decimal strings.

`status` is always `"provisional"` at delivery time. Kanall's confirmation pipeline verifies the payment against Nomba's records shortly after, usually within seconds.

---

## Retry behaviour

Kanall retries failed outbound webhook deliveries with exponential backoff:

| Attempt | Delay after previous failure |
|---|---|
| 1 (initial) | Immediate |
| 2 | 2 minutes |
| 3 | 5 minutes |
| 4 | 11 minutes |
| 5 | 24 minutes |

After 5 failed attempts, the delivery is marked `dead_letter`. Dead letters are surfaced via `GET /v1/webhooks/dead-letters`.

Any non-2XX response from your endpoint is treated as a failure. **Return `200 OK` as fast as possible** — defer processing to a queue or background job on your side.

---

## Dead letters

A dead letter is an outbound webhook delivery that exhausted all retries. It is not retried further. You should:

1. Inspect the `LastError` field to understand why delivery failed
2. Ensure your endpoint is reachable and returns 2XX
3. Manually reconcile the event using the statement API if needed

See [Webhooks API](../api-reference/webhooks) for the dead letter endpoint.

---

## Signature verification

Kanall signs every outbound delivery so you can confirm the notification came from Kanall and not a third party. See [Webhook Signature Verification](../guides/webhook-verification) for the full algorithm and implementation examples.
