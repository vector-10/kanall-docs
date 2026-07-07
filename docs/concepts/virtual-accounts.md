---
id: virtual-accounts
title: Virtual Accounts
sidebar_label: Virtual Accounts
---

# Virtual Accounts

A virtual account is a real Nigerian bank account number (NUBAN) that belongs to one entity in your platform and one entity only. When someone sends money to that NUBAN — from any bank, any channel — Kanall knows exactly who it's for, records it in the ledger, and notifies your endpoint. No reference matching. No spreadsheet reconciliation.

This is the core of what Kanall does. Everything else — the ledger, the confirmation pipeline, settlement — exists to make this attribution reliable.

---

## How provisioning works

1. You call `POST /v1/accounts` with an `externalRef` (your entity's ID) and a `name`
2. Kanall provisions a NUBAN via Nomba's virtual account API
3. Nomba assigns a real account number that can receive NIP transfers from any bank in Nigeria
4. You share the NUBAN with whoever is paying — they transfer, Kanall records it and notifies you

The NUBAN is permanent. Provision it once per entity and reuse it across all future transactions.

---

## Key fields

| Field | Description |
|---|---|
| `AccountRef` | Your `externalRef` — the reference you use in all subsequent API calls |
| `BankAccountNumber` | The NUBAN — share this with whoever is paying |
| `BankAccountName` | The account holder name as registered with Nomba |
| `Status` | Current state: `active` or `expired` |
| `Type` | `dedicated` (default) or `onetime` — set at provisioning, never changes |
| `CallbackURL` | Your endpoint that receives payment events for this account |
| `ExpectedAmount` | Optional fixed collection amount for one-time accounts |
| `ExpiresAt` | Optional timestamp when the account stops accepting payments |

---

## Account references

Kanall uses three identifiers for an account — they mean different things:

- **`AccountRef`** — Equal to your `externalRef`. Use this in all API calls (`GET /v1/accounts/:accountRef`, etc.)
- **`BankAccountNumber`** — The NUBAN. Share this with payers. It is not used in API calls.
- **`ID`** — Kanall's internal UUID. Only needed if you maintain a foreign key to Kanall in your own database.

---

## Balance

`GET /v1/accounts/:accountRef/balance` returns the current ledger balance — the sum of all `confirmed` and `provisional` credit entries minus all `confirmed` and `provisional` debit entries. `needs_review` and `reversed` entries are excluded.

```json
{
  "accountRef": "distributor-emeka",
  "balance": "47500.00",
  "currency": "NGN"
}
```

`balance` is a decimal string. Use a decimal library — never a float.

:::note Provisional entries count toward balance
Kanall includes `provisional` entries in the balance because the confirmation pipeline typically resolves them within seconds. You can safely display this balance in your UI and settle against it without waiting for confirmation. Only entries that cannot be verified (`needs_review`) are excluded.
:::

---

## Customer linkage

Every virtual account is linked to a `Customer` record. The customer holds KYC tier state (Tier 1, 2, or 3) that applies to all accounts belonging to that customer. See [KYC](./kyc) for the full tier model.

---

## One-time accounts

By default, every virtual account is **dedicated** — it stays open, accepts unlimited payments, and is reused if you call provision again with the same `externalRef`. This is the right model for most use cases.

For checkout-style scenarios (a food order, a one-off invoice), you can create a **one-time** account by setting `"mode": "onetime"`. One-time accounts close automatically once a matching payment arrives, or at the `expiresAt` deadline — whichever comes first.

See [One-time virtual accounts](../api-reference/accounts#one-time-virtual-accounts) for the full provisioning options.

---

## Lifecycle

```
active ──────────────────► expired
```

`expired` is the only terminal state. All ledger entries for an expired account remain fully queryable.

:::warning Expiry is irreversible
Once expired, no further payments are processed on that NUBAN. Only expire accounts you are certain are no longer needed.
:::

---

## Pagination

`GET /v1/accounts` returns accounts in cursor-based pages. Pass the `nextCursor` value as the `after` query parameter to advance:

```bash
GET /v1/accounts?after=7f3b9e2a-...
```

When `hasMore` is `false`, you have reached the end.
