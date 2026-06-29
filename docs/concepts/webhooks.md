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
  "event": "payment_received",
  "accountRef": "driver-001",
  "tenantId": "550e8400-...",
  "transactionRef": "nom_txn_abc123",
  "amount": "5000.00",
  "fee": "0.60",
  "currency": "NGN",
  "narration": "Transfer from Chidi Emmanuel",
  "senderName": "Chidi Emmanuel",
  "senderBank": "Access Bank",
  "senderAccount": "0987654321",
  "status": "provisional",
  "timestamp": "2026-07-01T11:00:00Z"
}
```

`amount` is in naira. `status` reflects the ledger status at the time of delivery — typically `provisional`. Your system should handle subsequent `confirmed` or `reversed` events from the convergence sweep.

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
