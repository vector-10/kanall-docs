---
id: webhooks
title: Webhooks API
sidebar_label: Webhooks
---

# Webhooks API

## Inbound webhook (Nomba → Kanall)

```
POST /v1/webhooks/nomba
```

This endpoint is called by Nomba, not by your application. Do not call it directly.

Nomba fires this endpoint when a payment is received on any virtual account provisioned under your sub-account. Kanall verifies the signature, checks idempotency, writes the ledger, and queues delivery to your `callbackUrl`.

**Real Nomba webhook payload (`payment_success`):**

```json
{
  "event_type": "payment_success",
  "requestId": "3f9a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "data": {
    "merchant": {
      "walletId": "nom_wallet_...",
      "walletBalance": 539.40,
      "userId": "nom_user_..."
    },
    "terminal": {},
    "transaction": {
      "aliasAccountNumber": "0123456789",
      "aliasAccountName": "Emeka Okafor",
      "aliasAccountReference": "driver-001",
      "aliasAccountType": "VIRTUAL",
      "transactionId": "nom_txn_abc123",
      "transactionAmount": 500000,
      "fee": 60,
      "currency": "NGN",
      "narration": "Transfer from Chidi Emmanuel",
      "type": "vact_transfer",
      "time": "2026-07-01T11:00:00.000Z",
      "responseCode": "",
      "sessionId": "...",
      "originatingFrom": "api"
    },
    "customer": {
      "senderName": "Chidi Emmanuel",
      "bankName": "Access Bank",
      "bankCode": "044",
      "accountNumber": "0987654321"
    }
  }
}
```

:::note Amounts are in kobo
`transactionAmount: 500000` = ₦5,000.00. `fee: 60` = ₦0.60. Kanall converts to naira before storing in the ledger.
:::

**Key field mappings:**

| Nomba field | Kanall ledger field |
|---|---|
| `requestId` | Idempotency key (`processed_events.nomba_txn_ref`) |
| `data.transaction.transactionId` | `ledger_entries.NombaTxnRef` |
| `data.transaction.aliasAccountReference` | Used to look up `virtual_accounts.account_ref` |
| `data.transaction.transactionAmount` | `ledger_entries.Amount` (converted from kobo to naira) |
| `data.customer.senderName` | `ledger_entries.Narration` |

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

**Dead letter fields:**

| Field | Description |
|---|---|
| `CallbackURL` | The URL Kanall attempted to deliver to |
| `AttemptCount` | Total delivery attempts made (max 5) |
| `LastError` | The HTTP error or network error from the last attempt |
| `NextRetryAt` | `null` for dead letters — no further retries will be attempted |
| `CreatedAt` | When the original payment event was received |

**Recovery:** Dead letters are informational. To recover missed events, query the statement for the affected virtual account using `GET /v1/accounts/:accountRef/statement` and replay the entries in your own system.
