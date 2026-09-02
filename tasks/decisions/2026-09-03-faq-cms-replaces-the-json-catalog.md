# The FAQ became a database table with a staff editor, and the JSON catalog became its fallback

**Decided:** 2026-09-03 · Shipped as PR #13 (`4c15554`) · Killed PR #8

`src/data/faqs.json` was authoritative and said so — *"A catalog, not a
repository … no Prisma model, no write path"*. Changing a question meant a
deploy. It is now the offline fixture behind `src/lib/server/faqRepository.ts`,
in the same relationship `pets.json` has to `petRepository`, and staff edit the
live rows at `/admin/faqs`.

## What was chosen, and what the alternative was

**One category vocabulary — master's seven, not the incoming four.** The Prisma
enum takes the same members as the `FaqCategory` union and the keys of
`FAQ_CATEGORY_LABELS`. The rejected alternative was keeping the branch's
`ADOPTION | VOLUNTEERING | ANIMAL_CARE | SHELTER_INFO`, which would have needed
its own label table — a second one. `faqRepository` carries a compile-time
assertion that the enum, the union and the zod tuple agree, so adding a category
to one and not the others is a type error rather than a slug that renders raw.

**Malay is nullable in the database and resolved on read, not on write.** The
mapper substitutes the English text once, so every consumer holds a plain
`string` and no page can render a blank Malay question. Writing the English into
the Malay column at save time was the alternative and is worse: a later edit to
the English would leave a stale duplicate behind. The editor deliberately reads
the *unresolved* values so saving cannot freeze the fallback in.

**Reordering renumbers the category from 0; it does not swap two values.** A
swap cannot express a move between rows that already share a `displayOrder`, and
nudging one to `neighbour - 1` produced `-1`, which `faqFormSchema` rejects —
locking that row out of the edit dialog permanently. Renumbering also heals
pre-existing ties and gaps.

**`PetsFaqSection` was not touched.** It already read through the catalog
module, so pointing that module at the database was the whole integration. The
tabbed accordion on `/pets` is now staff-editable with no UI churn.

**Three incoming entries were dropped as duplicates**, not merged: "found an
injured stray" (master's has the TNRM hotline), "what is TNRM" (master's
explains the vacuum effect) and corporate volunteering (master's covers CSR).
The fixture went 8 → 20.

## Why PR #8 was killed rather than fixed

It carried the same feature from a stale base whose history had already merged
`origin/master`. Merging master back in **silently reverted** work the branch had
never touched — `sponsorshipLedger.ts` (327 lines), `petSponsorship.ts`,
`validations/sponsorship.ts`, three test files, email hardening, a `globals.css`
token. No conflict markers on any of them; the nine conflicts that *were*
reported were all in FAQ files, so the merge looked reviewed.

Multiple merge bases are the mechanism. Git builds a virtual base already
containing master's newer content, which makes master's side look unchanged and
the branch's older content look like an intentional revert.

It surfaced only because four design-system tests failed on files nobody had
opened. **The check that catches it is `git diff --stat <target>` after merging —
every file listed must be one you meant to touch.** The intended change was 29
files and 183 deletions; the merge produced 51 and 2337.

Rebuilding on a fresh branch cut from `master` was faster than untangling it.

## Left open

- `tasks/open/faq-empty-publish-set-has-no-regression-test.md`
- `tasks/open/pets-json-fallback-empty-means-outage.md`
- `tasks/open/server-action-auth-guard-has-not-seen-the-faq-reads.md`

Also pruned: `race-test.mjs`, `empty-state-test.mjs`, `e2e-faq.mjs`,
`seed-faqs.ts`, `verify-final-state.mjs` and `apply-faq-migration.mjs`, which
verified this work before merge.

They are **not** in this tree. They live at commit `e74899e`, the head of the
closed PR #8. That branch has been deleted, but GitHub retains the pull
request's own ref permanently, so the commit stays reachable:

    git fetch origin refs/pull/8/head && git show FETCH_HEAD:scripts/race-test.mjs

`race-test.mjs` is the only artefact that *demonstrated* the migration's
advisory lock rather than asserting it — run concurrently, the naive
check-then-create pattern failed 1 run in 6 with `duplicate key value violates
unique constraint "pg_type_typname_nsp_index"` while the hardened form passed
6/6. The conclusion survives in the migration's comments; the demonstration
only at that ref.
