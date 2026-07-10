---
id: 01-setup
title: "Step 1: Configure Your Environment"
sidebar_label: "1. Setup"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Step 1: Configure Your Environment

## Get your API key

Sign up at **[www.kanall-app.online](https://www.kanall-app.online)**. After email verification your API key is shown once — copy it.

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

---

## Configure your environment

Add the API key to your backend's environment — never in source code.

```bash
# .env
KANALL_API_KEY=ten_sk_4a3b2c1d...
KANALL_BASE_URL=https://kanall.onrender.com
```

---

## Create a Kanall API client

A thin wrapper around HTTP so you never repeat auth headers across your integration. Copy the version that matches your stack:

<Tabs>
<TabItem value="js" label="JavaScript">

```js
// kanall.js
const BASE_URL = process.env.KANALL_BASE_URL || 'https://kanall.onrender.com'
const API_KEY  = process.env.KANALL_API_KEY

async function kanall(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-API-Key': API_KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error ?? `Kanall error ${res.status}`)
  }

  return data
}

module.exports = { kanall }
```

Usage:

```js
const { kanall } = require('./kanall')

const account = await kanall('POST', '/v1/accounts', {
  externalRef: 'distributor-emeka',
  name: 'Emeka Okafor',
})
```

</TabItem>
<TabItem value="python" label="Python">

```python
# kanall.py
import os
import requests

BASE_URL = os.environ.get('KANALL_BASE_URL', 'https://kanall.onrender.com')
API_KEY  = os.environ['KANALL_API_KEY']

session = requests.Session()
session.headers.update({'X-API-Key': API_KEY})

def kanall(method: str, path: str, body: dict = None):
    res = session.request(method, BASE_URL + path, json=body)
    res.raise_for_status()
    return res.json()
```

Usage:

```python
from kanall import kanall

account = kanall('POST', '/v1/accounts', {
    'externalRef': 'distributor-emeka',
    'name': 'Emeka Okafor',
})
```

</TabItem>
<TabItem value="go" label="Go">

```go
// kanall/client.go
package kanall

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

var (
    baseURL = getEnv("KANALL_BASE_URL", "https://kanall.onrender.com")
    apiKey  = os.Getenv("KANALL_API_KEY")
)

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}

func Request(ctx context.Context, method, path string, body any, out any) error {
    var bodyReader io.Reader
    if body != nil {
        b, _ := json.Marshal(body)
        bodyReader = bytes.NewReader(b)
    }

    req, err := http.NewRequestWithContext(ctx, method, baseURL+path, bodyReader)
    if err != nil {
        return err
    }
    req.Header.Set("X-API-Key", apiKey)
    if body != nil {
        req.Header.Set("Content-Type", "application/json")
    }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        var e struct{ Error string `json:"error"` }
        json.NewDecoder(resp.Body).Decode(&e)
        return fmt.Errorf("kanall %d: %s", resp.StatusCode, e.Error)
    }

    return json.NewDecoder(resp.Body).Decode(out)
}
```

Usage:

```go
var account struct {
    BankAccountNumber string
    AccountRef        string
}
err := kanall.Request(ctx, "POST", "/v1/accounts", map[string]string{
    "externalRef": "distributor-emeka",
    "name":        "Emeka Okafor",
}, &account)
```

</TabItem>
<TabItem value="java" label="Java">

```java
// KanallClient.java
import java.net.URI;
import java.net.http.*;
import java.net.http.HttpResponse.BodyHandlers;

public class KanallClient {
    private static final String BASE_URL =
        System.getenv().getOrDefault("KANALL_BASE_URL", "https://kanall.onrender.com");
    private static final String API_KEY =
        System.getenv("KANALL_API_KEY");

    private final HttpClient http = HttpClient.newHttpClient();

    public String request(String method, String path, String jsonBody) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + path))
            .header("X-API-Key", API_KEY)
            .header("Content-Type", "application/json");

        if (jsonBody != null) {
            builder.method(method, HttpRequest.BodyPublishers.ofString(jsonBody));
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }

        HttpResponse<String> response = http.send(builder.build(), BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new RuntimeException("Kanall error " + response.statusCode() + ": " + response.body());
        }

        return response.body(); // parse with your JSON library (Gson, Jackson, etc.)
    }
}
```

Usage (with Gson):

```java
KanallClient kanall = new KanallClient();
String json = kanall.request("POST", "/v1/accounts",
    "{\"externalRef\":\"distributor-emeka\",\"name\":\"Emeka Okafor\"}");
JsonObject account = JsonParser.parseString(json).getAsJsonObject();
System.out.println(account.get("BankAccountNumber").getAsString());
```

</TabItem>
</Tabs>

---

## Set your webhook URL

Tell Kanall where to send payment notifications. Do this once — every virtual account you provision will deliver to this endpoint automatically.

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { kanall } = require('./kanall')

await kanall('POST', '/auth/webhook-url', {
  url: 'https://app.starlinegas.ng/webhooks/kanall',
})
```

</TabItem>
<TabItem value="python" label="Python">

```python
from kanall import kanall

kanall('POST', '/auth/webhook-url', {
    'url': 'https://app.starlinegas.ng/webhooks/kanall',
})
```

</TabItem>
<TabItem value="go" label="Go">

```go
var result map[string]any
kanall.Request(ctx, "POST", "/auth/webhook-url", map[string]string{
    "url": "https://app.starlinegas.ng/webhooks/kanall",
}, &result)
```

</TabItem>
<TabItem value="java" label="Java">

```java
kanall.request("POST", "/auth/webhook-url",
    "{\"url\":\"https://app.starlinegas.ng/webhooks/kanall\"}");
```

</TabItem>
</Tabs>

For local development, put your ngrok tunnel URL here and update it whenever the tunnel changes. Individual accounts can override this URL with their own `callbackUrl` — useful when testing a single account locally while production accounts remain on the main endpoint.

---

## Verify your setup

<Tabs>
<TabItem value="js" label="JavaScript">

```js
const { kanall } = require('./kanall')

const result = await kanall('GET', '/v1/accounts')
console.log(result) // { accounts: [], pagination: { hasMore: false } }
```

</TabItem>
<TabItem value="python" label="Python">

```python
from kanall import kanall

result = kanall('GET', '/v1/accounts')
print(result)  # {'accounts': [], 'pagination': {'hasMore': False}}
```

</TabItem>
<TabItem value="go" label="Go">

```go
var result map[string]any
kanall.Request(ctx, "GET", "/v1/accounts", nil, &result)
fmt.Println(result)
```

</TabItem>
<TabItem value="java" label="Java">

```java
String result = kanall.request("GET", "/v1/accounts", null);
System.out.println(result);
// {"accounts":[],"pagination":{"hasMore":false}}
```

</TabItem>
</Tabs>

An empty accounts list means your key is valid and you are ready for the next step.

---

**Next:** [Provision distributor accounts →](./02-provision-accounts)
