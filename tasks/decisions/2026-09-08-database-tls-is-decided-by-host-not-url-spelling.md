# Database TLS is decided by the host, and `sslmode` is stripped so `pg` cannot override it

**Decided:** 2026-09-08

`src/lib/server/prisma.ts` chose TLS by sniffing the connection string:

```ts
const isSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");
ssl: isSsl ? { rejectUnauthorized: false } : undefined,
```

The task that produced this entry asked only for `rejectUnauthorized: false` to be removed. Two
measurements changed the shape of the fix.

## `rejectUnauthorized: false` was already inert where it was written to apply

`pg` merges the *parsed* connection string **over** the explicit config object —
`node_modules/pg/lib/connection-parameters.js:60`,
`Object.assign({}, config, parse(config.connectionString))`. Observed with
`pg-connection-string@latest` in this tree:

| URL | `parse()` emits |
|---|---|
| `…neon.tech/neondb?sslmode=require` | `ssl: {}` |
| `…neon.tech/neondb?sslmode=verify-full` | `ssl: {}` |
| `…neon.tech/neondb` (no sslmode) | *no `ssl` key* |
| `…db.example.com:5432/x` | *no `ssl` key* |

So for a URL carrying `sslmode`, `ssl: {}` replaced `{ rejectUnauthorized: false }` and the
connection verified after all. **The setting nobody could see was doing nothing, which is why
nothing ever failed to reveal it.**

## The live defect was the opposite one

Where `parse()` emits no `ssl` key, the explicit config survives — so a `neon.tech` URL *without*
`sslmode` really did connect with verification disabled. Worse, a non-Neon managed Postgres matched
neither substring, got `ssl: undefined`, and crossed the public internet **unencrypted**.
Unverified TLS is bad; no TLS is worse, and it was the case the sniff handled most quietly.

## What was chosen

`resolveDatabaseSsl()` decides from `new URL(...).hostname`: loopback, `127.*`, and any
single-label host (`db`, `postgres` — Docker Compose names, which cannot be public DNS records) are
internal and keep the string byte-identical with `ssl: undefined`, so a local Postgres deliberately
serving TLS behaves exactly as before. Every dotted host gets `{ rejectUnauthorized: true }`, and
`sslmode`/`ssl`/`uselibpqcompat` are **deleted from the URL** first, so `parse()` emits no `ssl` key
and this module's policy survives the merge. An unparseable string fails closed.

Stripping is not tidiness — it is the only reason the explicit option takes effect. Removing that
one line makes `pg` yield `ssl: {}` again, which
`tests/unit/security/authSessionDal.test.ts` ("survives pg's own connection-string merge") was run
against and failed with `expected {} to deeply equal { rejectUnauthorized: true }`.

It also pins behaviour across the semantics change `pg-connection-string` now warns about at
runtime: in v3 / `pg` v9, `sslmode=require` stops being an alias for `verify-full` and adopts weaker
libpq semantics. Code that leans on the URL's spelling gets quietly downgraded on that upgrade.
Code that sets `ssl` explicitly does not.

**Rejected:** an opt-out env var (`DB_SSL_ALLOW_INVALID_CERT` or similar). An escape hatch is how
`rejectUnauthorized: false` returns, and a Neon certificate that fails to verify is a signal worth
a failed boot.

Open thread on what was *not* observed: `tasks/open/neon-certificate-chain-not-observed.md`.
