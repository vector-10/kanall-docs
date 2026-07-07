---
id: 04-reconcile
title: "Step 4: Reconcile and Report"
sidebar_label: "4. Reconcile"
---

# Step 4: Reconcile and Report

At the end of each day, StarLine's finance team needs to know: for each sales agent's route, how much was collected, from which distributors, and which invoices are cleared.

## Query a distributor's statement

```bash
curl https://kanall.onrender.com/v1/accounts/distributor-emeka/statement \
  -H "X-API-Key: $KANALL_API_KEY"
```

```json
{
  "virtualAccount": { "AccountRef": "distributor-emeka", "Status": "active" },
  "lines": [
    {
      "entry": {
        "Direction": "credit",
        "Amount": "45000.00",
        "Fee": "50.00",
        "Status": "confirmed",
        "Narration": "Transfer from Emeka Okafor",
        "NombaTxnRef": "nom_txn_abc123",
        "CreatedAt": "2026-07-07T11:00:00Z"
      },
      "runningBalance": "45000.00"
    },
    {
      "entry": {
        "Direction": "credit",
        "Amount": "18500.00",
        "Fee": "25.00",
        "Status": "provisional",
        "Narration": "Transfer from Emeka Okafor",
        "NombaTxnRef": "nom_txn_def456",
        "CreatedAt": "2026-07-07T16:30:00Z"
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

The `closingBalance` includes both `confirmed` and `provisional` entries — this is the settleable balance. For conservative reconciliation where you only want to count entries that Nomba has confirmed, filter to `confirmed` only:

```js
// reconcile.js
const { kanallRequest } = require('./kanall')

async function getConfirmedBalance(accountRef) {
  const statement = await kanallRequest('GET', `/v1/accounts/${accountRef}/statement`)

  const confirmedCredits = statement.lines
    .filter(l => l.entry.Status === 'confirmed' && l.entry.Direction === 'credit')
    .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0)

  const confirmedDebits = statement.lines
    .filter(l => l.entry.Status === 'confirmed' && l.entry.Direction === 'debit')
    .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0)

  return {
    accountRef,
    confirmedBalance: confirmedCredits - confirmedDebits,
    pendingAmount: statement.lines
      .filter(l => l.entry.Status === 'provisional')
      .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0),
  }
}
```

## End-of-day route report

Generate a collection summary for each sales agent's assigned distributors:

```js
// eod-report.js
const { kanallRequest } = require('./kanall')

async function generateRouteReport(agentId) {
  const distributors = await db.query(
    'SELECT id, name, kanall_ref FROM distributors WHERE agent_id = $1',
    [agentId]
  )

  const report = []

  for (const distributor of distributors.rows) {
    if (!distributor.kanall_ref) continue

    const statement = await kanallRequest(
      'GET',
      `/v1/accounts/${distributor.kanall_ref}/statement`
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
      distributor: distributor.name,
      accountRef: distributor.kanall_ref,
      confirmedToday: todayConfirmed,
      pendingToday: todayPending,
      runningBalance: parseFloat(statement.closingBalance),
    })
  }

  return {
    agentId,
    date: new Date().toDateString(),
    distributors: report,
    totalConfirmed: report.reduce((sum, r) => sum + r.confirmedToday, 0),
    totalPending: report.reduce((sum, r) => sum + r.pendingToday, 0),
  }
}
```

**Sample output:**

```json
{
  "agentId": "agent-007",
  "date": "Tue Jul 07 2026",
  "distributors": [
    { "distributor": "Emeka Okafor",   "confirmedToday": 45000, "pendingToday": 18500, "runningBalance": 63500 },
    { "distributor": "Fatima Yusuf",   "confirmedToday": 32000, "pendingToday": 0,     "runningBalance": 32000 },
    { "distributor": "Chukwudi Eze",   "confirmedToday": 0,     "pendingToday": 0,     "runningBalance": 0     }
  ],
  "totalConfirmed": 77000,
  "totalPending": 18500
}
```

## What to do with pending entries

- **Confirmed:** Invoice is cleared. Credit hold is released. Distributor can receive next delivery.
- **Provisional:** Show as "awaiting bank confirmation" — do not clear the invoice yet. Re-run the report in 15 minutes; it will have resolved.
- **Reversed:** Payment was not confirmed by Nomba. Do not clear the invoice. Flag the distributor for follow-up.

## Handling large histories (pagination)

For distributors with long histories, paginate:

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

You have built a complete FMCG payment collection system on Kanall:

| Step | What it does |
|---|---|
| Per-distributor NUBANs | No more shared accounts — every payment lands with perfect attribution |
| Webhook handler | Real-time notification when funds arrive — invoices cleared automatically |
| Statement reconciliation | The ledger tells you what is real, not just what was claimed |
| Route report | Finance gets a clean daily summary without touching a spreadsheet |

This same pattern applies to any domain: logistics, savings groups, school fees, marketplaces. The primitive is the same — only your business logic changes.
