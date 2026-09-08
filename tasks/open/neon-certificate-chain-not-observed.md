# No connection to Neon has been observed under strict certificate verification

**Status:** ASSERTED · opened 2026-09-08

`src/lib/server/prisma.ts` now sends `ssl: { rejectUnauthorized: true }` to every dotted host,
which for this project means Neon. **Nothing has connected to Neon under that setting.** The
belief that it verifies rests on two things, only one of which was measured:

- **Measured, locally and offline:** Node's bundled trust store in this environment carries
  `CN=ISRG Root X1` and `CN=ISRG Root X2` among 120 roots
  (`tls.rootCertificates` parsed with `crypto.X509Certificate`).
- **Asserted:** that Neon's endpoint presents a chain to one of those roots, and that no
  intermediate is missing from what it serves. Not verified, because doing so means a TLS handshake
  against the production endpoint using the credential in `.env.local`, and the fence in front of
  that connection string exists for a reason.

Nothing in the unit or integration tiers can close this. They double the Prisma client, and Tier 3b
points at `localhost`, which this policy deliberately leaves alone — so a green suite says nothing
about the hosted case either way.

The failure mode if the assertion is wrong is loud rather than silent: connections fail at
handshake with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or `SELF_SIGNED_CERT_IN_CHAIN`, on the first
query after deploy. That is the intended direction — the previous configuration failed *open* and
said nothing — but it is a deploy-time failure, not a build-time one.

**Settles when:** a connection to the hosted database is observed succeeding with
`rejectUnauthorized: true` — a preview deploy that serves one query is enough, as is
`openssl s_client -verify_return_error -connect <neon-host>:5432 -starttls postgres` run by
someone holding the host name. Record the result here and move this entry to `decisions/`.

If it fails instead, the fix is a pinned CA (`ssl.ca`), **not** a return to
`rejectUnauthorized: false` — see
`tasks/decisions/2026-09-08-database-tls-is-decided-by-host-not-url-spelling.md`.
