---
id: customers
title: Customers API
sidebar_label: Customers
---

# Customers API

A **Customer** is the end-user entity linked to one or more virtual accounts. Customers hold KYC tier state as defined by CBN guidelines. When you provision a virtual account, Kanall automatically creates or reuses a customer record keyed on `externalRef`.

See [KYC concepts](../concepts/kyc) for the full tier model and CBN transaction limits.

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
curl https://api.kanall.dev/v1/customers \
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
curl https://api.kanall.dev/v1/customers/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
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
| `NINLast4` | Last 4 digits of the NIN on record, or `null` if not yet upgraded |
| `KYCTier` | CBN KYC tier: `1`, `2`, or `3` |
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
curl -X PATCH https://api.kanall.dev/v1/customers/a1b2c3d4-... \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Emeka Chukwuemeka Okafor"}'
```

**Response:** `200 OK` — Updated customer object

---

## Upgrade KYC tier

```
POST /v1/customers/:id/kyc
```

Submits the customer's NIN to upgrade their CBN KYC tier from Tier 1 to Tier 2. This unlocks higher transaction and balance limits.

**Requirements:**
- Customer must currently be at Tier 1 (BVN on file, NIN not yet submitted)
- NIN must be exactly 11 digits

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `nin` | string | Yes | Customer's 11-digit National Identification Number |

```bash
curl -X POST https://api.kanall.dev/v1/customers/a1b2c3d4-.../kyc \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"nin": "12345678901"}'
```

**Response:** `200 OK` — Updated customer object with `KYCTier: 2`

```json
{
  "ID": "a1b2c3d4-...",
  "KYCTier": 2,
  "NINLast4": "8901",
  ...
}
```

**Error responses:**

| Status | Error | Reason |
|---|---|---|
| `400` | `NIN must be exactly 11 digits` | Invalid NIN format |
| `409` | `customer is already at tier 2 or above` | NIN already on file |

To reach Tier 3 (full KYC — ID document + proof of address), contact support. Tier 3 is not self-service in the current version.
