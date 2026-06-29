---
id: idempotency
title: Idempotency
sidebar_label: Idempotency
---

# Idempotency

Kanall's idempotency design ensures that processing a payment event more than once — due to webhook retries, network failures, or replay — produces exactly the same outcome as processing it once.

## Why it matters

Nomba retries webhook delivery if your endpoint returns a non-2XX response, or if Nomba's own delivery infrastructure experiences a transient failure. This means the same payment event can arrive at Kanall multiple times. Without an idempotency gate, you would record double ledger entries, deliver duplicate webhooks to your endpoint, and end up with a ledger that reports twice the actual amount received.

## The idempotency gate

Kanall uses the `processed_events` table as its idempotency gate. The table has a single primary key: `nomba_txn_ref` — the Nomba `requestId` from the webhook payload.

**The critical rule:** the idempotency `INSERT` happens **in the same database transaction** as the ledger write. Not before it. Not after it. In the same transaction.

```sql
BEGIN;

-- Idempotency gate
INSERT INTO processed_events (nomba_txn_ref, processed_at)
VALUES ($1, now())
ON CONFLICT DO NOTHING;

-- If 0 rows were inserted, the event was already processed
-- The handler returns 200 OK immediately without re-posting entries

-- Ledger writes (only if idempotency INSERT succeeded)
INSERT INTO ledger_entries (...) VALUES (...);  -- credit
INSERT INTO ledger_entries (...) VALUES (...);  -- debit

COMMIT;
```

If the idempotency `INSERT` returns zero rows affected (the `ON CONFLICT DO NOTHING` path), the ledger writes are skipped and the handler returns `200 OK` to Nomba immediately. The response to Nomba is always `200 OK` — regardless of whether the event was new or duplicate — because re-delivery of a duplicate is not an error.

## Idempotency keys by flow

| Flow | Idempotency key | Reason |
|---|---|---|
| Inbound VA payment (webhook) | `requestId` | Nomba's webhook delivery ID — stable across Nomba's own retries |
| Outbound transfer (not yet supported) | `merchantTxRef` | Your own reference supplied at transfer initiation |

These are distinct flows with distinct keys. Confusing them would cause either missed deduplication or phantom idempotency collisions.

## What `requestId` is

`requestId` is Nomba's webhook delivery ID — it identifies a specific delivery attempt of an event, not the underlying transaction. Nomba keeps this ID stable across its own retries of the same event, which is exactly what Kanall needs: the same payment should only enter the ledger once, regardless of how many times Nomba attempts delivery.

The underlying transaction ID (`data.transaction.transactionId`) is stored separately on the ledger entry as `NombaTxnRef` for reference and querying, but is not used as the idempotency key.

## Replay safety

Because the idempotency gate is in the same transaction as the ledger write, there is no window between the two. If the database transaction fails or rolls back, neither the idempotency record nor the ledger entries are committed — the next delivery of the same event is treated as new. This is correct behaviour: partial writes leave no trace.

You can safely replay any webhook at any time. Kanall will process it once and return `200 OK` on all subsequent deliveries.
