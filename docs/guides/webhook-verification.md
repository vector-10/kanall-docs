---
id: webhook-verification
title: Webhook Signature Verification
sidebar_label: Webhook Verification
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Webhook Signature Verification

Every outbound webhook delivery from Kanall includes a cryptographic signature in the `X-Kanall-Signature` header. Verifying this signature before processing the payload protects your system from forged requests and replay attacks.

This guide covers the full verification flow with production-ready code in JavaScript, Python, Go, and Java.

---

## How the signature works

When Kanall sends a webhook to your endpoint, it:

1. Takes the raw JSON payload as a byte string
2. Combines it with a Unix timestamp: `{timestamp}.{payload}`
3. Computes HMAC-SHA256 of that string using your per-tenant secret
4. Sends the result as: `X-Kanall-Signature: t={timestamp},v1={hex_encoded_hmac}`

**Your verification steps:**

1. Extract `t` and `v1` from the header
2. Reject if the timestamp is more than 5 minutes old (replay protection)
3. Build the same signed string: `{t}.{raw_request_body}`
4. Compute HMAC-SHA256 with your secret
5. Compare your computed hex against `v1` using a constant-time comparison

---

## Get your webhook secret

Retrieve your secret once from the API and store it in your environment. Calling this endpoint again returns the same secret — it does not rotate it.

```bash
curl -X POST https://kanall.onrender.com/auth/webhook-secret
# Requires a valid session cookie (dashboard login)
```

```json
{
  "webhookSecret": "a3f8b2c9d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a2"
}
```

Store it as `KANALL_WEBHOOK_SECRET` in your environment. Never commit it to version control.

---

## Verification function

<Tabs>
<TabItem value="js" label="JavaScript">

```js
// kanall-verify.js
const crypto = require('crypto')

/**
 * Verifies an X-Kanall-Signature header against the raw request body.
 *
 * @param {Buffer|string} rawBody     - The raw, unparsed request body
 * @param {string}        sigHeader   - Value of the X-Kanall-Signature header
 * @param {string}        secret      - Your KANALL_WEBHOOK_SECRET
 * @returns {boolean}
 */
function verifyKanallSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false

  const parts = Object.fromEntries(
    sigHeader.split(',').map(p => {
      const idx = p.indexOf('=')
      return [p.slice(0, idx), p.slice(idx + 1)]
    })
  )

  const timestamp   = parts['t']
  const receivedSig = parts['v1']

  if (!timestamp || !receivedSig) return false

  // Reject if more than 5 minutes old — protects against replay attacks
  const ageSeconds = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10))
  if (ageSeconds > 300) return false

  const signedString = `${timestamp}.${rawBody}`
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedString)
    .digest('hex')

  // Constant-time comparison — prevents timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(receivedSig.padEnd(expected.length, '0'), 'hex').slice(0, expected.length)
    )
  } catch {
    return false
  }
}

module.exports = { verifyKanallSignature }
```

</TabItem>
<TabItem value="python" label="Python">

```python
# kanall_verify.py
import hmac
import hashlib
import time


def verify_kanall_signature(raw_body: bytes, sig_header: str, secret: str) -> bool:
    """
    Verifies an X-Kanall-Signature header against the raw request body.

    Args:
        raw_body:   The raw, unparsed request body as bytes
        sig_header: Value of the X-Kanall-Signature header
        secret:     Your KANALL_WEBHOOK_SECRET

    Returns:
        True if the signature is valid, False otherwise
    """
    if not sig_header:
        return False

    try:
        parts = dict(p.split('=', 1) for p in sig_header.split(','))
    except ValueError:
        return False

    timestamp    = parts.get('t')
    received_sig = parts.get('v1')

    if not timestamp or not received_sig:
        return False

    # Reject if more than 5 minutes old — protects against replay attacks
    try:
        age = abs(time.time() - int(timestamp))
    except ValueError:
        return False

    if age > 300:
        return False

    signed_string = f"{timestamp}.{raw_body.decode('utf-8')}"
    expected = hmac.new(
        secret.encode('utf-8'),
        signed_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison — prevents timing attacks
    return hmac.compare_digest(expected, received_sig)
```

</TabItem>
<TabItem value="go" label="Go">

