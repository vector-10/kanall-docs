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

// Find First Bank
const firstBank = banks.find(b => b.name.toLowerCase().includes('first bank'))
console.log(firstBank) // { name: 'First Bank of Nigeria', code: '011' }
```

</TabItem>
<TabItem value="python" label="Python">

```python
from kanall import kanall

result = kanall('GET', '/v1/transfers/banks')
banks = result['banks']

# Find a bank by name
first_bank = next(b for b in banks if 'first bank' in b['name'].lower())
print(first_bank)  # {'name': 'First Bank of Nigeria', 'code': '011'}
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

console.log(lookup.accountName) // "Akalonu Chukwuduzie Blaise"
// Confirm this matches who you intend to pay before proceeding
```

</TabItem>
<TabItem value="python" label="Python">

```python
lookup = kanall('POST', '/v1/transfers/lookup', {
    'bankCode': '011',
    'accountNumber': '3201467801',
})

print(lookup['accountName'])  # "Akalonu Chukwuduzie Blaise"
# Confirm this matches who you intend to pay before proceeding
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

fmt.Println(lookup.AccountName) // "Akalonu Chukwuduzie Blaise"
```

</TabItem>
<TabItem value="java" label="Java">

```java
String json = kanall.request("POST", "/v1/transfers/lookup",
    "{\"bankCode\":\"011\",\"accountNumber\":\"3201467801\"}");

JsonObject lookup = JsonParser.parseString(json).getAsJsonObject();
System.out.println(lookup.get("accountName").getAsString());
// "Akalonu Chukwuduzie Blaise"
```

</TabItem>
</Tabs>

---

## Step C — Check the account balance

Confirm the virtual account has enough confirmed balance to cover the transfer amount.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { balance } = await kanall('GET', '/v1/accounts/distributor-emeka/balance')
console.log(balance) // "45000.00"

// Always compare as Decimal — never parseFloat for money
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

---

## Step D — Initiate the settlement

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const result = await kanall('POST', '/v1/accounts/distributor-emeka/settle', {
  amount: '45000.00',        // decimal string — never a number
  bankCode: '011',
  accountNumber: '3201467801',
  narration: 'Emeka payout - week 28',
})

console.log(result.merchantTxRef) // "knl_1751500000_abc12345"
console.log(result.status)        // "pending"

// Store merchantTxRef — you'll use it to poll the transfer status
await db.query(
  'UPDATE settlements SET merchant_tx_ref = $1 WHERE distributor_id = $2',
  [result.merchantTxRef, distributorId]
)
```

</TabItem>
<TabItem value="python" label="Python">

```python
result = kanall('POST', '/v1/accounts/distributor-emeka/settle', {
    'amount': '45000.00',   # decimal string — never a number
    'bankCode': '011',
    'accountNumber': '3201467801',
    'narration': 'Emeka payout - week 28',
})

print(result['merchantTxRef'])  # "knl_1751500000_abc12345"
print(result['status'])         # "pending"

# Store merchantTxRef to poll later
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
    "amount":        "45000.00", // decimal string — never a number
    "bankCode":      "011",
    "accountNumber": "3201467801",
    "narration":     "Emeka payout - week 28",
}, &result)

fmt.Println(result.MerchantTxRef) // "knl_1751500000_abc12345"
// Store result.MerchantTxRef in your DB
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

System.out.println(merchantTxRef); // "knl_1751500000_abc12345"
// Store merchantTxRef in your DB for tracking
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

The settle endpoint returns `202` — the transfer is queued, not yet completed. Poll `GET /v1/transfers/:merchantTxRef` to check the outcome.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
async function waitForTransfer(merchantTxRef, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const transfer = await kanall('GET', `/v1/transfers/${merchantTxRef}`)
    
    if (transfer.status === 'successful') {
      console.log('Transfer completed:', transfer)
      return transfer
    }
    
    if (transfer.status === 'failed' || transfer.status === 'reversed') {
      throw new Error(`Transfer ${transfer.status}: ${transfer.narration}`)
    }

    // Still pending — wait before polling again
    await new Promise(r => setTimeout(r, 5000))
  }

  throw new Error('Transfer status unknown after max attempts')
}
```

</TabItem>
<TabItem value="python" label="Python">

```python
import time

def wait_for_transfer(merchant_tx_ref: str, max_attempts: int = 10) -> dict:
    for _ in range(max_attempts):
        transfer = kanall('GET', f'/v1/transfers/{merchant_tx_ref}')

        if transfer['status'] == 'successful':
            print('Transfer completed:', transfer)
            return transfer

        if transfer['status'] in ('failed', 'reversed'):
            raise ValueError(f"Transfer {transfer['status']}: {transfer.get('narration')}")

        time.sleep(5)

    raise TimeoutError('Transfer status unknown after max attempts')
```

</TabItem>
<TabItem value="go" label="Go">

```go
func waitForTransfer(ctx context.Context, merchantTxRef string) (map[string]any, error) {
    for i := 0; i < 10; i++ {
        var transfer map[string]any
        if err := kanall.Request(ctx, "GET", "/v1/transfers/"+merchantTxRef, nil, &transfer); err != nil {
            return nil, err
        }

        switch transfer["status"] {
        case "successful":
            return transfer, nil
        case "failed", "reversed":
            return nil, fmt.Errorf("transfer %s: %s", transfer["status"], transfer["narration"])
        }

        time.Sleep(5 * time.Second)
    }
    return nil, fmt.Errorf("transfer status unknown after max attempts")
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
public JsonObject waitForTransfer(String merchantTxRef) throws Exception {
    for (int i = 0; i < 10; i++) {
        String json = kanall.request("GET", "/v1/transfers/" + merchantTxRef, null);
        JsonObject transfer = JsonParser.parseString(json).getAsJsonObject();
        String status = transfer.get("status").getAsString();

        if ("successful".equals(status)) return transfer;

        if ("failed".equals(status) || "reversed".equals(status)) {
            throw new RuntimeException("Transfer " + status + ": " +
                transfer.get("narration").getAsString());
        }

        Thread.sleep(5000);
    }
    throw new RuntimeException("Transfer status unknown after max attempts");
}
```

</TabItem>
</Tabs>

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

console.log(fees.net)   // "45000.00" — what Emeka receives
console.log(fees.fee)   // "50.00"    — Nomba's NIP fee
console.log(fees.gross) // "45050.00" — what needs to be in the balance
```

</TabItem>
<TabItem value="python" label="Python">

```python
fees = kanall('GET', '/v1/fees/calculate?net=45000.00')

print(fees['net'])   # "45000.00"
print(fees['fee'])   # "50.00"
print(fees['gross']) # "45050.00"
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
fmt.Printf("Send %s to deliver %s (fee: %s)\n", fees.Gross, fees.Net, fees.Fee)
```

</TabItem>
<TabItem value="java" label="Java">

```java
String json = kanall.request("GET", "/v1/fees/calculate?net=45000.00", null);
JsonObject fees = JsonParser.parseString(json).getAsJsonObject();

System.out.println("Net:   " + fees.get("net").getAsString());   // 45000.00
System.out.println("Fee:   " + fees.get("fee").getAsString());   // 50.00
System.out.println("Gross: " + fees.get("gross").getAsString()); // 45050.00
```

</TabItem>
</Tabs>

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
