---
id: 02-provision-accounts
title: "Step 2: Provision Retailer Accounts"
sidebar_label: "2. Provision Accounts"
---

# Step 2: Provision Retailer Accounts

Each retailer in PrimeLine's customer database gets their own dedicated NUBAN. You provision it once — the NUBAN is permanent and reusable across all future invoices.

## Provision a single account

```bash
curl -X POST https://kanall.onrender.com/v1/accounts \
  -H "X-API-Key: $KANALL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "retailer-00142",
    "name": "Mama Ngozi Provisions",
    "callbackUrl": "https://app.primeline.ng/webhooks/payment"
  }'
```

| Field | Value | Why |
|---|---|---|
| `externalRef` | `retailer-00142` | Your internal retailer ID — this is how Kanall links the payment back to your record |
| `name` | `Mama Ngozi Provisions` | Displayed to the retailer when they look up the account number |
| `callbackUrl` | Your webhook URL | Where Kanall sends the payment event when funds arrive |

**Response:**

```json
{
  "ID": "7f3b9e2a-4d1c-4e8b-9f2a-3c5d7e8b1a2c",
  "AccountRef": "retailer-00142",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Mama Ngozi Provisions",
  "BankName": "Nomba MFB",
  "Currency": "NGN",
  "Status": "active",
  "CallbackURL": "https://app.primeline.ng/webhooks/payment",
  "CreatedAt": "2026-07-01T10:30:00Z"
}
```

The `BankAccountNumber` (`0123456789`) is the NUBAN. Print it on the retailer's invoice. When Mama Ngozi transfers to that number, Kanall knows it's her payment.

## Provision accounts in bulk

At onboarding, provision accounts for your full retailer list. Kanall enforces a rate limit of 20 provisioning requests per minute per API key — batch accordingly.

```js
// provision-retailers.js
const { kanallRequest } = require('./kanall')

const retailers = await db.query('SELECT id, name FROM retailers WHERE kanall_ref IS NULL')

for (const retailer of retailers.rows) {
  try {
    const account = await kanallRequest('POST', '/v1/accounts', {
      externalRef: `retailer-${retailer.id}`,
      name: retailer.name,
      callbackUrl: process.env.PAYMENT_WEBHOOK_URL,
    })

    // Store the NUBAN in your database
    await db.query(
      'UPDATE retailers SET nuban = $1, kanall_ref = $2 WHERE id = $3',
      [account.BankAccountNumber, account.AccountRef, retailer.id]
    )

    console.log(`Provisioned ${retailer.name}: ${account.BankAccountNumber}`)
  } catch (err) {
    console.error(`Failed for ${retailer.name}: ${err.message}`)
  }

  // Respect rate limit
  await new Promise(r => setTimeout(r, 3100))
}
```

## Store what you need

After provisioning, your `retailers` table should hold:

| Column | Value | Purpose |
|---|---|---|
| `nuban` | `0123456789` | Print on invoices, share with retailer |
| `kanall_ref` | `retailer-00142` | Used to look up ledger via `GET /v1/accounts/retailer-00142/statement` |

You do not need to store Kanall's internal `ID` (UUID) unless you need a stable foreign key in your own schema.

## Print the NUBAN on invoices

Add the retailer's NUBAN to every invoice:

```
═══════════════════════════════════════
PrimeLine Distribution — Invoice
INV-2026-004 │ Due: 2026-07-05
Customer: Mama Ngozi Provisions
Amount: ₦45,000.00

PAY TO:
Bank:    Nomba MFB
Account: 0123456789
Name:    Mama Ngozi Provisions

Transfer exactly ₦45,000.00 to this account.
═══════════════════════════════════════
```

When the retailer transfers to that NUBAN, Kanall receives the event and fires your webhook within seconds.

---

**Next:** [Receive payment webhooks →](./03-receive-payments)
