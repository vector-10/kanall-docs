---
id: quickstart
title: Quick Start
sidebar_label: Quick Start
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quick Start

In under 5 minutes you will have an API key, a provisioned virtual account with a real NUBAN, and a payment in the ledger.

We'll follow **Bokku** — a supermarket chain that needs each of its store locations to have a dedicated collection account so supplier payments land with zero ambiguity.

:::note What is a tenant?
In Kanall, your company is a **tenant**. Your API key identifies your tenant — every virtual account, ledger entry, and webhook delivery you create is permanently scoped to it.
:::

---

## Integration requirements

Before you begin, confirm your environment meets these requirements:

| Requirement | Minimum version | Why |
|---|---|---|
| Node.js | 18+ | Built-in `fetch` — no extra HTTP library needed |
| Python | 3.8+ | Minimum version most backend environments ship |
| Go | 1.18+ | Minimum version most production Go services run |
| Java | 17+ | `HexFormat` class needed for webhook signature verification |

:::note Important to Note

- Your API key must live in a **server-side** environment variable. Never expose it in client-side JavaScript, mobile apps, or version control.
- Your webhook endpoint must be reachable over **HTTPS**. Use [ngrok](https://ngrok.com) for local development.
- Amounts are always represented as **decimal strings** (`"5000.00"`, not `5000`). Parse them with a decimal library, not a float.

:::

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
    "name": "Bokku Supermarket",
    "email": "ops@bokku.ng",
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
  body: JSON.stringify({ url: 'https://app.bokku.ng/webhooks/kanall' }),
})
const data = await res.json()
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
    json={'url': 'https://app.bokku.ng/webhooks/kanall'},
)
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
        "url": "https://app.bokku.ng/webhooks/kanall",
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
        "{\"url\":\"https://app.bokku.ng/webhooks/kanall\"}"
    ))
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
```

</TabItem>
</Tabs>

**Response:**

```json
{ "webhookUrl": "https://app.bokku.ng/webhooks/kanall" }
```

---

## Step 2 — Provision a virtual account

Bokku's Ikeja branch needs its own collection account so supplier payments land with that branch's name and are tracked independently.

`externalRef` is your stable identifier — your internal store ID, branch code, or any unique reference. Kanall uses it as the account's lookup key in all future API calls.

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
    externalRef: 'bokku-ikeja',
    name: 'Bokku Ikeja Branch',
  }),
})
const account = await res.json()
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
    json={'externalRef': 'bokku-ikeja', 'name': 'Bokku Ikeja Branch'},
)
account = res.json()
```

</TabItem>
<TabItem value="go" label="Go">

```go
body, _ := json.Marshal(map[string]string{
    "externalRef": "bokku-ikeja",
    "name":        "Bokku Ikeja Branch",
})
req, _ := http.NewRequest("POST", "https://kanall.onrender.com/v1/accounts", bytes.NewReader(body))
req.Header.Set("X-API-Key", os.Getenv("KANALL_API_KEY"))
req.Header.Set("Content-Type", "application/json")

resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var account map[string]any
json.NewDecoder(resp.Body).Decode(&account)
```

</TabItem>
<TabItem value="java" label="Java">

```java
String body = "{\"externalRef\":\"bokku-ikeja\",\"name\":\"Bokku Ikeja Branch\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://kanall.onrender.com/v1/accounts"))
    .header("X-API-Key", System.getenv("KANALL_API_KEY"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
```

</TabItem>
</Tabs>

**Response:**

```json
{
  "AccountRef": "bokku-ikeja",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Bokku Ikeja Branch",
  "BankName": "Nomba MFB",
  "Status": "active"
}
```

`BankAccountNumber` is the NUBAN. Share it with whoever is paying the Ikeja branch — they transfer to this number at any Nigerian bank. The bank name will appear as **Nomba MFB** (Nomba Microfinance Bank) in the sender's banking app — this is expected.

---

## Step 3 — Receive a payment

A supplier sends ₦5,025 to `0123456789`. Nomba fires a webhook to Kanall.

Kanall verifies the signature, checks idempotency, and posts a `provisional` ledger entry. Moments later the confirmation pipeline promotes it to `confirmed`. Your webhook URL receives a payment event:

```json
{
  "eventType": "payment.received",
  "accountRef": "bokku-ikeja",
  "amount": "5000.00",
  "gross_amount": "5025.00",
  "nomba_fee": "25.00",
  "currency": "NGN",
  "senderName": "Adebayo Foods Ltd",
  "status": "provisional"
}
```

