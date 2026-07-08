---
id: 01-setup
title: "Step 1: Configure Your Environment"
sidebar_label: "1. Setup"
---

# Step 1: Configure Your Environment

## Get your API key

If you haven't already, sign up at **[www.kanall-app.online](https://www.kanall-app.online)**. After email verification your API key is shown once — copy it.

Prefer the API? Register programmatically:

```bash
curl -X POST https://kanall.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "StarLine Gas",
    "email": "ops@starlinegas.ng",
    "password": "your-secure-password"
  }'
```

Then verify the OTP sent to your email:

```bash
curl -X POST https://kanall.onrender.com/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "otp": "847291"
  }'
```

**Response:**

```json
{
  "apiKey": "ten_sk_4a3b2c1d...",
  "warning": "Store this API key securely — it will not be shown again."
}
```

:::danger Copy your API key now
Kanall stores only a one-way hash. Once this response is closed, the raw key is gone. Rotate it from the dashboard at any time — but you cannot retrieve it.
:::

## Configure your environment

Add the API key to your backend's environment — never in source code.

```bash
# .env
KANALL_API_KEY=ten_sk_4a3b2c1d...
KANALL_BASE_URL=https://kanall.onrender.com
```

```js
// config.js
require('dotenv').config()

module.exports = {
  kanallApiKey: process.env.KANALL_API_KEY,
  kanallBaseUrl: process.env.KANALL_BASE_URL,
}
```

## Create a Kanall API client

A thin helper to avoid repeating auth headers across your integration:

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

## Set your webhook URL

Tell Kanall where to send payment notifications. Do this once — every virtual account you provision will deliver to this endpoint automatically.

```bash
curl -X POST https://kanall.onrender.com/auth/webhook-url \
  -H "X-API-Key: $KANALL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://app.starlinegas.ng/webhooks/kanall"}'
```

For local development, use an ngrok tunnel URL here and update it as needed. Individual accounts can override this URL with their own `callbackUrl` — useful when testing a single account against a local tunnel while keeping production accounts on the main URL.

## Verify your setup

```bash
curl https://kanall.onrender.com/v1/accounts \
  -H "X-API-Key: $KANALL_API_KEY"
# { "accounts": [], "pagination": { "hasMore": false } }
```

An empty accounts list means your key is valid and you are ready for the next step.

---

**Next:** [Provision distributor accounts →](./02-provision-accounts)
