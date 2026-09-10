# A server action is a public POST endpoint, and reads leak too

**Learned:** 2026-09-03

Three actions in the donation QR work shipped reachable without a session.
`loadShelterSettings` and `getShelterSettings` each returned the whole settings
object — `resendApiKey` included — in a module that already redacted that same
key before it reached `audit_logs`. `getAdminPets` returned archived animals and
per-pet application counts. All three were framed as read helpers, which is why
the authorization reflex never fired: it fires on mutations.

Fixing one and missing its identical twin beside it is the argument for a guard
rather than a patch. `tests/unit/serverActionAuth.test.ts` now requires every
exported action to authorize or sit in an allowlist with a stated reason.

**Gating is not always the fix.** Two of the three were better deleted than
gated: one had no production caller, and `getAdminPets` only needed to stop
being an action — its caller is a prerendered server component, so an
authorization throw would have broken the build. Check who calls it first.
