---
id: intro
title: What is Kanall?
sidebar_label: Introduction
slug: /
---

# What is Kanall?

Kanall gives every entity in your platform — a driver, a merchant, a student, a supplier — a dedicated Nigerian bank account (NUBAN), and records every naira that flows through it in a double-entry ledger that never lies.

**[Sign up at www.kanall-app.online →](https://www.kanall-app.online)**

---

## The problem

When you build a platform that collects payments on behalf of multiple parties, three questions become painful fast:

**Which payment belongs to which entity?**
A shared account makes this impossible without dangerous manual matching. A StarLine Gas distributor sends ₦15,000 — is it for Emeka's route or Fatima's route?

**Did the money actually arrive?**
Webhooks are hints, not guarantees. They duplicate. They arrive late. They arrive out of order. Your system needs to know the truth, not just act on the latest event.

**What is the confirmed running balance?**
`provisional` entries are claims. `confirmed` entries are facts. Your reconciliation logic must distinguish them — or it will lie to you at the worst possible moment.

Each of these gets solved independently in production systems, usually with fragile bespoke code that breaks the moment volume picks up. Kanall solves all three as a single primitive.

---

## What Kanall provides

| Capability | What it means for you |
|---|---|
| **Dedicated NUBANs** | Each entity gets its own Nigerian bank account — payments land with zero ambiguity |
| **Double-entry ledger** | Every payment posts two rows: credit to the virtual account, debit to settlement. The sum is always zero. |
| **Append-only record** | Ledger entries are never updated or deleted. Corrections post new reversal entries. |
| **Truth hierarchy** | Webhooks are provisional. The Nomba Transactions API is canon. A background sweep reconciles the difference automatically. |
| **Idempotent ingestion** | Duplicate webhooks are safely ignored — each `requestId` is stored on first receipt. |
| **Webhook delivery** | Inbound payments trigger outbound webhooks to your endpoint, with exponential-backoff retry and dead-letter surfacing. |
| **Tenant isolation** | Every query is scoped by tenant. One tenant can never read another's data. |

---

## What Kanall is not

Kanall is a **system of record**, not a custodian. Nomba holds the funds. Kanall holds the attribution — who paid, how much, when, and to which account.

Kanall is **domain-blind**. It does not know what a driver, merchant, or student is. It provisions accounts, records payments, and delivers events. What those mean is your business logic.

Kanall is **not a payment gateway**. It does not initiate card payments or float money. It is an attribution and reconciliation layer on top of Nomba's virtual account rails.

---

## Who it's for

Kanall is the right layer when:

- Your platform collects money **on behalf of multiple parties** — logistics, FMCG distribution, marketplaces, savings groups, school fee collection
- You need **per-entity payment attribution** without a shared account
- You need a **trustworthy, auditable record** of every payment — not just webhook logs
- You want to **delegate the Nomba integration complexity** (token refresh, webhook verification, idempotency) to a single infrastructure component

---

**Ready to build?** [Get your API key →](./quickstart)
