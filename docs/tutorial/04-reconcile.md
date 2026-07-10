---
id: 04-reconcile
title: "Step 4: Reconcile and Report"
sidebar_label: "4. Reconcile"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Step 4: Reconcile and Report

At the end of each day, StarLine's finance team needs to know: for each sales agent's route, how much was collected, from which distributors, and which invoices are cleared.

---

## Query a distributor's statement

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { kanall } = require('./kanall')

const statement = await kanall('GET', '/v1/accounts/distributor-emeka/statement')

console.log(statement.closingBalance)  // "63500.00"
console.log(statement.totalCredits)    // "63500.00"

// Count only confirmed entries
const confirmedBalance = statement.lines
  .filter(l => l.entry.Status === 'confirmed' && l.entry.Direction === 'credit')
  .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0)

console.log(confirmedBalance) // 45000
```

</TabItem>
<TabItem value="python" label="Python">

```python
from kanall import kanall
from decimal import Decimal

statement = kanall('GET', '/v1/accounts/distributor-emeka/statement')

print(statement['closingBalance'])  # "63500.00"

# Count only confirmed entries — use Decimal, not float
confirmed_balance = sum(
    Decimal(l['entry']['Amount'])
    for l in statement['lines']
    if l['entry']['Status'] == 'confirmed' and l['entry']['Direction'] == 'credit'
)
print(confirmed_balance)  # Decimal('45000.00')
```

</TabItem>
<TabItem value="go" label="Go">

```go
import "github.com/shopspring/decimal"

type StatementLine struct {
    Entry struct {
        Direction string `json:"Direction"`
        Amount    string `json:"Amount"`
        Status    string `json:"Status"`
        Narration string `json:"Narration"`
        CreatedAt string `json:"CreatedAt"`
    } `json:"entry"`
    RunningBalance string `json:"runningBalance"`
}

type Statement struct {
    Lines          []StatementLine `json:"lines"`
    ClosingBalance string          `json:"closingBalance"`
    TotalCredits   string          `json:"totalCredits"`
}

var statement Statement
kanall.Request(ctx, "GET", "/v1/accounts/distributor-emeka/statement", nil, &statement)

confirmedBalance := decimal.Zero
for _, line := range statement.Lines {
    if line.Entry.Status == "confirmed" && line.Entry.Direction == "credit" {
        amt, _ := decimal.NewFromString(line.Entry.Amount)
        confirmedBalance = confirmedBalance.Add(amt)
    }
}
fmt.Println(confirmedBalance.String()) // "45000.00"
```

</TabItem>
<TabItem value="java" label="Java">

```java
import java.math.BigDecimal;

String json = kanall.request("GET", "/v1/accounts/distributor-emeka/statement", null);
JsonObject statement = JsonParser.parseString(json).getAsJsonObject();

System.out.println(statement.get("closingBalance").getAsString()); // "63500.00"

// Count only confirmed entries — use BigDecimal, not double
BigDecimal confirmedBalance = BigDecimal.ZERO;
for (JsonElement el : statement.getAsJsonArray("lines")) {
    JsonObject entry = el.getAsJsonObject().getAsJsonObject("entry");
    if ("confirmed".equals(entry.get("Status").getAsString()) &&
        "credit".equals(entry.get("Direction").getAsString())) {
        confirmedBalance = confirmedBalance.add(
            new BigDecimal(entry.get("Amount").getAsString())
        );
    }
}
System.out.println(confirmedBalance); // 45000.00
```

</TabItem>
</Tabs>

**Sample statement response:**

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

The `closingBalance` includes both `confirmed` and `provisional` entries. For conservative reconciliation where you only count what Nomba has verified, filter to `confirmed` only.

:::caution Parse amounts as Decimal
`Amount`, `closingBalance`, and all other monetary fields are decimal strings (`"45000.00"`). Always parse them as `Decimal` / `BigDecimal` — never `float` or `double`, which can introduce rounding errors in financial calculations.
:::

---

## End-of-day route report

Generate a collection summary for each sales agent's assigned distributors:

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { kanall } = require('./kanall')

async function generateRouteReport(agentId) {
  const distributors = await db.query(
    'SELECT id, name, kanall_ref FROM distributors WHERE agent_id = $1',
    [agentId]
  )

  const report = []
  const today = new Date().toDateString()

  for (const distributor of distributors.rows) {
    if (!distributor.kanall_ref) continue

    const statement = await kanall('GET', `/v1/accounts/${distributor.kanall_ref}/statement`)

    const todayLines = statement.lines.filter(
      l => new Date(l.entry.CreatedAt).toDateString() === today
    )

    const confirmedToday = todayLines
      .filter(l => l.entry.Status === 'confirmed' && l.entry.Direction === 'credit')
      .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0)

    const pendingToday = todayLines
      .filter(l => l.entry.Status === 'provisional')
      .reduce((sum, l) => sum + parseFloat(l.entry.Amount), 0)

    report.push({
      distributor: distributor.name,
      accountRef: distributor.kanall_ref,
      confirmedToday,
      pendingToday,
      runningBalance: parseFloat(statement.closingBalance),
    })
  }

  return {
    agentId,
    date: today,
    distributors: report,
    totalConfirmed: report.reduce((sum, r) => sum + r.confirmedToday, 0),
    totalPending: report.reduce((sum, r) => sum + r.pendingToday, 0),
  }
}
```

