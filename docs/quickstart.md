---
id: quickstart
title: Quick Start
sidebar_label: Quick Start
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quick Start

In under 5 minutes you will have an API key, a provisioned virtual account with a real NUBAN, and a payment in the ledger.

We'll follow **StarLine Gas** — a gas distribution company that needs each of its distributors to have a dedicated collection account.

:::note What is a tenant?
In Kanall, your company is a **tenant**. Your API key identifies your tenant — every virtual account, ledger entry, and webhook delivery you create is permanently scoped to it.
:::

---

## Integration requirements

Before you begin, confirm your environment meets these requirements:

| Requirement | Minimum version | Why |
|---|---|---|
| Node.js | 18+ | Native `fetch` API — no extra dependency needed |
| Python | 3.8+ | f-strings and `requests` library support |
| Go | 1.18+ | Stable module system and generics |
| Java | 17+ | `HexFormat` class (for HMAC hex encoding) and text blocks |

**Other requirements:**

- Your API key must live in a **server-side** environment variable. Never expose it in client-side JavaScript, mobile apps, or version control.
- Your webhook endpoint must be reachable over **HTTPS**. Use [ngrok](https://ngrok.com) for local development.
- Amounts are always represented as **decimal strings** (`"5000.00"`, not `5000`). Parse them as `Decimal` / `BigDecimal`, not `float`.

---

## Step 1 — Get your API key

### Option A: Dashboard (recommended)

1. Go to **[www.kanall-app.online](https://www.kanall-app.online)** and sign up
2. Verify the one-time code sent to your email
3. Your API key is shown immediately after verification — copy and store it now

:::warning
Your API key is shown **once**. Kanall stores only a one-way hash — the raw key is never retrievable after this screen. If you lose it, rotate it from the dashboard at any time.
:::

### Option B: API

```bash
curl -X POST https://kanall.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "StarLine Gas",
    "email": "ops@starlinegas.ng",
    "password": "your-secure-password"
  }'
```

Kanall sends a one-time code to your email. Verify it:

```bash
curl -X POST https://kanall.onrender.com/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "otp": "847291"
  }'
```

**Response:**

```json
{
  "apiKey": "ten_sk_4a3b2c1d...",
  "warning": "Store this API key securely — it will not be shown again."
}
```

---

Store your key in your environment:

```bash
# .env
KANALL_API_KEY=ten_sk_4a3b2c1d...
KANALL_BASE_URL=https://kanall.onrender.com
```

---

## Step 1b — Set your webhook URL

Tell Kanall where to send payment notifications. You only do this once — every account you provision will deliver to this URL automatically.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const res = await fetch('https://kanall.onrender.com/auth/webhook-url', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.KANALL_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url: 'https://app.starlinegas.ng/webhooks/kanall' }),
})
const data = await res.json()
console.log(data) // { webhookUrl: 'https://app.starlinegas.ng/webhooks/kanall' }
```

</TabItem>
<TabItem value="python" label="Python">

```python
import requests, os

res = requests.post(
    'https://kanall.onrender.com/auth/webhook-url',
    headers={
        'X-API-Key': os.environ['KANALL_API_KEY'],
        'Content-Type': 'application/json',
    },
    json={'url': 'https://app.starlinegas.ng/webhooks/kanall'},
)
print(res.json())  # {'webhookUrl': 'https://app.starlinegas.ng/webhooks/kanall'}
```

</TabItem>
<TabItem value="go" label="Go">

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
)

func main() {
    body, _ := json.Marshal(map[string]string{
        "url": "https://app.starlinegas.ng/webhooks/kanall",
    })
    req, _ := http.NewRequest("POST", "https://kanall.onrender.com/auth/webhook-url", bytes.NewReader(body))
    req.Header.Set("X-API-Key", os.Getenv("KANALL_API_KEY"))
    req.Header.Set("Content-Type", "application/json")

    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()
    fmt.Println(resp.Status)
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
import java.net.URI;
import java.net.http.*;
import java.net.http.HttpResponse.BodyHandlers;

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://kanall.onrender.com/auth/webhook-url"))
    .header("X-API-Key", System.getenv("KANALL_API_KEY"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(
        "{\"url\":\"https://app.starlinegas.ng/webhooks/kanall\"}"
    ))
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
System.out.println(response.body());
```

