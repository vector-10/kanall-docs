---
id: 05-settle
title: "Step 5: Settle — Move Money Out"
sidebar_label: "5. Settlement"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Step 5: Settle — Move Money Out

At the end of the week, StarLine Gas pays each distributor their collected balance. Settlement is an outbound bank transfer from a virtual account to any Nigerian bank account.

Before settling, always:
1. Look up the recipient's bank account name to confirm the details
2. Check the account balance to confirm it covers the transfer amount
3. Initiate the transfer

---

## Step A — List available banks

Get the full list of supported banks and their codes. Bank codes are required for the settle request.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { kanall } = require('./kanall')

const { banks } = await kanall('GET', '/v1/transfers/banks')

const firstBank = banks.find(b => b.name.toLowerCase().includes('first bank'))
```

</TabItem>
<TabItem value="python" label="Python">

```python
from kanall import kanall

result = kanall('GET', '/v1/transfers/banks')
banks = result['banks']

first_bank = next(b for b in banks if 'first bank' in b['name'].lower())
```

</TabItem>
<TabItem value="go" label="Go">

```go
var result struct {
    Banks []struct {
        Name string `json:"name"`
        Code string `json:"code"`
    } `json:"banks"`
}
kanall.Request(ctx, "GET", "/v1/transfers/banks", nil, &result)

