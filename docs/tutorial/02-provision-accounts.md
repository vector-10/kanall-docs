---
id: 02-provision-accounts
title: "Step 2: Provision Distributor Accounts"
sidebar_label: "2. Provision Accounts"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Step 2: Provision Distributor Accounts

Each distributor in StarLine's network gets their own dedicated NUBAN. You provision it once — the NUBAN is permanent and reused across all future invoices for that distributor.

## Provision a single account

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { kanall } = require('./kanall')

const account = await kanall('POST', '/v1/accounts', {
  externalRef: 'distributor-emeka',
  name: 'Emeka Okafor',
})
```

</TabItem>
<TabItem value="python" label="Python">

```python
from kanall import kanall

account = kanall('POST', '/v1/accounts', {
    'externalRef': 'distributor-emeka',
    'name': 'Emeka Okafor',
})
```

</TabItem>
<TabItem value="go" label="Go">

```go
var account struct {
    AccountRef        string
    BankAccountNumber string
    BankAccountName   string
    BankName          string
    Status            string
}

err := kanall.Request(ctx, "POST", "/v1/accounts", map[string]string{
    "externalRef": "distributor-emeka",
    "name":        "Emeka Okafor",
}, &account)
if err != nil {
    log.Fatal(err)
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
String json = kanall.request("POST", "/v1/accounts",
    "{\"externalRef\":\"distributor-emeka\",\"name\":\"Emeka Okafor\"}");

JsonObject account = JsonParser.parseString(json).getAsJsonObject();
String nuban = account.get("BankAccountNumber").getAsString();
```

</TabItem>
</Tabs>

| Field | Value | Why |
|---|---|---|
| `externalRef` | `distributor-emeka` | Your internal distributor ID — Kanall uses this to link payments back to your record |
| `name` | `Emeka Okafor` | Displayed when Emeka looks up the account number at his bank |

Payment notifications go to the tenant webhook URL you configured in Step 1. No `callbackUrl` needed per account unless you want to override it for a specific account.

**Response:**

```json
{
  "AccountRef": "distributor-emeka",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Emeka Okafor",
  "BankName": "Nomba MFB",
  "Currency": "NGN",
  "Status": "active",
  "CreatedAt": "2026-07-01T10:30:00Z"
}
```

`BankAccountNumber` is the NUBAN. Print it on Emeka's invoice. When he transfers to that number, Kanall knows it's his payment — no reference matching required.

---

## Provision accounts in bulk

At onboarding, provision accounts for your full distributor list. Kanall enforces a rate limit of 20 provisioning requests per minute per API key — batch accordingly.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { kanall } = require('./kanall')

// Fetch distributors that don't yet have a NUBAN
const distributors = await db.query(
  'SELECT id, name FROM distributors WHERE kanall_ref IS NULL'
)

for (const distributor of distributors.rows) {
  try {
    const account = await kanall('POST', '/v1/accounts', {
      externalRef: `distributor-${distributor.id}`,
      name: distributor.name,
    })

    await db.query(
      'UPDATE distributors SET nuban = $1, kanall_ref = $2 WHERE id = $3',
      [account.BankAccountNumber, account.AccountRef, distributor.id]
    )

    console.log(`Provisioned ${distributor.name}: ${account.BankAccountNumber}`)
  } catch (err) {
    console.error(`Failed for ${distributor.name}: ${err.message}`)
  }

  // Stay within the 20 req/min rate limit
  await new Promise(r => setTimeout(r, 3100))
}
```

</TabItem>
<TabItem value="python" label="Python">

```python
import time
from kanall import kanall

# Fetch distributors that don't yet have a NUBAN
rows = db.execute('SELECT id, name FROM distributors WHERE kanall_ref IS NULL').fetchall()

for distributor in rows:
    try:
        account = kanall('POST', '/v1/accounts', {
            'externalRef': f'distributor-{distributor["id"]}',
            'name': distributor['name'],
        })

        db.execute(
            'UPDATE distributors SET nuban = %s, kanall_ref = %s WHERE id = %s',
            (account['BankAccountNumber'], account['AccountRef'], distributor['id'])
        )

        print(f"Provisioned {distributor['name']}: {account['BankAccountNumber']}")
    except Exception as e:
        print(f"Failed for {distributor['name']}: {e}")

    # Stay within the 20 req/min rate limit
    time.sleep(3.1)
```

</TabItem>
<TabItem value="go" label="Go">

```go
type Distributor struct {
    ID   int
    Name string
}

distributors := fetchDistributorsWithoutNUBAN(db)

for _, d := range distributors {
    var account struct {
        AccountRef        string
        BankAccountNumber string
    }

    err := kanall.Request(ctx, "POST", "/v1/accounts", map[string]string{
        "externalRef": fmt.Sprintf("distributor-%d", d.ID),
        "name":        d.Name,
    }, &account)

    if err != nil {
        log.Printf("Failed for %s: %v", d.Name, err)
        time.Sleep(3100 * time.Millisecond)
        continue
    }

    saveNUBANtoDB(db, d.ID, account.BankAccountNumber, account.AccountRef)
    log.Printf("Provisioned %s: %s", d.Name, account.BankAccountNumber)

    // Stay within the 20 req/min rate limit
    time.Sleep(3100 * time.Millisecond)
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
List<Distributor> distributors = fetchDistributorsWithoutNUBAN(db);

for (Distributor distributor : distributors) {
    try {
        String body = String.format(
            "{\"externalRef\":\"distributor-%d\",\"name\":\"%s\"}",
            distributor.getId(), distributor.getName()
        );

        String json = kanall.request("POST", "/v1/accounts", body);
        JsonObject account = JsonParser.parseString(json).getAsJsonObject();

        String nuban = account.get("BankAccountNumber").getAsString();
        String ref   = account.get("AccountRef").getAsString();

        saveNUBANtoDB(db, distributor.getId(), nuban, ref);
        System.out.printf("Provisioned %s: %s%n", distributor.getName(), nuban);
    } catch (Exception e) {
        System.err.printf("Failed for %s: %s%n", distributor.getName(), e.getMessage());
    }

    // Stay within the 20 req/min rate limit
    Thread.sleep(3100);
}
```

</TabItem>
</Tabs>

---

## Store what you need

After provisioning, your `distributors` table should hold:

| Column | Value | Purpose |
|---|---|---|
| `nuban` | `0123456789` | Print on invoices, share with the distributor |
| `kanall_ref` | `distributor-emeka` | Used to look up the ledger via `GET /v1/accounts/distributor-emeka/statement` |

---

## Print the NUBAN on invoices

Add the distributor's NUBAN to every invoice you send:

```
═══════════════════════════════════════════
StarLine Gas — Invoice
INV-2026-007 │ Due: 2026-07-10
Distributor: Emeka Okafor (Route 7 — Ikeja)
Amount due: ₦45,000.00

PAY TO:
Bank:    Nomba MFB
Account: 0123456789
Name:    Emeka Okafor

Transfer exactly ₦45,000.00 to this account.
═══════════════════════════════════════════
```

When Emeka transfers to that NUBAN, Kanall receives the event and fires your webhook within seconds.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Missing or invalid `X-API-Key` | Check your API key is set in env and not expired |
| `409 Conflict` | `externalRef` already exists under this tenant | Use a unique ref per entity, or fetch the existing account instead |
| `422 Unprocessable Entity` | Missing required field | Include both `externalRef` and `name` in the request body |
| `429 Too Many Requests` | Rate limit exceeded (20 provisioning req/min) | Add a delay between requests in your bulk loop |

---

**Next:** [Receive payment webhooks →](./03-receive-payments)
