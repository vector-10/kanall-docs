---
id: kyc
title: KYC & Identity
sidebar_label: KYC & Identity
---

# KYC & Identity

Kanall handles two separate KYC questions: *is your company legitimate?* (business KYC, at the tenant level) and *who is this individual paying into the account?* (customer KYC, at the per-customer level). These are tracked independently and do not interfere with each other.

---

## Layer 1 — Tenant business KYC

Every tenant (your company) has a `kycStatus` that reflects your business verification state:

| Status | Meaning |
|---|---|
| `unverified` | Default on registration. No business details submitted. |
| `pending_review` | Business details submitted, awaiting manual review. |
| `verified` | Business verified. Full access to all features. |

To verify your business, submit `POST /auth/business-kyc` with your business type and optional CAC number. See [Authentication — Submit business KYC](../api-reference/authentication#submit-business-kyc).

---

## Layer 2 — Customer CBN KYC tiers

Every customer in your system holds a `KYCTier` (1, 2, or 3) as mandated by the Central Bank of Nigeria (CBN) tiered KYC framework. The tier determines the customer's transaction and balance limits.

### Tier 1 — BVN only

- **Requirement:** Bank Verification Number (BVN)
- **Set automatically** when you provision a virtual account with a `bvn` field
- **Daily transaction limit:** ₦50,000
- **Maximum balance:** ₦300,000

Tier 1 is the default for customers who provide a BVN at account provision time.

### Tier 2 — BVN + NIN

- **Requirement:** BVN on file **and** National Identification Number (NIN)
- **Initiated via** `POST /v1/customers/:id/kyc` by your backend
- **Verified via Mono Identity** — if verification succeeds, tier bumps to 2 immediately; if the service is unavailable, submission falls back to `pending_review` for operator approval
- **Daily transaction limit:** ₦200,000
- **Maximum balance:** ₦500,000

:::note Mono Identity is in demo mode
NIN verification is currently powered by Mono Identity in demo mode. Submitting a NIN returns a simulated verification result — it is not checking real government records. This will be upgraded to production Mono access post-hackathon.
:::

### Tier 3 — Full KYC

- **Requirement:** BVN + NIN + government-issued ID + proof of address
- **Set by:** Operator (contact support) — not self-service
- **Daily transaction limit:** ₦5,000,000
- **Maximum balance:** No cap

Tier 3 is intended for high-value business customers. Document upload and operator review is required.

---

## KYC status machine

Every customer has a `KYCStatus` field that tracks the lifecycle of their Tier 2 upgrade submission. This is separate from `KYCTier`.

```
none → pending_review → approved   (KYCTier bumps to 2)
                     → rejected    (KYCTier stays at 1, resubmission allowed)
```

| Status | Meaning |
|---|---|
| `none` | No NIN submitted yet. Tier 2 upgrade available. |
| `pending_review` | NIN submitted, awaiting operator approval. Resubmission blocked. |
| `approved` | NIN verified (auto or operator). `KYCTier` is now `2`. |
| `rejected` | Operator rejected. Customer may resubmit with a corrected NIN. |

---

## Summary table

| Tier | Identity documents | Daily limit | Balance cap |
|---|---|---|---|
| 1 | BVN | ₦50,000 | ₦300,000 |
| 2 | BVN + NIN (approved) | ₦200,000 | ₦500,000 |
| 3 | BVN + NIN + Full docs | ₦5,000,000 | None |

---

## How tiers are enforced

Kanall records and reports the tier. The actual transaction limit enforcement happens at Nomba's payment rail level — Kanall does not block payments in transit based on tier. Your application can use the tier to gate certain actions (e.g. prevent provisioning a new account for a customer who hasn't upgraded) but limits are ultimately enforced by the underlying infrastructure.

---

## Security

Identity documents are stored encrypted. Only the last 4 digits of a BVN or NIN (`BVNLast4`, `NINLast4`) are returned in API responses. The raw values cannot be recovered from the API under any circumstances.