```go
// kanallverify/verify.go
package kanallverify

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "math"
    "strconv"
    "strings"
    "time"
)

// VerifySignature verifies an X-Kanall-Signature header against the raw request body.
// rawBody must be the exact bytes received — before any JSON parsing.
// secret is your KANALL_WEBHOOK_SECRET environment variable.
func VerifySignature(rawBody []byte, sigHeader, secret string) bool {
    if sigHeader == "" {
        return false
    }

    parts := map[string]string{}
    for _, part := range strings.Split(sigHeader, ",") {
        idx := strings.IndexByte(part, '=')
        if idx < 0 {
            continue
        }
        parts[part[:idx]] = part[idx+1:]
    }

    timestamp, ok1 := parts["t"]
    receivedSig, ok2 := parts["v1"]
    if !ok1 || !ok2 {
        return false
    }

    ts, err := strconv.ParseInt(timestamp, 10, 64)
    if err != nil {
        return false
    }

    // Reject if more than 5 minutes old — protects against replay attacks
    if math.Abs(float64(time.Now().Unix()-ts)) > 300 {
        return false
    }

    signed := fmt.Sprintf("%s.%s", timestamp, string(rawBody))
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signed))
    expected := hex.EncodeToString(mac.Sum(nil))

    // Constant-time comparison — prevents timing attacks
    return hmac.Equal([]byte(expected), []byte(receivedSig))
}
```

</TabItem>
<TabItem value="java" label="Java">

```java
// KanallSignatureVerifier.java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

public class KanallSignatureVerifier {

    /**
     * Verifies an X-Kanall-Signature header against the raw request body.
     *
     * @param rawBody      The raw, unparsed request body as a string
     * @param sigHeader    Value of the X-Kanall-Signature header
     * @param secret       Your KANALL_WEBHOOK_SECRET
     * @return true if the signature is valid
     */
    public static boolean verify(String rawBody, String sigHeader, String secret)
            throws Exception {
        if (sigHeader == null || sigHeader.isEmpty()) return false;

        Map<String, String> parts = Arrays.stream(sigHeader.split(","))
            .map(p -> p.split("=", 2))
            .filter(kv -> kv.length == 2)
            .collect(Collectors.toMap(kv -> kv[0], kv -> kv[1]));

        String timestamp   = parts.get("t");
        String receivedSig = parts.get("v1");
        if (timestamp == null || receivedSig == null) return false;

        // Reject if more than 5 minutes old — protects against replay attacks
        long age = Math.abs(System.currentTimeMillis() / 1000L - Long.parseLong(timestamp));
        if (age > 300) return false;

        String signedString = timestamp + "." + rawBody;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes("UTF-8"), "HmacSHA256"));
        byte[] expectedBytes = mac.doFinal(signedString.getBytes("UTF-8"));
        String expected = HexFormat.of().formatHex(expectedBytes);

        // Constant-time comparison — prevents timing attacks
        return MessageDigest.isEqual(
            expected.getBytes("UTF-8"),
            receivedSig.getBytes("UTF-8")
        );
    }
}
```

</TabItem>
</Tabs>

---

## Wiring it into your handler

Once you have the verification function, call it at the top of your webhook endpoint before doing anything else. Full handler examples in all languages are in [Tutorial Step 3 — Receive Payment Webhooks](../tutorial/03-receive-payments).

The one rule that catches most developers: read the **raw byte body before your framework parses it**. Parsing changes whitespace and breaks the HMAC.

| Framework | Raw body access |
|---|---|
| Express (Node.js) | `express.raw({ type: 'application/json' })` — not `express.json()` |
| Django (Python) | `request.body` |
| Go net/http | `io.ReadAll(r.Body)` |
| Spring Boot (Java) | `@RequestBody byte[]` parameter |

---

## Common mistakes

### Verifying parsed JSON instead of the raw body

The most common reason signature verification fails is parsing the JSON body before verifying. Many frameworks re-format the JSON when they deserialise and re-serialise it — changing whitespace, field order, or encoding. This changes the byte content and breaks the HMAC.

**Always read the raw byte stream first, then parse after verification passes.**

| Framework | Raw body access |
|---|---|
| Express (Node.js) | `express.raw({ type: 'application/json' })` — not `express.json()` |
| Django (Python) | `request.body` |
| Go net/http | `io.ReadAll(r.Body)` before json.NewDecoder |
| Spring Boot (Java) | `@RequestBody byte[]` parameter |

### Sending the wrong body in tests

When testing with curl or Postman, the body must be byte-for-byte identical to what your server receives. If your test client compresses, re-formats, or re-encodes the body, the signature will not match.

### Clock skew

Kanall rejects timestamps more than 5 minutes old. If your server's clock is out of sync, valid webhooks will fail verification. Ensure your server uses NTP.

### Wrong secret

The secret from `POST /auth/webhook-secret` is your per-tenant outbound webhook signing secret. It is separate from any Nomba signing secrets and separate from your Kanall API key.

---

## Security checklist

Before going live:

- [ ] `KANALL_WEBHOOK_SECRET` is stored in an environment variable, not in source code
- [ ] You read the raw body **before** passing it to any JSON parser
- [ ] You use constant-time comparison (not `===` or `==`) when comparing HMACs
- [ ] You reject webhooks with timestamps older than 5 minutes
- [ ] Your webhook endpoint returns `200 OK` before doing any database writes
- [ ] You have an idempotency check on `transactionGroupId` to handle retries safely
