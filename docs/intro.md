---
id: intro
title: What is Kanall?
sidebar_label: Introduction
slug: /
---

# What is Kanall?

Kanall is a multi-tenant virtual account infrastructure primitive built on Nomba's APIs.

It gives every entity in your platform — a driver, a merchant, a student, a supplier — a dedicated Nigerian bank account (NUBAN), and records every naira that flows through it in a double-entry ledger that never lies.

## The problem

When you build a platform that collects payments on behalf of multiple parties, three questions become painful:

**Which payment belongs to which entity?**
A shared account makes this impossible without dangerous manual matching. A customer sends ₦15,000 — is it for driver A or driver B?

**Did the money actually arrive?**
Payment gateways deliver webhooks as hints, not guarantees. Webhooks duplicate. They arrive late. They arrive out of order. Your system needs to know the truth, not just act on the latest message.

**What is the confirmed running balance?**
`provisional` entries are claims. `confirmed` entries are facts. Your reconciliation logic must distinguish them or it will lie to you.

Each of these is solved independently in production systems, usually with fragile bespoke code. Kanall solves all three as a single primitive.

## What Kanall provides

| Capability | Description |
|---|---|
| **Dedicated NUBANs** | Each entity gets its own Nigerian bank account via Nomba — payments land with zero ambiguity |
| **Double-entry ledger** | Every payment posts two rows: credit to the virtual account, debit to settlement. The sum is always zero. |
| **Append-only record** | Ledger entries are never updated or deleted. Corrections post new reversal entries. |
| **Truth hierarchy** | Webhooks are hints. The Nomba Transactions API is canon. A background convergence sweep reconciles the difference. |
| **Idempotent ingestion** | Each Nomba `requestId` is stored on first receipt. Duplicate webhooks are safely ignored. |
| **Webhook delivery** | Inbound payments trigger outbound webhooks to your endpoint, with exponential-backoff retry and dead-letter surfacing. |
| **Tenant isolation** | Every database query is scoped by `tenant_id`. One tenant can never read another's data. |

## What Kanall is not

Kanall is a **system of record**, not a custodian. Nomba holds the funds. Kanall holds the attribution — who paid, how much, when, and to which account.

Kanall is **domain-blind**. It does not know what a driver, merchant, or student is. It provisions accounts, records payments, and delivers events. What those mean is entirely your business logic.

Kanall is **not a payment gateway**. It does not initiate transfers or accept card payments. It is an attribution and reconciliation layer on top of Nomba's virtual account rails.

## Architecture

```
Your Backend ──────────────► Kanall API
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
               Nomba's APIs            PostgreSQL ledger
             (virtual accounts,        (double-entry,
              transactions)             append-only)
                     │
                     ▼
          Your webhook endpoint
        (payment events forwarded)
```

Your application interacts exclusively with Kanall's REST API. Kanall handles Nomba authentication, token refresh, NUBAN provisioning, ledger writes, and reconciliation. You never talk to Nomba directly.

## When to use Kanall

Kanall is the right layer when:

- Your platform collects money **on behalf of multiple parties** (logistics, marketplaces, savings groups, school fee collection)
- You need **per-entity payment attribution** without a shared account
- You need a **trustworthy, auditable record** of every payment — not just webhook logs
- You want to **delegate the Nomba integration complexity** (token refresh, webhook verification, signature validation, idempotency) to a single infrastructure component

If you are building one of those platforms, Kanall is the primitive underneath it.

---

**Next:** [Quick Start →](./quickstart)
