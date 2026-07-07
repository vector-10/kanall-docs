---
id: customers
title: Customers API
sidebar_label: Customers
---

# Customers API

A **Customer** is the end-user entity linked to one or more virtual accounts. Customers hold KYC tier state as defined by CBN guidelines. When you provision a virtual account, Kanall automatically creates or reuses a customer record keyed on `externalRef`.

See [KYC concepts](../concepts/kyc) for the full tier model, CBN transaction limits, and the KYC status machine.

---

## List customers

```
GET /v1/customers
GET /v1/customers?after={cursor}
```

Returns a paginated list of customers for the authenticated tenant.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `after` | string | Cursor for next page — value of `nextCursor` from previous response |

```bash
curl https://kanall.onrender.com/v1/customers \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK`

```json
{
  "customers": [
    {
      "ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "TenantID": "550e8400-e29b-41d4-a716-446655440000",
      "ExternalRef": "driver-001",
      "Name": "Emeka Okafor",
      "BVNLast4": "8901",
      "NINLast4": null,
      "KYCTier": 1,
      "KYCStatus": "none",
      "Status": "active",
      "CreatedAt": "2026-07-01T10:30:00Z",
      "UpdatedAt": "2026-07-01T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "b2c3d4e5-...",
    "hasMore": false
  }
}
```

---

## Get a single customer

```
GET /v1/customers/:id
```

Returns a single customer by Kanall's internal UUID.

```bash
curl https://kanall.onrender.com/v1/customers/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "X-API-Key: ten_sk_..."
```

**Response:** `200 OK` — Customer object

---

## Customer fields

| Field | Description |
|---|---|
| `ID` | Kanall's internal UUID for this customer |
| `TenantID` | The tenant who owns this customer record |
| `ExternalRef` | Your stable identifier (matches the `externalRef` used at account provision time) |
| `Name` | Customer display name |
| `BVNLast4` | Last 4 digits of the BVN on record, or `null` if not provided |
| `NINLast4` | Last 4 digits of the NIN on record, or `null` if not yet submitted |
| `KYCTier` | CBN KYC tier: `1`, `2`, or `3` |
| `KYCStatus` | KYC submission status: `none`, `pending_review`, `approved`, or `rejected` — see [KYC status machine](../concepts/kyc#kyc-status-machine) |
| `Status` | Customer status: `active` or `suspended` |

Full BVN and NIN values are never returned — only the last 4 digits for display purposes. The raw values are stored encrypted (AES-256-GCM).

---

## Rename a customer

```
PATCH /v1/customers/:id
```

Updates the customer's display name.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | New display name for the customer |

```bash
curl -X PATCH https://kanall.onrender.com/v1/customers/a1b2c3d4-... \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Emeka Chukwuemeka Okafor"}'
```

**Response:** `200 OK` — Updated customer object

---

## Submit KYC upgrade (Tier 1 → Tier 2)

```
POST /v1/customers/:id/kyc
```

Submits the customer's NIN and a document image for Tier 2 review. This does **not** immediately upgrade the tier — it sets `KYCStatus` to `pending_review` and queues the submission for operator approval.

**Requirements:**
- Customer must currently be at Tier 1 with `KYCStatus` of `none` or `rejected`
- NIN must be exactly 11 digits
- Document must be a base64-encoded image or PDF

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `nin` | string | Yes | Customer's 11-digit National Identification Number |
| `nin_document` | string | Yes | Base64-encoded NIN slip or government-issued ID image |

```bash
curl -X POST https://kanall.onrender.com/v1/customers/a1b2c3d4-.../kyc \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "nin": "12345678901",
    "nin_document": "<base64-encoded image>"
  }'
```

**Response:** `200 OK` — Customer object with `KYCStatus: "pending_review"`

```json
{
  "ID": "a1b2c3d4-...",
  "KYCTier": 1,
  "KYCStatus": "pending_review",
  "NINLast4": "8901"
}
```

:::note
The tier is **not bumped to 2 at this point**. The customer remains at Tier 1 until an operator approves the submission via the admin endpoints below.
:::

**Error responses:**

| Status | Error | Reason |
|---|---|---|
| `400` | `NIN must be exactly 11 digits` | Invalid NIN format |
| `400` | `nin_document is required` | Document not included in request |
| `409` | `KYC already pending review` | A submission is already awaiting approval |

---

## Approve KYC submission (admin)

```
POST /auth/customers/:id/kyc/approve
```

Approves a pending KYC submission. Sets `KYCTier` to `2` and `KYCStatus` to `approved`. Requires session authentication (dashboard operator).

**Requirements:**
- `KYCStatus` must be `pending_review`

```bash
curl -X POST https://kanall.onrender.com/auth/customers/a1b2c3d4-.../kyc/approve \
  -H "Cookie: session=..." 
```

**Response:** `200 OK` — Updated customer object with `KYCTier: 2`, `KYCStatus: "approved"`

**Error responses:**

| Status | Error | Reason |
|---|---|---|
| `400` | `customer is not pending review` | `KYCStatus` is not `pending_review` |
| `404` | `customer not found` | Invalid customer ID |

---

## Reject KYC submission (admin)

```
POST /auth/customers/:id/kyc/reject
```

Rejects a pending KYC submission. Sets `KYCStatus` to `rejected`. The customer may resubmit after rejection. Requires session authentication (dashboard operator).

**Requirements:**
- `KYCStatus` must be `pending_review`

```bash
curl -X POST https://kanall.onrender.com/auth/customers/a1b2c3d4-.../kyc/reject \
  -H "Cookie: session=..."
```

**Response:** `200 OK` — Updated customer object with `KYCStatus: "rejected"`

**Error responses:**

| Status | Error | Reason |
|---|---|---|
| `400` | `customer is not pending review` | `KYCStatus` is not `pending_review` |
| `404` | `customer not found` | Invalid customer ID |

---

To reach Tier 3 (full KYC — ID document + proof of address), contact support. Tier 3 is not self-service in the current version.
