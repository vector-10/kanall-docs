---
id: statement
title: Statement API
sidebar_label: Statement
---

# Statement API

## Get account statement

```
GET /v1/accounts/:accountRef/statement
GET /v1/accounts/:accountRef/statement?after={cursor}
```

Returns a paginated ledger statement for a virtual account, including aggregate totals and a running balance on each entry.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `after` | string | Cursor for the next page |

```bash
curl https://api.kanall.dev/v1/accounts/driver-001/statement \
  -H "X-API-Key: ten_sk_..."
```

---

## Response

```json
{
  "virtualAccount": {
    "ID": "7f3b9e2a-...",
    "AccountRef": "driver-001",
    "BankAccountNumber": "0123456789",
    "Status": "active",
    "Currency": "NGN",
    "..."  : "..."
  },
  "lines": [
    {
      "entry": {
        "ID": "a1b2c3d4-...",
        "Direction": "credit",
        "Amount": "5000.00",
        "Fee": "0.60",
        "Currency": "NGN",
        "Status": "confirmed",
        "Narration": "Transfer from Chidi Emmanuel",
        "NombaTxnRef": "nom_txn_abc123",
        "CreatedAt": "2026-07-01T11:00:00Z"
      },
      "runningBalance": "5000.00"
    },
    {
      "entry": {
        "ID": "b2c3d4e5-...",
        "Direction": "credit",
        "Amount": "3000.00",
        "Fee": "0.60",
        "Currency": "NGN",
        "Status": "provisional",
        "Narration": "Transfer from Aisha Bello",
        "NombaTxnRef": "nom_txn_def456",
        "CreatedAt": "2026-07-01T14:30:00Z"
      },
      "runningBalance": "8000.00"
    }
  ],
  "openingBalance": "0.00",
  "totalCredits": "8000.00",
  "totalDebits": "0.00",
  "closingBalance": "8000.00",
  "pagination": {
    "limit": 50,
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

## Response fields

### Aggregates

Aggregate totals are computed across **all entries** for this account (not just the current page):

| Field | Description |
|---|---|
| `openingBalance` | Balance before the first entry in the statement period |
| `totalCredits` | Sum of all credit entries |
| `totalDebits` | Sum of all debit entries |
| `closingBalance` | Current balance (`openingBalance + totalCredits - totalDebits`) |

### Statement line

Each `lines` entry contains:

| Field | Description |
|---|---|
| `entry.Direction` | `credit` — funds received. `debit` — settlement movement. |
| `entry.Amount` | Amount in naira (decimal string) |
| `entry.Fee` | Nomba's transaction fee in naira (decimal string) |
| `entry.Status` | `provisional`, `confirmed`, or `reversed` — see [The Ledger](../concepts/ledger) |
| `entry.Narration` | Payment narration from the sender |
| `entry.NombaTxnRef` | Nomba's transaction ID — use this to correlate with Nomba's own records |
| `runningBalance` | Account balance after this entry was posted |

---

## Status meaning for reconciliation

| Status | What it means for your system |
|---|---|
| `provisional` | Payment received via webhook — do not treat as settled funds yet |
| `confirmed` | Verified against Nomba's Transactions API — safe to act on |
| `reversed` | Transaction was not confirmed by Nomba — a reversal entry has been posted. The original entry remains visible. |

Filter for `confirmed` entries when computing settled balances:

```bash
# There is no filter param — filter client-side on Status === 'confirmed'
# or wait for the convergence sweep to confirm before acting
```

---

## Pagination

Statement lines are returned oldest-first. Use cursor pagination to advance through large histories:

```bash
# Second page
GET /v1/accounts/driver-001/statement?after=a1b2c3d4-...
```

The aggregate totals (`totalCredits`, `closingBalance`, etc.) always reflect the full history — not just the current page.
