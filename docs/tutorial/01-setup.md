---
id: 01-setup
title: "Step 1: Register and Configure"
sidebar_label: "1. Setup"
---

# Step 1: Register and Configure

## Register your tenant

Call the registration endpoint once. This is a one-time setup for PrimeLine Distribution as an organisation.

```bash
curl -X POST https://kanall.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PrimeLine Distribution",
    "email": "ops@primeline.ng",
    "password": "your-secure-password"
  }'
```

**Response:**

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "kan_sk_4a3b2c1d9e8f7a6b5c4d3e2f1a0b...",
  "warning": "Store this API key securely — it will not be shown again."
}
```

:::danger Copy your API key now
Kanall stores only a hash. Once this response is closed, the raw key is gone. If you lose it, you will need to contact support for rotation.
:::

## Configure your environment

Add the API key to your backend's environment variables — never in source code.

```bash
# .env
KANALL_API_KEY=kan_sk_4a3b2c1d9e8f7a6b5c4d3e2f1a0b...
KANALL_BASE_URL=https://kanall.onrender.com
WEBHOOK_SECRET=your-webhook-validation-token  # optional internal use
```

Load it in your Node.js backend:

```js
// config.js
require('dotenv').config()

module.exports = {
  kanallApiKey: process.env.KANALL_API_KEY,
  kanallBaseUrl: process.env.KANALL_BASE_URL,
}
```

## Create a Kanall API client

A thin helper to avoid repeating auth headers:

```js
// kanall.js
const { kanallApiKey, kanallBaseUrl } = require('./config')

async function kanallRequest(method, path, body) {
  const res = await fetch(`${kanallBaseUrl}${path}`, {
    method,
    headers: {
      'X-API-Key': kanallApiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error ?? `Kanall error: ${res.status}`)
  }

  return data
}

module.exports = { kanallRequest }
```

## Verify your setup

```bash
curl https://kanall.onrender.com/health
# { "status": "ok" }

curl https://kanall.onrender.com/auth/me \
  # Note: /auth/me requires dashboard session cookie, not API key
  # Use /v1/accounts for API key verification:

curl https://kanall.onrender.com/v1/accounts \
  -H "X-API-Key: $KANALL_API_KEY"
# { "accounts": [], "pagination": { "hasMore": false } }
```

An empty accounts list means your key is valid and you are ready for the next step.

---

**Next:** [Provision retailer accounts →](./02-provision-accounts)
