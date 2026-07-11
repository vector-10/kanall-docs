---
id: index
title: "Tutorial: FMCG Integration"
sidebar_label: Overview
---

# Tutorial: FMCG Integration

In this tutorial you will integrate Kanall into a FMCG distribution platform. By the end, your backend will:

- Provision a dedicated NUBAN for each distributor on your network
- Receive real-time payment notifications when a distributor settles an invoice
- Query each distributor's collection history and confirmed balance
- Run an end-of-day reconciliation report per sales agent route

## The scenario

**StarLine Gas** supplies cooking gas to hundreds of distributors across Lagos and Abuja. Their sales agents do weekly credit runs — stock is delivered today, payment is expected within 2–7 days.

The problem: StarLine has 400+ active distributors all paying into 3 company accounts. Finance receives a spreadsheet of transfers every morning and spends hours matching payment references to distributor IDs. When a reference is missing or wrong (common), the match fails and credit terms are not cleared — blocking the next delivery.

**The solution:** Each distributor gets their own NUBAN via Kanall. When Emeka Okafor transfers ₦45,000 for Invoice #INV-2026-007, the payment lands in his dedicated virtual account, Kanall records it against his ledger, and StarLine's system receives a webhook instantly — no matching, no spreadsheets.

## What we will build

A backend integration that:

1. Provisions a StarLine Gas account on Kanall and configures the environment
2. Assigns a dedicated NUBAN to each distributor at onboarding
3. Handles Kanall's payment webhooks to clear invoices and release credit holds in real time
4. Runs a daily reconciliation report per route to give finance a clean summary

## Prerequisites

- A registered Kanall tenant with an API key — [sign up at www.kanall-app.online](https://www.kanall-app.online) or see the [Quick Start](../quickstart)
- A backend capable of receiving HTTP POST requests (Node.js/Express examples shown)
- A publicly reachable webhook URL — use [ngrok](https://ngrok.com) for local testing

## Tutorial steps

1. [Set up your environment](./01-setup) — set up your Kanall tenant and API client
2. [Provision distributor accounts](./02-provision-accounts) — assign a NUBAN to each distributor
3. [Receive payment webhooks](./03-receive-payments) — handle and verify payment events in your backend
4. [Reconcile and report](./04-reconcile) — query balances and generate daily route collection reports
5. [Settlement](./05-settle) — look up accounts, verify recipients, and initiate outbound bank transfers
