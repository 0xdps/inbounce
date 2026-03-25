# Inbounce — Integration Guide

## How it works

1. **Create an app** in the dashboard → get an `api_key`
2. **Define a schema** — the fields you expect (name, type, required, unique)
3. **Submit data** — `POST /s/<api_key>` from anywhere: plain HTML form, JS fetch, curl

---

## The submission endpoint

```
POST https://<your-inbounce-domain>/s/<api_key>
```

- **Public** — no auth header needed
- **Rate limited** — 30 requests / minute per IP per app
- The `api_key` is a public form identifier, not a secret

---

## Option 1 — Plain HTML form (no JavaScript)

```html
<form action="https://<your-inbounce-domain>/s/<api_key>" method="POST">
  <input type="text"  name="name"    placeholder="Your name"  required />
  <input type="email" name="email"   placeholder="Email"      required />
  <textarea           name="message" placeholder="Message"    required></textarea>

  <!-- Honeypot: hidden field, leave empty. Bots fill it, we discard silently. -->
  <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off" />

  <button type="submit">Send</button>
</form>
```

> When submitted, the browser POSTs `application/x-www-form-urlencoded` data. Fastify parses this natively.

**After submission** the browser follows the default form redirect. To show a thank-you page, add:

```html
<form action="https://<your-inbounce-domain>/s/<api_key>" method="POST"
      onsubmit="handleSubmit(event)">
```

or just redirect after a successful JSON response (see Option 2).

---

## Option 2 — JavaScript fetch (JSON)

```js
const res = await fetch('https://<your-inbounce-domain>/s/<api_key>', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name:    'Alice',
    email:   'alice@example.com',
    message: 'Hello!',
  }),
});

const { ok, id } = await res.json();
// ok: true, id: "uuid-of-submission"
```

---

## Option 3 — React / Next.js

```jsx
async function handleSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));

  const res = await fetch('https://<your-inbounce-domain>/s/<api_key>', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (res.ok) {
    alert('Submitted!');
  } else {
    const { error } = await res.json();
    alert(error);
  }
}

export default function ContactForm() {
  return (
    <form onSubmit={handleSubmit}>
      <input name="name"    required />
      <input name="email"   type="email" required />
      <textarea name="message" required />
      <button type="submit">Send</button>
    </form>
  );
}
```

---

## Option 4 — curl (testing)

```bash
curl -X POST https://<your-inbounce-domain>/s/<api_key> \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","message":"Hello!"}'
```

---

## Deduplication (idempotency key)

Send an `Idempotency-Key` header to prevent duplicate submissions (e.g. double-clicks, network retries).

```js
await fetch('https://<your-inbounce-domain>/s/<api_key>', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(), // generate once per form load
  },
  body: JSON.stringify(data),
});
```

If the same key is submitted again, the server returns `201` with the original submission ID — no duplicate created.

---

## CORS

By default, submissions are accepted from **any origin**.

To restrict to specific origins, go to the app settings in the dashboard and add your allowed origins (e.g. `https://yoursite.com`). Requests from unlisted origins will get a `403`.

> CORS is enforced by the browser. Server-to-server calls (curl, backend code) bypass CORS — that's expected.

---

## Honeypot (bot protection)

Add a hidden field named `_hp` to your form. Leave it empty. Real users never fill it; bots do. Submissions with `_hp` set are silently accepted (fake `201`) but never stored.

```html
<input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off" />
```

---

## Field types & validation

| Type | Validation |
|---|---|
| `string` | Non-empty, max 10,000 chars |
| `email` | Valid email format |
| `number` | Coerced from string if needed |
| `boolean` | Coerced (`"true"` → `true`) |
| `url` | Valid URL |
| `date` | Parseable date string |

Fields marked **required** — missing or empty → `400`.  
Fields marked **unique** — duplicate value in existing submissions → `409`.

Sending fields not defined in your schema → `400` (strict mode).

---

## Response codes

| Status | Meaning |
|---|---|
| `201` | Submission stored. `{ ok: true, id: "uuid" }` |
| `400` | Validation failed. `{ error: "..." }` |
| `403` | Origin not in allowed list |
| `404` | `api_key` not found |
| `409` | Schema not defined yet / unique field duplicate |
| `413` | Body > 16KB |
| `429` | Rate limit hit (30/min per IP per app) |

---

## What gets stored automatically

You don't need to send these — they're captured from the request:

| Field | Source |
|---|---|
| `ip` | Client IP (resolved through Caddy via `X-Forwarded-For`) |
| `meta.ua` | `User-Agent` header (browser & OS info) |
| `meta.referrer` | `Referer` header (the page the form was on) |

View these in the dashboard — hover the **IP / UA** column on any submission row.

---

## Limits

| Limit | Value |
|---|---|
| Max fields per schema | 50 |
| Max fields in a submission | 50 |
| Max field value length | 10,000 chars |
| Max body size | 16KB |
| Rate limit | 30 submissions / min / IP / app |
