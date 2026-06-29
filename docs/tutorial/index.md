---
id: index
title: "Tutorial: FMCG Distribution"
sidebar_label: Overview
---

# Tutorial: FMCG Distribution

In this tutorial you will integrate Kanall into a FMCG distribution platform. By the end, your backend will:

- Provision a dedicated NUBAN for each retailer on your customer list
- Receive real-time payment notifications when a retailer settles an invoice
- Query each retailer's collection history and confirmed balance
- Run an end-of-day reconciliation report per sales agent route

## The scenario

**PrimeLine Distribution** supplies beverages, household goods, and food products to over 300 provision stores across Lagos. Their sales agents do weekly credit-delivery runs — stock is delivered today, payment is expected within 2–7 days.

The problem: PrimeLine has 300+ active retailers all paying into 4 company accounts. Finance receives a spreadsheet of transfers every morning and spends 3 hours matching payment references to retailer IDs. When a reference is missing or wrong (common), the match fails and credit terms are not cleared — blocking the next delivery.

**The solution:** Each retailer gets their own NUBAN via Kanall. When Mama Ngozi's Provisions transfers ₦45,000 for Invoice #INV-2024-004, the payment lands in her dedicated virtual account, Kanall records it against her ledger, and PrimeLine's system receives a webhook instantly — no matching, no spreadsheets.

## What we will build

```
Retailer sends bank transfer to their NUBAN
          │
          ▼
   Nomba NIP rails
          │
          ▼
   Kanall (verifies, records in ledger, dispatches)
          │
          ▼
   PrimeLine backend (Express webhook handler)
          ├── Marks invoice as paid
          ├── Clears retailer's credit hold
          └── Updates agent's route collection total
```

## Prerequisites

- A registered Kanall tenant with an API key
- A backend capable of receiving HTTP POST requests (Node.js/Express examples shown)
- A publicly reachable webhook URL — use [ngrok](https://ngrok.com) for local testing

## Tutorial steps

1. [Register and configure](./01-setup) — set up your Kanall tenant and environment
2. [Provision retailer accounts](./02-provision-accounts) — assign a NUBAN to each store
3. [Receive payment webhooks](./03-receive-payments) — handle payment events in your backend
4. [Reconcile and report](./04-reconcile) — query balances and generate route collection reports
