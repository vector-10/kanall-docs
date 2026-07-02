---
id: webhooks
title: Webhooks API
sidebar_label: Webhooks
---

# Webhooks API

Kanall has two webhook flows:

- **Inbound** — Nomba fires a webhook to Kanall on every payment. Kanall verifies, records, and fans out.
- **Outbound** — Kanall fires a signed webhook to your `callbackUrl` for each payment received on your accounts.

---

## Inbound webhook (Nomba → Kanall)

```
POST /webhooks/nomba
```

This endpoint is called by Nomba, not by your application. Do not call it directly.

When a payment arrives on any virtual account provisioned under your sub-account, Nomba delivers a signed webhook here. Kanall:

1. Verifies the HMAC-SHA256 signature
2. Checks idempotency (`requestId`)
3. Writes two ledger entries (credit + debit) in a single transaction
4. Queues outbound delivery to the account's `callbackUrl`

**Nomba webhook payload:**

```json
{
  "event_type": "vact_transfer",
  "requestId": "3f9a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "data": {
    "merchant": {
      "userId": "f666ef9b-888e-4799-85ce-acb505b28023",
      "walletId": "22f28de5-899a-49e8-ae05-f11d66250a74"
    },
    "transaction": {
      "transactionId": "nom_txn_abc123",
      "type": "vact_transfer",
      "time": "2026-07-01T11:00:00.000Z",
      "responseCode": "",
      "transactionAmount": 500000,
      "fee": 10.75,
      "currency": "NGN",
      "aliasAccountReference": "driver-001",
      "narration": "Transfer from Chidi Emmanuel"
    },
    "customer": {
      "senderName": "Chidi Emmanuel",
      "accountNumber": "0987654321",
      "bankName": "Access Bank"
    }
  }
}
```

:::note Amounts are in kobo
`transactionAmount: 500000` = ₦5,000.00. `fee: 10.75` is in naira (a float). Kanall converts to naira before storing in the ledger.
:::

**Key field mappings:**

| Nomba field | Kanall usage |
|---|---|
| `requestId` | Idempotency key — stored in `processed_events`. Stable across Nomba retries. |
| `data.transaction.transactionId` | `ledger_entries.NombaTxnRef` |
| `data.transaction.aliasAccountReference` | Used to look up `virtual_accounts.account_ref` |
| `data.transaction.transactionAmount` | `ledger_entries.Amount` (converted from kobo to naira) |
| `data.customer.senderName` | `ledger_entries.Narration` |

Kanall always returns `200 OK` to Nomba — including on signature failures and already-processed events — to prevent Nomba from retrying indefinitely.

---

## Inbound signature verification

Nomba signs each webhook request with HMAC-SHA256. Kanall verifies this automatically. The signed string is a 9-field colon-separated string — **not the raw request body**:

```
{event_type}:{requestId}:{merchant.userId}:{merchant.walletId}:{transaction.transactionId}:{transaction.type}:{transaction.time}:{transaction.responseCode}:{nomba-timestamp}
```

`responseCode == "null"` (the string) is normalised to `""` before signing.

Verification uses the `nomba-signature` and `nomba-timestamp` headers. The signing secret is set via the `NOMBA_WEBHOOK_SIGNING_SECRET` environment variable — never hardcoded.

---

## Event categories

Every inbound webhook event is classified into one of the following categories:

| Category | Description |
|---|---|
| `payment` | Signature valid, `aliasAccountReference` matched a known virtual account, ledger written |
| `misdirected` | Signature valid, but `aliasAccountReference` did not match any provisioned account |
| `sig_invalid` | Signature verification failed — event is not processed further |
| `non_payment_event` | Nomba fired a non-payment event type (e.g. terminal events) — ignored |
| `processing_error` | Signature was valid and account found, but ledger write failed |

You can query your own `payment` failures via `GET /v1/webhooks/dead-letters`. Misdirected events are visible from the dashboard — see [List misdirected payments](./authentication#list-misdirected-payments).

---

## Outbound webhook (Kanall → your server)

When a payment is received, Kanall delivers a webhook to the `callbackUrl` you registered for the account.

**Outbound payload:**

```json
{
  "event": "payment.received",
  "accountRef": "driver-001",
  "amount": "5000.00",
  "currency": "NGN",
  "narration": "Transfer from Chidi Emmanuel",
  "nombaTransactionId": "nom_txn_abc123",
  "receivedAt": "2026-07-01T11:00:00.000Z"
}
```

Kanall retries failed deliveries with exponential backoff across up to 5 attempts (2 min → 5 min → 11 min → 24 min → 53 min). Deliveries that exhaust all attempts become dead letters.

---

## Outbound signing

If you have configured a webhook signing secret via `POST /auth/webhook-secret`, Kanall signs every outbound delivery and includes the signature in the `X-Kanall-Signature` header:

```
X-Kanall-Signature: t=1751500000,v1=3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e
```

### Verifying the signature

The signed payload is `{timestamp}.{raw_body}`.

```python
import hmac, hashlib, time

def verify_kanall_signature(header: str, raw_body: bytes, secret: str) -> bool:
    parts = {k: v for k, v in (p.split("=", 1) for p in header.split(","))}
    timestamp = parts.get("t", "")
    signature = parts.get("v1", "")

    # Reject stale timestamps (±5 minutes)
    if abs(time.time() - int(timestamp)) > 300:
        return False

    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.".encode() + raw_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)
```

```typescript
import { createHmac, timingSafeEqual } from "crypto";

function verifyKanallSignature(
  header: string,
  rawBody: Buffer,
  secret: string,
): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const { t: timestamp, v1: signature } = parts;

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const payload = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

Accounts without a configured signing secret receive unsigned deliveries — the `X-Kanall-Signature` header is absent.

---

## Get dead letters

```
GET /v1/webhooks/dead-letters
```

Returns outbound webhook deliveries that exhausted all retry attempts and were permanently marked as failed.

```bash
curl https://api.kanall.dev/v1/webhooks/dead-letters \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "deadLetters": [
    {
      "ID": "d4e5f6a7-...",
      "CallbackURL": "https://app.naijadash.com/webhooks/payment",
      "Status": "dead_letter",
      "AttemptCount": 5,
      "LastError": "connection refused (dial tcp: connect: connection refused)",
      "NextRetryAt": null,
      "CreatedAt": "2026-07-01T11:00:00Z"
    }
  ]
}
```

| Field | Description |
|---|---|
| `CallbackURL` | The URL Kanall attempted to deliver to |
| `AttemptCount` | Total delivery attempts made (max 5) |
| `LastError` | The HTTP or network error from the last attempt |
| `NextRetryAt` | `null` for dead letters — no further retries will be attempted |
| `CreatedAt` | When the original payment event was received |

**Recovery:** Dead letters are informational. To recover missed events, query the statement for the affected virtual account using `GET /v1/accounts/:accountRef/statement` and replay the entries in your own system.
