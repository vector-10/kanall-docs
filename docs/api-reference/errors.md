---
id: errors
title: Errors
sidebar_label: Errors
---

# Errors

## A note on field casing

Kanall's API response fields use **PascalCase** (`AccountRef`, `BankAccountName`, `Status`). This is Go's default JSON marshalling behaviour. Request bodies use **camelCase** (`externalRef`, `callbackUrl`, `expectedAmount`). The asymmetry is intentional — inputs are camelCase, outputs are PascalCase — and is consistent across every endpoint.

---

## Error format

All errors return a JSON body with a single `error` field:

```json
{
  "error": "human-readable error message"
}
```

There are no nested error objects, no error codes, no arrays. The `error` string is safe to display to a developer — not to end users.

## HTTP status codes

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created (account provisioned) |
| `400 Bad Request` | Invalid request body — missing required field, invalid format |
| `401 Unauthorized` | Missing or invalid `X-API-Key` |
| `403 Forbidden` | Valid key but access denied (e.g. cross-tenant access attempt) |
| `404 Not Found` | Account not found, or does not belong to this tenant |
| `409 Conflict` | `externalRef` already exists for this tenant |
| `422 Unprocessable Entity` | Business rule violation (e.g. invalid lifecycle transition) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |
| `502 Bad Gateway` | Nomba API returned an unexpected response |

## Common errors

### Missing API key

```
GET /v1/accounts
```

```json
HTTP/1.1 401 Unauthorized

{
  "error": "unauthorized"
}
```

---

### Account not found

```
GET /v1/accounts/nonexistent-ref
```

```json
HTTP/1.1 404 Not Found

{
  "error": "account not found"
}
```

---

### Duplicate externalRef

```
POST /v1/accounts
{ "externalRef": "driver-001", "name": "..." }
```

```json
HTTP/1.1 409 Conflict

{
  "error": "account with this reference already exists"
}
```

---

### Invalid lifecycle transition

```
POST /v1/accounts/driver-001/expire
(account is already "expired")
```

```json
HTTP/1.1 422 Unprocessable Entity

{
  "error": "account is not active"
}
```

---

### Rate limit exceeded

```json
HTTP/1.1 429 Too Many Requests

{
  "error": "rate limit exceeded"
}
```

Back off and retry after the interval specified in the `Retry-After` header.

---

### Nomba provider error

```json
HTTP/1.1 502 Bad Gateway

{
  "error": "provider error: failed to provision virtual account"
}
```

This typically means a transient issue with Nomba's sandbox or production API. Retry with exponential backoff.