</TabItem>
</Tabs>

---

## Step 2 — Provision a virtual account

StarLine Gas has a distributor named **Emeka Okafor** on Route 7. He needs a dedicated account so payments land with his name attached and are tracked independently.

`externalRef` is your stable identifier — your internal distributor ID, customer ID, or any unique reference. Kanall uses it as the account's lookup key.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const res = await fetch('https://kanall.onrender.com/v1/accounts', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.KANALL_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    externalRef: 'distributor-emeka',
    name: 'Emeka Okafor',
  }),
})
const account = await res.json()
console.log(account.BankAccountNumber) // the NUBAN — print it on invoices
```

</TabItem>
<TabItem value="python" label="Python">

```python
import requests, os

res = requests.post(
    'https://kanall.onrender.com/v1/accounts',
    headers={
        'X-API-Key': os.environ['KANALL_API_KEY'],
        'Content-Type': 'application/json',
    },
    json={'externalRef': 'distributor-emeka', 'name': 'Emeka Okafor'},
)
account = res.json()
print(account['BankAccountNumber'])  # NUBAN — print it on invoices
```

</TabItem>
<TabItem value="go" label="Go">

```go
body, _ := json.Marshal(map[string]string{
    "externalRef": "distributor-emeka",
    "name":        "Emeka Okafor",
})
req, _ := http.NewRequest("POST", "https://kanall.onrender.com/v1/accounts", bytes.NewReader(body))
req.Header.Set("X-API-Key", os.Getenv("KANALL_API_KEY"))
req.Header.Set("Content-Type", "application/json")

resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var account map[string]any
json.NewDecoder(resp.Body).Decode(&account)
fmt.Println(account["BankAccountNumber"]) // NUBAN
```

</TabItem>
<TabItem value="java" label="Java">

```java
String body = "{\"externalRef\":\"distributor-emeka\",\"name\":\"Emeka Okafor\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://kanall.onrender.com/v1/accounts"))
    .header("X-API-Key", System.getenv("KANALL_API_KEY"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
// Parse response.body() with your JSON library
// account.BankAccountNumber is the NUBAN
```

</TabItem>
</Tabs>

**Response:**

```json
{
  "AccountRef": "distributor-emeka",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Emeka Okafor",
  "BankName": "Nomba MFB",
  "Status": "active"
}
```

`BankAccountNumber` is the NUBAN. Share it with whoever is paying Emeka — they transfer to this number at any Nigerian bank.

---

## Step 3 — Receive a payment

A customer sends ₦5,025 to `0123456789`. Nomba fires a webhook to Kanall.

Kanall verifies the signature, checks idempotency, and posts a `provisional` ledger entry. Moments later the confirmation pipeline promotes it to `confirmed`. Your webhook URL receives a payment event:

```json
{
  "eventType": "payment.received",
  "accountRef": "distributor-emeka",
  "amount": "5000.00",
  "gross_amount": "5025.00",
  "nomba_fee": "25.00",
  "currency": "NGN",
  "senderName": "Chidi Emmanuel",
  "status": "provisional"
}
```

`amount` is the net after Nomba's ₦25 NIP fee. `status` will become `confirmed` in seconds — poll the statement or wait depending on your flow.

See [Receive Payment Webhooks](./tutorial/03-receive-payments) for signature verification and full handler examples in all languages.

---

## Step 4 — Check the ledger

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const res = await fetch('https://kanall.onrender.com/v1/accounts/distributor-emeka/statement', {
  headers: { 'X-API-Key': process.env.KANALL_API_KEY },
})
const statement = await res.json()
console.log(statement.closingBalance) // "5000.00"
```

</TabItem>
<TabItem value="python" label="Python">

```python
res = requests.get(
    'https://kanall.onrender.com/v1/accounts/distributor-emeka/statement',
    headers={'X-API-Key': os.environ['KANALL_API_KEY']},
)
statement = res.json()
print(statement['closingBalance'])  # "5000.00"
```

</TabItem>
<TabItem value="go" label="Go">

```go
req, _ := http.NewRequest("GET",
    "https://kanall.onrender.com/v1/accounts/distributor-emeka/statement", nil)
req.Header.Set("X-API-Key", os.Getenv("KANALL_API_KEY"))

resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var statement map[string]any
json.NewDecoder(resp.Body).Decode(&statement)
fmt.Println(statement["closingBalance"])
```

</TabItem>
<TabItem value="java" label="Java">

```java
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://kanall.onrender.com/v1/accounts/distributor-emeka/statement"))
    .header("X-API-Key", System.getenv("KANALL_API_KEY"))
    .GET()
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
// Parse response.body() — statement.closingBalance is the ledger balance
```

</TabItem>
</Tabs>

**Response:**

```json
{
  "lines": [
    {
      "entry": {
        "Direction": "credit",
        "Amount": "5000.00",
        "Fee": "25.00",
        "Status": "confirmed",
        "Narration": "Transfer from Chidi Emmanuel"
      },
      "runningBalance": "5000.00"
    }
  ],
  "closingBalance": "5000.00"
}
```

Emeka's balance is ₦5,000. The ₦25 fee is recorded but excluded from the balance — it went to Nomba.

---

## Step 5 — Settle (optional)

At the end of the week, StarLine Gas pays Emeka his collected balance. Always send `amount` as a decimal string.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const res = await fetch('https://kanall.onrender.com/v1/accounts/distributor-emeka/settle', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.KANALL_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: '5000.00',        // decimal string — never a number
    bankCode: '044',
    accountNumber: '0987654321',
    narration: 'Emeka payout - week 28',
  }),
})
const result = await res.json()
// result.merchantTxRef — use this to track the transfer
console.log(result.merchantTxRef) // "knl_1751500000_abc12345"
```

</TabItem>
<TabItem value="python" label="Python">

```python
res = requests.post(
    'https://kanall.onrender.com/v1/accounts/distributor-emeka/settle',
    headers={
        'X-API-Key': os.environ['KANALL_API_KEY'],
        'Content-Type': 'application/json',
    },
    json={
        'amount': '5000.00',   # decimal string — never a number
        'bankCode': '044',
        'accountNumber': '0987654321',
        'narration': 'Emeka payout - week 28',
    },
)
result = res.json()
print(result['merchantTxRef'])  # use this to poll transfer status
```

</TabItem>
<TabItem value="go" label="Go">

```go
payload := map[string]string{
    "amount":        "5000.00", // decimal string — never a number
    "bankCode":      "044",
    "accountNumber": "0987654321",
    "narration":     "Emeka payout - week 28",
}
body, _ := json.Marshal(payload)
req, _ := http.NewRequest("POST",
    "https://kanall.onrender.com/v1/accounts/distributor-emeka/settle",
    bytes.NewReader(body))
req.Header.Set("X-API-Key", os.Getenv("KANALL_API_KEY"))
req.Header.Set("Content-Type", "application/json")

resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()
// Parse resp.Body — result.merchantTxRef tracks the transfer
```

</TabItem>
<TabItem value="java" label="Java">

```java
String body = """
    {
      "amount": "5000.00",
      "bankCode": "044",
      "accountNumber": "0987654321",
      "narration": "Emeka payout - week 28"
    }
    """;

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://kanall.onrender.com/v1/accounts/distributor-emeka/settle"))
    .header("X-API-Key", System.getenv("KANALL_API_KEY"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
// Parse merchantTxRef from response.body() to poll transfer status
```

</TabItem>
</Tabs>

**Response:** `202 Accepted`

```json
{
  "merchantTxRef": "knl_1751500000_abc12345",
  "status": "pending"
}
```

The transfer is queued. Track it with `GET /v1/transfers/knl_1751500000_abc12345`.

:::tip Finding your bank code
List all supported banks and their codes with `GET /v1/transfers/banks`. Use `POST /v1/transfers/lookup` to verify an account number before settling.
:::

---

## What's next

- [Tutorial: StarLine Gas end-to-end](./tutorial/) — multiple distributors, one-time collection accounts, fee calculation, and settlement
- [Webhook Signature Verification](./guides/webhook-verification) — verify Kanall's outbound signature in your backend
- [Core Concepts](./concepts/tenants) — how the ledger, confirmation pipeline, and webhooks actually work
- [API Reference](./api-reference/authentication) — every endpoint, field, and error response