for _, bank := range result.Banks {
    fmt.Printf("%s — %s\n", bank.Code, bank.Name)
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
String json = kanall.request("GET", "/v1/transfers/banks", null);
JsonObject result = JsonParser.parseString(json).getAsJsonObject();
JsonArray banks = result.getAsJsonArray("banks");

for (JsonElement el : banks) {
    JsonObject bank = el.getAsJsonObject();
    System.out.printf("%s — %s%n",
        bank.get("code").getAsString(),
        bank.get("name").getAsString()
    );
}
```

</TabItem>
</Tabs>

**Response:**

```json
{
  "banks": [
    { "name": "First Bank of Nigeria", "code": "011" },
    { "name": "Guaranty Trust Bank", "code": "058" },
    { "name": "Access Bank", "code": "044" }
  ]
}
```

---

## Step B — Verify the recipient account

Resolve an account number to its registered name before initiating a transfer. This protects against typos and avoids sending to the wrong person.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const lookup = await kanall('POST', '/v1/transfers/lookup', {
  bankCode: '011',
  accountNumber: '3201467801',
})
```

</TabItem>
<TabItem value="python" label="Python">

```python
lookup = kanall('POST', '/v1/transfers/lookup', {
    'bankCode': '011',
    'accountNumber': '3201467801',
})
```

</TabItem>
<TabItem value="go" label="Go">

```go
var lookup struct {
    AccountName   string `json:"accountName"`
    AccountNumber string `json:"accountNumber"`
    BankCode      string `json:"bankCode"`
}
kanall.Request(ctx, "POST", "/v1/transfers/lookup", map[string]string{
    "bankCode":      "011",
    "accountNumber": "3201467801",
}, &lookup)
```

</TabItem>
<TabItem value="java" label="Java">

```java
String json = kanall.request("POST", "/v1/transfers/lookup",
    "{\"bankCode\":\"011\",\"accountNumber\":\"3201467801\"}");

JsonObject lookup = JsonParser.parseString(json).getAsJsonObject();
```

</TabItem>
</Tabs>

**Response:**

```json
{
  "accountName": "Akalonu Chukwuduzie Blaise",
  "accountNumber": "3201467801",
  "bankCode": "011"
}
```

Confirm `accountName` matches who you intend to pay before proceeding.

---

## Step C — Check the account balance

Confirm the virtual account has enough confirmed balance to cover the transfer amount.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { balance } = await kanall('GET', '/v1/accounts/distributor-emeka/balance')

const transferAmount = '45000.00'
if (parseFloat(balance) < parseFloat(transferAmount)) {
  throw new Error('Insufficient balance')
}
```

</TabItem>
<TabItem value="python" label="Python">

```python
from decimal import Decimal

result = kanall('GET', '/v1/accounts/distributor-emeka/balance')
balance = Decimal(result['balance'])

transfer_amount = Decimal('45000.00')
if balance < transfer_amount:
    raise ValueError(f'Insufficient balance: {balance}')
```

</TabItem>
<TabItem value="go" label="Go">

```go
import "github.com/shopspring/decimal"

var balanceResult struct {
    Balance string `json:"balance"`
}
kanall.Request(ctx, "GET", "/v1/accounts/distributor-emeka/balance", nil, &balanceResult)

balance, _ := decimal.NewFromString(balanceResult.Balance)
transferAmount, _ := decimal.NewFromString("45000.00")

if balance.LessThan(transferAmount) {
    return fmt.Errorf("insufficient balance: %s", balance)
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
String json = kanall.request("GET", "/v1/accounts/distributor-emeka/balance", null);
JsonObject result = JsonParser.parseString(json).getAsJsonObject();

BigDecimal balance = new BigDecimal(result.get("balance").getAsString());
BigDecimal transferAmount = new BigDecimal("45000.00");

if (balance.compareTo(transferAmount) < 0) {
    throw new RuntimeException("Insufficient balance: " + balance);
}
```

</TabItem>
</Tabs>

**Response:**

```json
{ "balance": "45000.00" }
```

---

## Step D — Initiate the settlement

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const result = await kanall('POST', '/v1/accounts/distributor-emeka/settle', {
  amount: '45000.00',
  bankCode: '011',
  accountNumber: '3201467801',
  narration: 'Emeka payout - week 28',
})

await db.query(
  'UPDATE settlements SET merchant_tx_ref = $1 WHERE distributor_id = $2',
  [result.merchantTxRef, distributorId]
)
```

</TabItem>
<TabItem value="python" label="Python">

```python
result = kanall('POST', '/v1/accounts/distributor-emeka/settle', {
    'amount': '45000.00',
    'bankCode': '011',
    'accountNumber': '3201467801',
    'narration': 'Emeka payout - week 28',
})

db.execute(
    'UPDATE settlements SET merchant_tx_ref = %s WHERE distributor_id = %s',
    (result['merchantTxRef'], distributor_id)
)
```

</TabItem>
<TabItem value="go" label="Go">

```go
var result struct {
    MerchantTxRef string `json:"merchantTxRef"`
    Status        string `json:"status"`
}

kanall.Request(ctx, "POST", "/v1/accounts/distributor-emeka/settle", map[string]string{
    "amount":        "45000.00",
    "bankCode":      "011",
    "accountNumber": "3201467801",
    "narration":     "Emeka payout - week 28",
}, &result)
```

</TabItem>
<TabItem value="java" label="Java">

```java
String body = """
    {
      "amount": "45000.00",
      "bankCode": "011",
      "accountNumber": "3201467801",
      "narration": "Emeka payout - week 28"
    }
    """;

String json = kanall.request("POST", "/v1/accounts/distributor-emeka/settle", body);
JsonObject result = JsonParser.parseString(json).getAsJsonObject();

String merchantTxRef = result.get("merchantTxRef").getAsString();
String status        = result.get("status").getAsString();
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

`merchantTxRef` is a server-generated reference. You do not provide this — Kanall generates and returns it. Store it immediately; it is the only way to track this transfer later.

:::caution amount must be a string
Send `"amount": "45000.00"` — a decimal string. Sending `"amount": 45000` (a number) will return `422 Unprocessable Entity`.
:::

---

## Step E — Poll the transfer status

The settle endpoint returns `202` — the transfer is queued, not yet completed. Poll `GET /v1/transfers/:merchantTxRef` until you get a terminal status:

```js
async function waitForTransfer(merchantTxRef, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const transfer = await kanall('GET', `/v1/transfers/${merchantTxRef}`)

    if (transfer.status === 'successful') return transfer

    if (transfer.status === 'failed' || transfer.status === 'reversed') {
      throw new Error(`Transfer ${transfer.status}: ${transfer.narration}`)
    }

    await new Promise(r => setTimeout(r, 5000))
  }

  throw new Error('Transfer status unknown after max attempts')
}
```

The same polling loop applies in Python, Go, and Java — check `status` on each response and sleep 5 seconds between attempts.

**Transfer statuses:**

| Status | Meaning |
|---|---|
| `pending` | Queued, not yet sent to the bank |
| `processing` | Sent to the bank, awaiting confirmation |
| `successful` | Funds delivered |
| `failed` | Transfer failed — funds remain in the virtual account |
| `reversed` | Transfer was reversed — funds returned to the virtual account |

---

## Calculate fee before settling

To know the exact gross amount Emeka needs to receive, use the fee calculator. This is useful when you want to top up a specific net amount.

```bash
GET /v1/fees/calculate?net=45000.00
```

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const fees = await kanall('GET', '/v1/fees/calculate?net=45000.00')
```

</TabItem>
<TabItem value="python" label="Python">

```python
fees = kanall('GET', '/v1/fees/calculate?net=45000.00')
```

</TabItem>
<TabItem value="go" label="Go">

```go
var fees struct {
    Net   string `json:"net"`
    Fee   string `json:"fee"`
    Gross string `json:"gross"`
}
kanall.Request(ctx, "GET", "/v1/fees/calculate?net=45000.00", nil, &fees)
```

</TabItem>
<TabItem value="java" label="Java">

```java
String json = kanall.request("GET", "/v1/fees/calculate?net=45000.00", null);
JsonObject fees = JsonParser.parseString(json).getAsJsonObject();
```

</TabItem>
</Tabs>

**Response:**

```json
{
  "net": "45000.00",
  "fee": "50.00",
  "gross": "45050.00"
}
```

`gross` is the amount that must be in the virtual account balance. `net` is what the recipient receives. `fee` is Nomba's NIP charge.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `422 Unprocessable Entity` | `amount` sent as a number, not a string | Send `"amount": "45000.00"` not `"amount": 45000` |
| `400 insufficient balance` | Virtual account balance is lower than the transfer amount | Confirm the ledger balance and check for pending entries |
| `404 Not Found` on bank lookup | Invalid `bankCode` | Use `GET /v1/transfers/banks` to get valid codes |
| `400 account name mismatch` | Lookup returned a different name than expected | Re-verify the account number and bank code before settling |

---

**Congratulations.** You have completed the full StarLine Gas integration:

- Distributors get dedicated NUBANs at onboarding
- Payments land in isolated ledgers — no matching required
- Finance gets a daily confirmed collection report by route
- Balances flow back to distributors via one API call

This same pattern applies to any platform that collects on behalf of multiple parties. The primitive does not change — only your business logic does.