</TabItem>
<TabItem value="python" label="Python">

```python
from kanall import kanall
from decimal import Decimal
from datetime import date

def generate_route_report(agent_id: str) -> dict:
    distributors = db.execute(
        'SELECT id, name, kanall_ref FROM distributors WHERE agent_id = %s',
        (agent_id,)
    ).fetchall()

    report = []
    today = date.today().isoformat()

    for distributor in distributors:
        if not distributor['kanall_ref']:
            continue

        statement = kanall('GET', f'/v1/accounts/{distributor["kanall_ref"]}/statement')

        today_lines = [
            l for l in statement['lines']
            if l['entry']['CreatedAt'][:10] == today
        ]

        confirmed_today = sum(
            Decimal(l['entry']['Amount']) for l in today_lines
            if l['entry']['Status'] == 'confirmed' and l['entry']['Direction'] == 'credit'
        )

        pending_today = sum(
            Decimal(l['entry']['Amount']) for l in today_lines
            if l['entry']['Status'] == 'provisional'
        )

        report.append({
            'distributor': distributor['name'],
            'accountRef': distributor['kanall_ref'],
            'confirmedToday': str(confirmed_today),
            'pendingToday': str(pending_today),
            'runningBalance': statement['closingBalance'],
        })

    total_confirmed = sum(Decimal(r['confirmedToday']) for r in report)
    total_pending   = sum(Decimal(r['pendingToday'])   for r in report)

    return {
        'agentId': agent_id,
        'date': today,
        'distributors': report,
        'totalConfirmed': str(total_confirmed),
        'totalPending': str(total_pending),
    }
```

</TabItem>
<TabItem value="go" label="Go">

