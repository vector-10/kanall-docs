---
id: intro
title: What is Kanall?
sidebar_label: Introduction
slug: /
---

# What is Kanall?

Picture Bokku, a supermarket chain with 40 stores across Nigeria. At the end of each month, the finance team gets a bank statement for the company's shared collection account. There are hundreds of transfers — ₦45,000 from one sender, ₦18,000 from another — and no indication of which store they belong to. Someone has to manually match every payment to a location. It takes days. Mistakes happen.

The problem is not the bank. The problem is the shared account.

Kanall gives every entity in your platform — a store, a driver, a freelancer, a vendor — its own dedicated Nigerian bank account (NUBAN), then records every payment in a ledger that can never be tampered with.

Kanall is built on top of **[Nomba's](https://nomba.com)** virtual account infrastructure. Nomba holds the funds. Kanall holds the record of who received what, how much, and when.

**[Sign up at www.kanall-app.online →](https://www.kanall-app.online)**

---

## The problem Kanall solves

When you build a platform that collects money on behalf of multiple parties, three questions become painful:

**Which payment belongs to which entity?**
A shared account makes this impossible without manual matching. If Bokku's Ikeja branch and Lekki branch both receive supplier payments on the same day, how do you know which ₦45,000 belongs where?

**Did the money actually arrive?**
Webhooks are hints, not guarantees. They arrive late. They arrive twice. They arrive out of order. Your system needs to know the truth — not just act on the most recent event.

**What is the confirmed running balance?**
A payment that was notified is not the same as a payment that was verified. Until Nomba's own records confirm it, you are working from a claim. Your reconciliation logic must know the difference.

Each of these gets solved separately in production systems, usually with hand-built code that breaks the moment volume picks up. Kanall solves all three as a single infrastructure layer.

---

## What Kanall is

Kanall is a **system of record, not a custodian**. It does not move money — Nomba does. Kanall tracks ownership: who received what, in which account, confirmed to what degree.

| Capability | What it means for you |
|---|---|
| **Dedicated NUBANs** | Each entity gets its own Nigerian bank account. Payments land with zero ambiguity — no matching required. |
| **Double-entry ledger** | Every payment posts two rows: credit to the virtual account, debit to settlement. The sum is always zero. |
| **Append-only record** | Ledger entries are never updated or deleted. Corrections post new reversal entries. |
| **Truth hierarchy** | Webhooks are provisional. The Nomba Transactions API is the source of truth. A background sweep reconciles the difference automatically. |
| **Idempotent ingestion** | Duplicate webhooks are safely ignored — each payment event is recorded exactly once. |
| **Webhook delivery** | Inbound payments trigger outbound notifications to your endpoint, with automatic retry and dead-letter visibility. |
| **Tenant isolation** | Every query is scoped to your account. One tenant can never read another's data. |

---

## What Kanall is not

Kanall is **not a payment gateway**. It does not initiate card payments or float money. It is an ownership tracking and reconciliation layer on top of Nomba's virtual account rails.

Kanall is **domain-blind**. It does not know what a store, driver, or vendor is. It provisions accounts, records payments, and delivers events. What those mean is your business logic.

---

## Who it's for

Kanall is the right layer when:

- Your platform collects money **on behalf of multiple parties** — retail chains, FMCG distribution, logistics, gig economy, savings groups, school fee collection
- You need **per-entity payment ownership** without a shared account
- You need a **trustworthy, auditable record** of every payment — not just webhook logs
- You want to **delegate the Nomba integration complexity** (token refresh, webhook verification, idempotency) to a single infrastructure component

---

**Ready to build?** [Get your API key →](./quickstart)
