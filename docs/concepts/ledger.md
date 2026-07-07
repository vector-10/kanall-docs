---
id: ledger
title: The Ledger
sidebar_label: The Ledger
---

# The Ledger

The ledger is why your balance is never a guess. Every naira that flows through a virtual account is recorded in two entries that cancel each other out — and once written, neither entry can be changed. No updates. No deletes. If something needs to be corrected, a new reversal entry pair is posted instead.

This means the ledger is always self-auditing: the sum of all entries for any payment group is always zero, and every past state is fully reconstructable.

---

## Double-entry

Every inbound payment posts exactly **two** ledger rows sharing a `transaction_group_id`.

Say a supplier sends ₦5,025 to Bokku's Ikeja branch NUBAN. Nomba deducts a ₦25 NIP fee, so ₦5,000 actually lands. Kanall records the net amount (₦5,000) — the fee is stored separately for reporting but never counted in the balance:

| Side | Account type | Direction | Amount | Fee |
|---|---|---|---|---|
| Credit | `virtual_account` (Ikeja branch) | `credit` | +₦5,000 | ₦25 |
| Debit | `tenant_settlement` (Bokku Supermarket) | `debit` | −₦5,000 | ₦25 |

The sum of all `amount` values for any `transaction_group_id` is always **zero**. The `fee` column is informational — it tells you what Nomba charged but does not affect the balance.

---

## Amounts

All amounts are decimal numbers, never floating-point. The API surfaces them as decimal strings in naira:

```json
"Amount": "5000.00",
"Fee":    "25.00"
```

Never parse these as floats. Use a decimal library.

---

## Entry status

Each entry has a `status` that reflects where it is in the confirmation process:

| Status | What it means for you |
|---|---|
| `provisional` | Payment received and recorded — not yet independently verified with Nomba |
| `confirmed` | Verified against Nomba's own transaction records. Safe to act on. |
| `reversed` | A reversal has been posted. Balance restored. |
| `needs_review` | Unresolvable after 24 hours — flagged for manual review. Excluded from balance. |

**`provisional` is included in your balance.** Kanall's confirmation pipeline typically promotes entries within seconds, so provisional entries are reliable enough to show in your UI and to settle against. Only `needs_review` and `reversed` entries are excluded from the balance.

Do not block your UI on waiting for `confirmed` — treat provisional as "almost certainly real" and let the confirmation pipeline do its work silently.

---

## How confirmation works

When a payment arrives, Kanall immediately tries to verify it with Nomba's single-transaction endpoint. This resolves most payments within seconds (Layer 1). A background sweep catches anything the fast path missed by querying Nomba's bulk transactions API on a regular interval (Layer 2). If an entry is still unconfirmed after 24 hours, it moves to `needs_review` — a human operator should investigate.

No automatic reversals happen anywhere in this pipeline. Reversals only occur if Nomba explicitly reports that a transaction was reversed.

---

## Reversals

When Nomba issues a reversal, Kanall posts a **new entry group** — it never mutates the original entries. The reversal group carries the same amounts with inverted directions, and references the group it corrects via `reverses_group_id`. The original entries remain fully readable.

---

## Reading the ledger

Use `GET /v1/accounts/:accountRef/statement` to read ledger entries for an account. Each line contains the raw entry and a `runningBalance` — the account balance at that point in time.

The statement also returns aggregate totals: `openingBalance`, `totalCredits`, `totalDebits`, and `closingBalance`. These are computed server-side and always consistent with the underlying entries.

See [Statement API](../api-reference/statement) for the full response shape.
