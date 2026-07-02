---
id: virtual-accounts
title: Virtual Accounts
sidebar_label: Virtual Accounts
---

# Virtual Accounts

A **virtual account** is a dedicated Nigerian bank account (NUBAN) provisioned via Nomba and associated with a specific entity in your system.

When a customer transfers money to that NUBAN — from any bank, any channel — the funds land in Nomba's infrastructure, and Kanall immediately records the payment against the correct entity's ledger.

## How it works

1. You call `POST /v1/accounts` with an `externalRef` (your entity's ID) and a `name`
2. Kanall provisions a NUBAN via Nomba's virtual account API
3. Nomba assigns a real account number (`BankAccountNumber`) that can receive NIP transfers from any bank in Nigeria
4. Your entity pays into that account number — directly, via app, or by scanning a QR code
5. Kanall records the payment in the ledger and notifies your endpoint

## Key fields

| Field | Description |
|---|---|
| `AccountRef` | Your `externalRef` — the stable reference you use in all subsequent API calls |
| `BankAccountNumber` | The NUBAN assigned by Nomba — share this with whoever is paying |
| `BankAccountName` | The account holder name as registered with Nomba |
| `BankName` | The bank name (e.g. "Nomba MFB") |
| `Currency` | Always `NGN` at this time |
| `Status` | Current lifecycle state: `active` or `expired` |
| `CallbackURL` | Your endpoint that receives payment events for this account |
| `ExpectedAmount` | Optional fixed collection amount (see below) |

## Account references

Kanall uses three identifiers for an account:

- **`ID`** — Kanall's internal UUID. Use this only if you need a stable foreign key in your own database.
- **`AccountRef`** — Equal to your `externalRef` at creation time. Use this in all API calls (`GET /v1/accounts/:accountRef`, etc.).
- **`BankAccountNumber`** — The NUBAN. This is what you share with payers — it is meaningless to Kanall internally.

## Customer linkage

Every virtual account is linked to a `Customer` record via `CustomerID`. The customer holds the KYC tier state (Tier 1, 2, or 3 per CBN guidelines). One customer can have multiple virtual accounts, and their KYC tier applies across all of them. See [KYC](./kyc) for the full tier model.

## Expected amount

If you pass `expectedAmount` when provisioning, Nomba enforces it at the payment rail level: any transfer that doesn't match the exact amount will be rejected by Nomba before it reaches Kanall. This is useful for fixed-price collection scenarios (school fees, membership dues, delivery charges).

```json
{
  "externalRef": "invoice-4521",
  "name": "Supplier Payment — July",
  "expectedAmount": 250000.00
}
```

`expectedAmount` is in naira. Kanall converts to kobo before sending to Nomba.

When an amount mismatch does land (edge case), Kanall records it as a fact without taking action. Your webhook payload and statement will show the actual amount received. What you do with that is your business logic.

## Balance

`GET /v1/accounts/:accountRef/balance` returns the current ledger balance — the sum of all confirmed credit entries minus confirmed debit entries. Provisional and reversed entries are excluded.

```json
{
  "accountRef": "driver-001",
  "balance": "47500.00",
  "currency": "NGN"
}
```

`balance` is a decimal string. Use a decimal library when parsing — never a float.

## Rename

You can update the display name of an account via `PATCH /v1/accounts/:accountRef` with a `name` field. This updates the `BankAccountName` in Kanall's records. The Nomba upstream record retains the original provisioning name.

## State history

`GET /v1/accounts/:accountRef/history` returns a chronological log of all status transitions (e.g. provisioned → expired). Useful for audit trails.

## Lifecycle

Virtual accounts have two states:

```
active ──────────────────► expired
```

| Transition | Endpoint | Description |
|---|---|---|
| `active → expired` | `POST /v1/accounts/:ref/expire` | Permanently closes the account |

`expired` is the only terminal state — it cannot be reversed. All previously recorded ledger entries remain and are still queryable via the [Statement API](../api-reference/statement).

:::warning Expiry is irreversible
Once an account is expired, no further payments will be processed for that NUBAN. Nomba's `expiryDate` mechanism is one-way and cannot be undone. Only expire accounts you are certain are no longer needed.
:::

## Cursor-based pagination

`GET /v1/accounts` returns accounts in pages. Use the `after` query parameter with the `nextCursor` value from the previous response to advance through pages:

```bash
# First page
GET /v1/accounts

# Next page
GET /v1/accounts?after=7f3b9e2a-...
```

```json
{
  "pagination": {
    "limit": 20,
    "nextCursor": "9c4d1f3b-...",
    "hasMore": true
  }
}
```

When `hasMore` is `false`, you have reached the end.
