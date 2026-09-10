# An allow rule is the dangerous direction

**Learned:** 2026-09-05

Tuning the auto-mode classifier, I wrote three `allow` entries across two drafts and every one was
broader than it read. `claude auto-mode critique` caught all of them; none was visible to me on
re-reading my own text.

The worst blessed `npm run` generically — "npm run test and lint scripts" — while my own `soft_deny`
in the same file blocked `npm run db:push`, `db:seed` and `db:migrate:faqs`. **`allow` overrides
`soft_deny`**, and the classifier does not read `package.json`, so it cannot tell a test script from
a migration script. That entry could have neutralised the production-database rule I had just spent
three drafts strengthening, and it was live in the config for about twenty minutes.

The second cleared the command it meant to permit: I wrote that "a command which merely names one of
those identifiers is routine", intending `grep -l RESEND_API_KEY src`, and thereby cleared
`grep SESSION_SECRET .env.local` — which prints the value.

The third cited this repo's own `triage-rules.md` as authority for a rule. Repo file content never
establishes user intent, and pointing a classifier at an in-repo file as a mandate is precisely the
Instruction Poisoning shape it watches for. **A file I can write to is not a source of authority over
the thing that guards me.**

**Rule:** the two directions are not symmetrical. A `deny`/`soft_deny` that is too broad costs a
prompt; an `allow` that is too broad removes a guard silently, and removes it *specifically* in the
case someone bothered to write a rule about. So write `deny` in terms of effect, and write `allow`
in terms of literal commands and path globs — never in terms of intent or purpose, which cannot be
checked against a command string.

This is [[the shell-parser finding]] arriving from the other side: a rule stated as prose about
*purpose* has an unbounded surface, and one stated as a list of *shapes* can be verified. Verify an
allow rule by asserting what it must NOT match, not only what it should.