```go
import (
    "github.com/shopspring/decimal"
    "time"
)

type RouteReport struct {
    AgentID        string              `json:"agentId"`
    Date           string              `json:"date"`
    Distributors   []DistributorReport `json:"distributors"`
    TotalConfirmed string              `json:"totalConfirmed"`
    TotalPending   string              `json:"totalPending"`
}

type DistributorReport struct {
    Distributor    string `json:"distributor"`
    AccountRef     string `json:"accountRef"`
    ConfirmedToday string `json:"confirmedToday"`
    PendingToday   string `json:"pendingToday"`
    RunningBalance string `json:"runningBalance"`
}

func GenerateRouteReport(ctx context.Context, agentID string) (RouteReport, error) {
    distributors := fetchDistributorsForAgent(db, agentID)
    today := time.Now().Format("2006-01-02")

    var report []DistributorReport
    totalConfirmed := decimal.Zero
    totalPending   := decimal.Zero

    for _, d := range distributors {
        if d.KanallRef == "" {
            continue
        }

        var statement Statement
        if err := kanall.Request(ctx, "GET",
            "/v1/accounts/"+d.KanallRef+"/statement", nil, &statement); err != nil {
            continue
        }

        confirmed := decimal.Zero
        pending   := decimal.Zero

        for _, line := range statement.Lines {
            if line.Entry.CreatedAt[:10] != today {
                continue
            }
            amt, _ := decimal.NewFromString(line.Entry.Amount)
            switch {
            case line.Entry.Status == "confirmed" && line.Entry.Direction == "credit":
                confirmed = confirmed.Add(amt)
            case line.Entry.Status == "provisional":
                pending = pending.Add(amt)
            }
        }

        totalConfirmed = totalConfirmed.Add(confirmed)
        totalPending   = totalPending.Add(pending)

        report = append(report, DistributorReport{
            Distributor:    d.Name,
            AccountRef:     d.KanallRef,
            ConfirmedToday: confirmed.String(),
            PendingToday:   pending.String(),
            RunningBalance: statement.ClosingBalance,
        })
    }

    return RouteReport{
        AgentID:        agentID,
        Date:           today,
        Distributors:   report,
        TotalConfirmed: totalConfirmed.String(),
        TotalPending:   totalPending.String(),
    }, nil
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
import java.math.BigDecimal;
import java.time.LocalDate;

public Map<String, Object> generateRouteReport(String agentId) throws Exception {
    List<Map<String, String>> distributors = fetchDistributorsForAgent(db, agentId);
    String today = LocalDate.now().toString();

    List<Map<String, Object>> report = new ArrayList<>();
    BigDecimal totalConfirmed = BigDecimal.ZERO;
    BigDecimal totalPending   = BigDecimal.ZERO;

    for (Map<String, String> distributor : distributors) {
        String kanallRef = distributor.get("kanall_ref");
        if (kanallRef == null) continue;

        String json = kanall.request("GET", "/v1/accounts/" + kanallRef + "/statement", null);
        JsonObject statement = JsonParser.parseString(json).getAsJsonObject();

        BigDecimal confirmed = BigDecimal.ZERO;
        BigDecimal pending   = BigDecimal.ZERO;

        for (JsonElement el : statement.getAsJsonArray("lines")) {
            JsonObject entry = el.getAsJsonObject().getAsJsonObject("entry");
            String createdAt = entry.get("CreatedAt").getAsString().substring(0, 10);
            if (!createdAt.equals(today)) continue;

            BigDecimal amount = new BigDecimal(entry.get("Amount").getAsString());
            String status    = entry.get("Status").getAsString();
            String direction = entry.get("Direction").getAsString();

            if ("confirmed".equals(status) && "credit".equals(direction)) {
                confirmed = confirmed.add(amount);
            } else if ("provisional".equals(status)) {
                pending = pending.add(amount);
            }
        }

        totalConfirmed = totalConfirmed.add(confirmed);
        totalPending   = totalPending.add(pending);

        Map<String, Object> row = new HashMap<>();
        row.put("distributor", distributor.get("name"));
        row.put("accountRef",  kanallRef);
        row.put("confirmedToday", confirmed.toPlainString());
        row.put("pendingToday",   pending.toPlainString());
        row.put("runningBalance", statement.get("closingBalance").getAsString());
        report.add(row);
    }

    return Map.of(
        "agentId", agentId,
        "date", today,
        "distributors", report,
        "totalConfirmed", totalConfirmed.toPlainString(),
        "totalPending",   totalPending.toPlainString()
    );
}
```

</TabItem>
</Tabs>

**Sample output:**

```json
{
  "agentId": "agent-007",
  "date": "2026-07-07",
  "distributors": [
    { "distributor": "Emeka Okafor",   "confirmedToday": "45000.00", "pendingToday": "18500.00", "runningBalance": "63500.00" },
    { "distributor": "Fatima Yusuf",   "confirmedToday": "32000.00", "pendingToday": "0.00",     "runningBalance": "32000.00" },
    { "distributor": "Chukwudi Eze",   "confirmedToday": "0.00",     "pendingToday": "0.00",     "runningBalance": "0.00"     }
  ],
  "totalConfirmed": "77000.00",
  "totalPending": "18500.00"
}
```

---

## What to do with each status

| Status | Meaning | Action |
|---|---|---|
| `confirmed` | Nomba has verified the payment | Clear the invoice. Release credit hold. Allow next delivery. |
| `provisional` | Payment received but not yet verified | Show as "awaiting bank confirmation". Re-run the report in 15 minutes. |
| `reversed` | Payment was not confirmed by Nomba | Do not clear the invoice. Flag the distributor for follow-up. |

---

## Handling long account histories (pagination)

For distributors with many transactions, the statement is cursor-paginated. Loop until `pagination.hasMore` is false, passing `?after={nextCursor}` on each subsequent request:

```js
async function getAllEntries(accountRef) {
  const entries = []
  let cursor = null

  do {
    const path = `/v1/accounts/${accountRef}/statement${cursor ? `?after=${cursor}` : ''}`
    const page = await kanall('GET', path)
    entries.push(...page.lines)
    cursor = page.pagination?.hasMore ? page.pagination.nextCursor : null
  } while (cursor)

  return entries
}
```

The same cursor loop applies in Python, Go, and Java — replace the `kanall()` call with your language's client.

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

---

**Next:** [Settlement — move money out →](./05-settle)
