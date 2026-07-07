---
id: 02-provision-accounts
title: "Step 2: Provision Distributor Accounts"
sidebar_label: "2. Provision Accounts"
---

# Step 2: Provision Distributor Accounts

Each distributor in StarLine's network gets their own dedicated NUBAN. You provision it once — the NUBAN is permanent and reused across all future invoices for that distributor.

## Provision a single account

```bash
curl -X POST https://kanall.onrender.com/v1/accounts \
  -H "X-API-Key: $KANALL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "distributor-emeka",
    "name": "Emeka Okafor"
  }'
```

| Field | Value | Why |
|---|---|---|
| `externalRef` | `distributor-emeka` | Your internal distributor ID — this is how Kanall links the payment back to your record |
| `name` | `Emeka Okafor` | Displayed when Emeka looks up the account number at his bank |

Payment notifications go to the tenant webhook URL you configured in Step 1. No `callbackUrl` needed per account.

**Response:**

```json
{
  "AccountRef": "distributor-emeka",
  "BankAccountNumber": "0123456789",
  "BankAccountName": "Emeka Okafor",
  "BankName": "Nomba MFB",
  "Currency": "NGN",
  "Status": "active",
  "CallbackURL": "https://app.starlinegas.ng/webhooks/payment",
  "CreatedAt": "2026-07-01T10:30:00Z"
}
```

`BankAccountNumber` is the NUBAN. Print it on Emeka's invoice. When he transfers to that number, Kanall knows it's his payment — no reference matching required.

## Provision accounts in bulk

At onboarding, provision accounts for your full distributor list. Kanall enforces a rate limit of 20 provisioning requests per minute per API key — batch accordingly.

```js
// provision-distributors.js
const { kanallRequest } = require('./kanall')

const distributors = await db.query(
  'SELECT id, name FROM distributors WHERE kanall_ref IS NULL'
)

for (const distributor of distributors.rows) {
  try {
    const account = await kanallRequest('POST', '/v1/accounts', {
      externalRef: `distributor-${distributor.id}`,
      name: distributor.name,
    })

    // Store the NUBAN in your database
    await db.query(
      'UPDATE distributors SET nuban = $1, kanall_ref = $2 WHERE id = $3',
      [account.BankAccountNumber, account.AccountRef, distributor.id]
    )

    console.log(`Provisioned ${distributor.name}: ${account.BankAccountNumber}`)
  } catch (err) {
    console.error(`Failed for ${distributor.name}: ${err.message}`)
  }

  // Respect rate limit
  await new Promise(r => setTimeout(r, 3100))
}
```

## Store what you need

After provisioning, your `distributors` table should hold:

| Column | Value | Purpose |
|---|---|---|
| `nuban` | `0123456789` | Print on invoices, share with the distributor |
| `kanall_ref` | `distributor-emeka` | Used to look up ledger via `GET /v1/accounts/distributor-emeka/statement` |

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

**Next:** [Receive payment webhooks →](./03-receive-payments)
