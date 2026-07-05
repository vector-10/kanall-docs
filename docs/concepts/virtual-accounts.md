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
| `Type` | `dedicated` or `onetime` — set at provisioning, never changes |
| `CallbackURL` | Your endpoint that receives payment events for this account |
| `ExpectedAmount` | Optional fixed collection amount (see below) |
| `ExpiresAt` | Optional timestamp when the account will stop accepting payments |

## Account references

Kanall uses three identifiers for an account:

- **`ID`** — Kanall's internal UUID. Use this only if you need a stable foreign key in your own database.
- **`AccountRef`** — Equal to your `externalRef` at creation time. Use this in all API calls (`GET /v1/accounts/:accountRef`, etc.).
- **`BankAccountNumber`** — The NUBAN. This is what you share with payers — it is meaningless to Kanall internally.

## Customer linkage

Every virtual account is linked to a `Customer` record via `CustomerID`. The customer holds the KYC tier state (Tier 1, 2, or 3 per CBN guidelines). One customer can have multiple virtual accounts, and their KYC tier applies across all of them. See [KYC](./kyc) for the full tier model.

## Dedicated vs one-time accounts

A **dedicated** account (the default) stays open indefinitely and can receive any number of payments. If you try to provision the same `externalRef` again, Kanall returns the existing account rather than creating a duplicate. This is the right model for entities that receive payments over time — a driver who gets paid per delivery, a merchant with a standing collection account.

A **one-time** account is designed for a single transaction. It closes itself after that transaction happens. Set `"mode": "onetime"` when provisioning.

One-time accounts are ideal for checkouts. When someone is about to pay for a food order or complete an e-commerce purchase, you create a one-time account for that specific payment, show the customer the NUBAN, and the account disappears once the money arrives.

```json
{
  "externalRef": "order-88712",
  "name": "Chowdeck Order #88712",
  "mode": "onetime",
  "expectedAmount": 6525.00,
  "expiresAt": "2026-07-07T23:00:00Z"
}
```

**How auto-expiry works:**

- If you set `expectedAmount` — the account expires the moment a payment for that exact amount arrives. Kanall calls Nomba's expire endpoint and marks the account as `expired` in the same step.
- If you set `expiresAt` — Nomba closes the account at that time even if nothing has been paid.
- If you set both — whichever happens first wins.

Payments that arrive on an already-expired account are flagged as misdirected and are not credited to any balance.

## Expected amount and fees

When you set `expectedAmount`, you're telling Nomba (and Kanall) the exact naira amount the payer should send. The number you set here should account for the transfer fee that Nomba will deduct.

For example: your order total is ₦5,000. Nomba will deduct a ₦25 NIP fee. If you set `expectedAmount: 5000` and your customer sends exactly ₦5,000, only ₦4,975 lands. To receive the full ₦5,000, set `expectedAmount: 5025` and tell your customer to send ₦5,025.

Use `GET /v1/fees/calculate?amount=5000` to get the correct `send_amount` and `expectedAmount` to set, without calculating it yourself.

See [Fees](../api-reference/accounts#fee-calculation) for the full fee tier table.

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
