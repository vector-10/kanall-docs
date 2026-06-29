---
id: 04-reconcile
title: "Step 4: Reconcile and Report"
sidebar_label: "4. Reconcile"
---

# Step 4: Reconcile and Report

At the end of each day, PrimeLine's finance team needs to know: for each sales agent's route, how much was collected, from which retailers, and which invoices are cleared.

## Query a retailer's statement

```bash
curl https://api.kanall.dev/v1/accounts/retailer-00142/statement \
  -H "X-API-Key: $KANALL_API_KEY"
```

```json
{
  "virtualAccount": { "AccountRef": "retailer-00142", "Status": "active" },
  "lines": [
    {
      "entry": {
        "Direction": "credit",
        "Amount": "45000.00",
        "Fee": "0.60",
        "Status": "confirmed",
        "Narration": "Transfer from NGOZI OKONKWO",
        "NombaTxnRef": "nom_txn_abc123",
        "CreatedAt": "2026-07-01T11:00:00Z"
      },
      "runningBalance": "45000.00"
    },
    {
      "entry": {
        "Direction": "credit",
        "Amount": "18500.00",
        "Fee": "0.60",
        "Status": "provisional",
        "Narration": "Transfer from NGOZI OKONKWO",
        "NombaTxnRef": "nom_txn_def456",
        "CreatedAt": "2026-07-01T16:30:00Z"
      },
      "runningBalance": "63500.00"
    }
  ],
  "openingBalance": "0.00",
  "totalCredits": "63500.00",
  "totalDebits": "0.00",
  "closingBalance": "63500.00"
}
```

## Compute confirmed balance only

The `closingBalance` includes `provisional` entries. For financial reconciliation, compute only `confirmed` entries:

```js
// reconcile.js
const { kanallRequest } = require('./kanall')

async function getConfirmedBalance(accountRef) {
  const statement = await kanallRequest('GET', `/v1/accounts/${accountRef}/statement`)

  const confirmedCredits = statement.lines
    .filter(line => line.entry.Status === 'confirmed' && line.entry.Direction === 'credit')
    .reduce((sum, line) => sum + parseFloat(line.entry.Amount), 0)

  const confirmedDebits = statement.lines
    .filter(line => line.entry.Status === 'confirmed' && line.entry.Direction === 'debit')
    .reduce((sum, line) => sum + parseFloat(line.entry.Amount), 0)

  return {
    accountRef,
    confirmedBalance: confirmedCredits - confirmedDebits,
    pendingAmount: statement.lines
      .filter(line => line.entry.Status === 'provisional')
      .reduce((sum, line) => sum + parseFloat(line.entry.Amount), 0),
  }
}
```

## End-of-day route report

Generate a collection summary for each sales agent's assigned retailers:

```js
// eod-report.js
const { kanallRequest } = require('./kanall')

async function generateRouteReport(agentId) {
  // Fetch all retailers assigned to this agent
  const retailers = await db.query(
    'SELECT id, name, kanall_ref FROM retailers WHERE agent_id = $1',
    [agentId]
  )

  const report = []

  for (const retailer of retailers.rows) {
    if (!retailer.kanall_ref) continue

    const statement = await kanallRequest(
      'GET',
      `/v1/accounts/${retailer.kanall_ref}/statement`
    )

    const todayLines = statement.lines.filter(line => {
      const date = new Date(line.entry.CreatedAt).toDateString()
      return date === new Date().toDateString()
    })

    const todayConfirmed = todayLines
      .filter(l => l.entry.Status === 'confirmed' && l.entry.Direction === 'credit')
      .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0)

    const todayPending = todayLines
      .filter(l => l.entry.Status === 'provisional')
      .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0)

    report.push({
      retailer: retailer.name,
      accountRef: retailer.kanall_ref,
      confirmedToday: todayConfirmed,
      pendingToday: todayPending,
      runningBalance: parseFloat(statement.closingBalance),
    })
  }

  const totalConfirmed = report.reduce((sum, r) => sum + r.confirmedToday, 0)
  const totalPending = report.reduce((sum, r) => sum + r.pendingToday, 0)

  return {
    agentId,
    date: new Date().toDateString(),
    retailers: report,
    totalConfirmed,
    totalPending,
  }
}
```

**Sample output:**

```json
{
  "agentId": "agent-007",
  "date": "Tue Jul 01 2026",
  "retailers": [
    { "retailer": "Mama Ngozi Provisions", "confirmedToday": 45000, "pendingToday": 18500, "runningBalance": 63500 },
    { "retailer": "City Mart Ojuelegba",   "confirmedToday": 32000, "pendingToday": 0,     "runningBalance": 32000 },
    { "retailer": "Emeka Best Stores",      "confirmedToday": 0,     "pendingToday": 0,     "runningBalance": 0     }
  ],
  "totalConfirmed": 77000,
  "totalPending": 18500
}
```

## What to do with pending entries

`provisional` entries will be resolved by Kanall's convergence sweep within minutes. For the end-of-day report:

- **Confirmed:** Invoice is cleared. Retailer's credit hold is released.
- **Provisional:** Show as "awaiting bank confirmation" — do not clear the invoice yet.
- **Reversed:** Payment was not confirmed by Nomba. Do not clear the invoice. Flag for follow-up.

You can re-run the report an hour later and `provisional` entries will have become either `confirmed` or `reversed`.

## Handling large histories (pagination)

For retailers with long histories, paginate through all entries:

```js
async function getAllEntries(accountRef) {
  const entries = []
  let cursor = undefined

  do {
    const path = `/v1/accounts/${accountRef}/statement${cursor ? `?after=${cursor}` : ''}`
    const page = await kanallRequest('GET', path)
    entries.push(...page.lines)
    cursor = page.pagination.hasMore ? page.pagination.nextCursor : null
  } while (cursor)

  return entries
}
```

---

## Summary

You have now built a complete FMCG payment collection system on Kanall:

| Step | What it does |
|---|---|
| Provisioned per-retailer NUBANs | No more shared accounts. Every payment lands with perfect attribution. |
| Webhook handler | Real-time notification when funds arrive — invoices cleared automatically. |
| Confirmed-only reconciliation | The ledger tells you what is real, not just what was claimed. |
| Route report | Finance gets a clean daily summary without touching a spreadsheet. |

This same pattern applies to any domain: logistics, savings groups, school fees, marketplaces. The primitive is the same — only your business logic around it changes.
