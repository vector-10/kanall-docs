---
id: ledger
title: The Ledger
sidebar_label: The Ledger
---

# The Ledger

Kanall's ledger is a true double-entry accounting system. Every payment creates two entries that cancel each other out. The ledger is append-only: nothing is ever updated or deleted.

## Double-entry

Every inbound payment posts exactly **two** `ledger_entries` rows sharing a `transaction_group_id`:

| Side | `account_type` | `account_id` | `direction` | Amount |
|---|---|---|---|---|
| Credit | `virtual_account` | virtual_account.id | `credit` | +₦5,000 |
| Debit | `tenant_settlement` | tenants.id | `debit` | −₦5,000 |

The sum of all entries for any `transaction_group_id` is always **zero**. This is the fundamental invariant — it makes the ledger self-auditing. If the sum is not zero, something has gone wrong at the write layer.

## Amounts

All amounts in the ledger are stored as `DECIMAL(20, 8)` — never `float64`. Floating-point arithmetic is not safe for money. Kanall uses the `shopspring/decimal` library throughout; every amount that crosses a system boundary is validated as a decimal string before storage.

The API surfaces amounts as decimal strings in naira:

```json
"Amount": "5000.00",
"Fee":    "0.60"
```

## Entry status

Each entry moves through a status lifecycle:

| Status | Meaning |
|---|---|
| `provisional` | Payment received via webhook — recorded but not yet confirmed by Nomba's Transactions API |
| `confirmed` | Convergence sweep verified this transaction against Nomba's canonical record |
| `reversed` | Nomba did not confirm the transaction, or a reversal event was received — a new reversal entry group has been posted |

**Do not treat `provisional` as settled.** A `provisional` entry means Nomba told us a payment happened via webhook. The convergence sweep will verify it against Nomba's Transactions API and either promote it to `confirmed` or post a reversal.

## The convergence sweep

Webhooks are hints. They can duplicate, arrive late, or arrive before Nomba's own records are consistent. The convergence sweep is a background goroutine that runs on a configurable interval and re-queries Nomba's Transactions API to find the truth.

```
Webhook arrives
      │
      ▼
Record as "provisional"
      │
      ▼
Convergence sweep queries Nomba Transactions API
      │
      ├──► Nomba confirms transaction ──► promote to "confirmed"
      │
      └──► Nomba does not confirm ──► post reversal entry group
```

This design means your downstream logic should:
- Show `provisional` entries as pending in your UI
- Only act on financial consequences once an entry is `confirmed`
- Accept that reversals can happen and handle them

## Reversals

When a transaction cannot be confirmed, or Nomba issues a reversal, Kanall posts a **new entry group** — it never mutates the original entries. The reversal group has a `reverses_group_id` pointing at the group it corrects.

Reversal entries carry the same amounts but inverted directions, so the net effect on the ledger is zero. The original entries remain readable with their original `provisional` or `confirmed` status, and the reversal group carries the `reversed` status.

## Reading the ledger

Use `GET /v1/accounts/:accountRef/statement` to read ledger entries for a virtual account. Each `StatementLine` contains:

- The raw `entry` (direction, amount, fee, status, narration, txn ref, timestamp)
- A `runningBalance` — the account balance at that point in time, computed by Kanall

The statement also returns aggregate totals across all confirmed entries: `openingBalance`, `totalCredits`, `totalDebits`, and `closingBalance`. These are computed server-side and are always consistent with the underlying entries.

See [Statement API](../api-reference/statement) for the full response shape.
