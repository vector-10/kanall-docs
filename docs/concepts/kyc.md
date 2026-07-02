---
id: kyc
title: KYC & Identity
sidebar_label: KYC & Identity
---

# KYC & Identity

Kanall implements a two-layer KYC model: business verification at the **tenant** level, and CBN-mandated tiered identity at the **customer** level.

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

Tier 1 is the default for customers who provide a BVN at account provision time. Without a BVN, the customer starts at Tier 0 (no limit enforcement by Kanall, but subject to Nomba rails defaults).

### Tier 2 — BVN + NIN

- **Requirement:** BVN on file **and** National Identification Number (NIN)
- **Set via** `POST /v1/customers/:id/kyc` by your backend
- **Daily transaction limit:** ₦200,000
- **Maximum balance:** ₦500,000

To upgrade a customer to Tier 2:

```bash
curl -X POST https://api.kanall.dev/v1/customers/a1b2c3d4-.../kyc \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"nin": "12345678901"}'
```

The NIN is stored encrypted (AES-256-GCM). Only the last 4 digits (`NINLast4`) are returned in API responses. The upgrade from Tier 1 to Tier 2 is your responsibility — Kanall records the tier, Nomba enforces the limits at the payment rail level.

### Tier 3 — Full KYC

- **Requirement:** BVN + NIN + government-issued ID + proof of address
- **Set by:** Operator (contact support) — not self-service
- **Daily transaction limit:** ₦5,000,000
- **Maximum balance:** No cap

Tier 3 is intended for high-value business customers. Document upload and operator review is required.

---

## Summary table

| Tier | Identity documents | Daily limit | Balance cap |
|---|---|---|---|
| 1 | BVN | ₦50,000 | ₦300,000 |
| 2 | BVN + NIN | ₦200,000 | ₦500,000 |
| 3 | BVN + NIN + Full docs | ₦5,000,000 | None |

---

## How tiers are enforced

Kanall records and reports the tier. The actual transaction limit enforcement happens at Nomba's payment rail level — Kanall does not block payments in transit based on tier. Your application can use the tier to gate certain actions (e.g. prevent provisioning a new account for a customer who hasn't upgraded) but limits are ultimately enforced by the underlying infrastructure.

---

## Security

- BVN and NIN values are stored encrypted with AES-256-GCM. The encryption key is set via the `ENCRYPTION_KEY` environment variable — never hardcoded.
- Only the last 4 digits (`BVNLast4`, `NINLast4`) are returned in API responses.
- The raw values cannot be recovered from the API under any circumstances.
