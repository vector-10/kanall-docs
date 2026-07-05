---
id: webhooks
title: Webhooks
sidebar_label: Webhooks
---

# Webhooks

Webhooks connect Kanall to two external systems: **Nomba sends payment events inbound to Kanall**, and **Kanall forwards payment events outbound to your backend**.

## Inbound: Nomba → Kanall

When a customer makes a transfer to a virtual account NUBAN, Nomba fires a signed HTTP POST to Kanall's webhook endpoint. Kanall:

1. Reads the `nomba-signature` header
2. Verifies the HMAC-SHA256 signature (see [Signature verification](#signature-verification))
3. Checks the idempotency gate — if this `requestId` was already processed, returns `200 OK` immediately
4. Writes a `provisional` ledger entry pair in the same database transaction as the idempotency record
5. Queues an outbound webhook delivery to your `callbackUrl`

Kanall always returns `200 OK` to Nomba quickly. Heavy work (convergence, downstream delivery) happens asynchronously.

## Outbound: Kanall → your backend

If a virtual account has a `callbackUrl`, Kanall delivers a payment notification to that URL on every inbound payment.

**Payload shape:**

```json
{
  "eventType": "payment.received",
  "transactionGroupId": "9c4d1f3b-2e5a-4b7c-8d0e-1f2a3b4c5d6e",
  "accountRef": "driver-001",
  "amount": "4975.00",
  "gross_amount": "5000.00",
  "nomba_fee": "25.00",
  "currency": "NGN",
  "senderName": "Chidi Emmanuel",
  "narration": "Transfer from Chidi Emmanuel",
  "status": "provisional"
}
```

`amount` is the net naira amount credited to the balance — after Nomba's NIP fee is deducted. `gross_amount` is what the payer sent. `nomba_fee` is what Nomba kept. All three are decimal strings.

`status` is always `"provisional"` at delivery time. Kanall's confirmation pipeline will verify the payment against Nomba's records shortly after, usually within seconds. Until that happens, treat the payment as pending in your UI.

## Retry behaviour

Kanall retries failed outbound webhook deliveries with exponential backoff:

| Attempt | Delay after previous failure |
|---|---|
| 1 (initial) | Immediate |
| 2 | 2 minutes |
| 3 | 5 minutes |
| 4 | 11 minutes |
| 5 | 24 minutes |
| 6 | 53 minutes |

After 5 retry attempts (6 total), the delivery is marked `dead_letter`. Dead letters are surfaced via `GET /v1/webhooks/dead-letters`.

Any non-2XX response from your endpoint is treated as a failure. **Return `200 OK` as fast as possible** — defer processing to a queue or background job on your side.

## Dead letters

A dead letter is an outbound webhook delivery that exhausted all retries. It is not retried further. You should:

1. Inspect the `LastError` field to understand why delivery failed
2. Ensure your endpoint is reachable and returns 2XX
3. Manually reconcile the event using the statement API if needed

See [Webhooks API](../api-reference/webhooks) for the dead letter endpoint.

## Signature verification

Nomba signs every inbound webhook. Kanall verifies the signature before processing any event. If the signature is invalid, Kanall records the event as a `dead_letter` internally (never retried) and returns `200 OK` to Nomba to prevent re-delivery loops.

**How Nomba signs:**

The signed string is **not** the raw request body. It is a colon-separated string constructed from the parsed JSON payload:

```
{event_type}:{requestId}:{data.merchant.userId}:{data.merchant.walletId}:{data.transaction.transactionId}:{data.transaction.type}:{data.transaction.time}:{data.transaction.responseCode}:{nomba-timestamp header}
```

- If `responseCode` is the string `"null"`, normalize it to `""` before hashing
- The signing algorithm is HMAC-SHA256
- The output is **base64-encoded** (not hex)
- Compare case-insensitively against the `nomba-signature` header

**Headers sent by Nomba:**

```
nomba-signature: <base64 hmac>
nomba-sig-value: <same value, duplicate>
nomba-signature-algorithm: HmacSHA256
nomba-signature-version: 1.0.0
nomba-timestamp: <unix timestamp>
```

The signing secret is configured via the `NOMBA_WEBHOOK_SIGNING_SECRET` environment variable and is never stored in source code.