`amount` is the net after Nomba's ₦25 NIP fee. `status` will become `confirmed` within seconds as the confirmation pipeline runs.

If your flow works better by polling rather than waiting for webhooks, you can call the statement endpoint directly — see Step 4.

See [Receive Payment Webhooks](./tutorial/03-receive-payments) for signature verification and full handler examples.

---

## Step 4 — Check the ledger

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const res = await fetch('https://kanall.onrender.com/v1/accounts/bokku-ikeja/statement', {
  headers: { 'X-API-Key': process.env.KANALL_API_KEY },
})
const statement = await res.json()
```

</TabItem>
<TabItem value="python" label="Python">

```python
res = requests.get(
    'https://kanall.onrender.com/v1/accounts/bokku-ikeja/statement',
    headers={'X-API-Key': os.environ['KANALL_API_KEY']},
)
statement = res.json()
```

</TabItem>
<TabItem value="go" label="Go">

```go
req, _ := http.NewRequest("GET",
    "https://kanall.onrender.com/v1/accounts/bokku-ikeja/statement", nil)
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
    .uri(URI.create("https://kanall.onrender.com/v1/accounts/bokku-ikeja/statement"))
    .header("X-API-Key", System.getenv("KANALL_API_KEY"))
    .GET()
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
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
        "Narration": "Transfer from Adebayo Foods Ltd"
      },
      "runningBalance": "5000.00"
    }
  ],
  "closingBalance": "5000.00"
}
```

The Ikeja branch balance is ₦5,000. The ₦25 fee is recorded but excluded from the balance — it went to Nomba.

---

## Step 5 — Settle (optional)

At the end of the week, Bokku pays a supplier directly from the branch account balance. Before initiating any transfer, always:

1. **Look up the destination account** — verify the account name matches who you intend to pay. This prevents sending to the wrong person.
2. **Get a valid bank code** — use `GET /v1/transfers/banks` to get the full list of banks and their codes.

:::caution
Sending to the wrong account number is irreversible once Nomba processes the transfer. Always verify the recipient with `POST /v1/transfers/lookup` before settling.
:::

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const res = await fetch('https://kanall.onrender.com/v1/accounts/bokku-ikeja/settle', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.KANALL_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: '5000.00',
    bankCode: '044',
    accountNumber: '0987654321',
    narration: 'Supplier payment - Adebayo Foods',
  }),
})
const result = await res.json()
```

</TabItem>
<TabItem value="python" label="Python">

```python
res = requests.post(
    'https://kanall.onrender.com/v1/accounts/bokku-ikeja/settle',
    headers={
        'X-API-Key': os.environ['KANALL_API_KEY'],
        'Content-Type': 'application/json',
    },
    json={
        'amount': '5000.00',
        'bankCode': '044',
        'accountNumber': '0987654321',
        'narration': 'Supplier payment - Adebayo Foods',
    },
)
result = res.json()
```

</TabItem>
<TabItem value="go" label="Go">

```go
payload := map[string]string{
    "amount":        "5000.00",
    "bankCode":      "044",
    "accountNumber": "0987654321",
    "narration":     "Supplier payment - Adebayo Foods",
}
body, _ := json.Marshal(payload)
req, _ := http.NewRequest("POST",
    "https://kanall.onrender.com/v1/accounts/bokku-ikeja/settle",
    bytes.NewReader(body))
req.Header.Set("X-API-Key", os.Getenv("KANALL_API_KEY"))
req.Header.Set("Content-Type", "application/json")

resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()
```

</TabItem>
<TabItem value="java" label="Java">

```java
String body = """
    {
      "amount": "5000.00",
      "bankCode": "044",
      "accountNumber": "0987654321",
      "narration": "Supplier payment - Adebayo Foods"
    }
    """;

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://kanall.onrender.com/v1/accounts/bokku-ikeja/settle"))
    .header("X-API-Key", System.getenv("KANALL_API_KEY"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
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

---

## What's next

- [Webhook Signature Verification](./guides/webhook-verification) — verify that payment notifications are genuinely from Kanall
- [Core Concepts](./concepts/tenants) — how the ledger, confirmation pipeline, and isolation actually work
- [API Reference](./api-reference/authentication) — every endpoint, field, and error response
- [Tutorial: Full FMCG Integration](./tutorial/) — a complete end-to-end build with multiple accounts, reconciliation, and settlement
