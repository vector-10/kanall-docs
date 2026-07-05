---
id: ledger
title: The Ledger
sidebar_label: The Ledger
---

# The Ledger

Kanall's ledger is a true double-entry accounting system. Every payment creates two entries that cancel each other out. The ledger is append-only: nothing is ever updated or deleted.

## Double-entry

Every inbound payment posts exactly **two** `ledger_entries` rows sharing a `transaction_group_id`.

Say a payer sends ₦5,025 to a virtual account. Nomba deducts a ₦25 NIP fee, so ₦5,000 actually lands. Kanall records the net amount (₦5,000) — the fee is stored separately in the `fee` column for reporting, but never counted in the balance:

| Side | `account_type` | `account_id` | `direction` | `amount` | `fee` |
|---|---|---|---|---|---|
| Credit | `virtual_account` | virtual_account.id | `credit` | +₦5,000 | ₦25 |
| Debit | `tenant_settlement` | tenants.id | `debit` | −₦5,000 | ₦25 |

The sum of all `amount` values for any `transaction_group_id` is always **zero**. This is the fundamental invariant — it makes the ledger self-auditing.

The `fee` column is informational. It tells you what Nomba charged on the transaction but it does not affect your balance. Your balance is purely the sum of `amount` values across all non-reversed credit and debit entries.

## Amounts

All amounts in the ledger are stored as `DECIMAL(20, 8)` — never `float64`. Floating-point arithmetic is not safe for money. Kanall uses the `shopspring/decimal` library throughout; every amount that crosses a system boundary is validated as a decimal string before storage.

The API surfaces amounts as decimal strings in naira:

```json
"Amount": "5000.00",
"Fee":    "0.60"
```

## Entry status

Each entry has a status that shows where it is in the confirmation process:

| Status | Meaning |
|---|---|
| `provisional` | Payment received via webhook — recorded but not yet independently verified |
| `confirmed` | Verified against Nomba's own transaction records. Safe to act on. |
| `reversed` | A reversal entry group has been posted. Balance is restored. |
| `needs_review` | The payment could not be confirmed or denied after 24 hours. Flagged for operator review. |

**Do not treat `provisional` as final.** A `provisional` entry means Nomba told us a payment happened. The confirmation pipeline will verify it and promote it to `confirmed`. Until then, treat it as "pending."

## How confirmation works

Kanall uses three layers to confirm payments, from fastest to slowest:

**Layer 1 — Fast path (seconds)**

The moment Kanall posts a webhook payment as `provisional`, it queues a confirmation job and immediately queries Nomba's single-transaction endpoint to verify the transaction exists. If Nomba confirms it, the entry is promoted to `confirmed` within seconds.

**Layer 2 — Bulk sweep (minutes to hours)**

A background goroutine runs on a regular interval. It fetches all transactions from Nomba's bulk transactions API over a 7-day window and confirms any `provisional` entries it finds there. This catches anything the fast path missed — for example, if Nomba's single-transaction endpoint was temporarily unavailable.

**Layer 3 — Aged auditor (24+ hours)**

If a `provisional` entry is still unconfirmed after 2 hours, the sweep makes one more targeted attempt to fetch it from Nomba. If it still can't confirm it after 24 hours, the entry is flagged as `needs_review` — meaning a human operator should check what happened. Kanall never automatically reverses entries; it only flags them.

```
Webhook arrives
      │
      ▼
Record as "provisional" → Layer 1 confirms within seconds (most payments)
      │
      │ (if Layer 1 misses it)
      ▼
Layer 2 bulk sweep confirms within hours
      │
      │ (if still provisional after 2h)
      ▼
Layer 3 targeted requery
      │
      ├──► Confirmed → promote to "confirmed"
      │
      └──► Still unresolved after 24h → flag as "needs_review"
```

No automatic reversals happen anywhere in this pipeline. Reversals only occur if Nomba explicitly tells us a transaction was reversed.

## Reversals

When Nomba issues a reversal, Kanall posts a **new entry group** — it never mutates the original entries. The reversal group has a `reverses_group_id` pointing at the group it corrects.

Reversal entries carry the same amounts but inverted directions, so the net effect on the ledger stays at zero. The original entries remain readable, and the reversal group gets a `reversed` status.

## Reading the ledger

Use `GET /v1/accounts/:accountRef/statement` to read ledger entries for a virtual account. Each `StatementLine` contains:

- The raw `entry` (direction, amount, fee, status, narration, txn ref, timestamp)
- A `runningBalance` — the account balance at that point in time, computed by Kanall

The statement also returns aggregate totals across all confirmed entries: `openingBalance`, `totalCredits`, `totalDebits`, and `closingBalance`. These are computed server-side and are always consistent with the underlying entries.

See [Statement API](../api-reference/statement) for the full response shape.
