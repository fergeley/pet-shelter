# Engineering Handoff — Email Correctness and the Escaping Target

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Verified at**: `eab9e85` — `npx tsc --noEmit` clean, `tests/unit/email.test.ts` 19/19

> **The escaping plan is not in this document.** It is `docs/tasks/TARGET_EMAIL_HTML_ESCAPING.md`,
> measured and prototyped. Restating it here would produce the one defect this repo keeps making —
> see `anything-written-twice-diverges`. This brief covers what shipped, what it cost, and what to
> pick up. For the *how*, open the target.

---

## 1. 📦 What Shipped

| commit | what |
|---|---|
| `98e8a97` | Receipt payment-rail divergence. One resolved `fields` object above both templates; exhaustive `Record<PaymentMethod, string>`; donor notes in the HTML, escaped; `toFixed(2)` amount. |
| `1276dfc` | Staff alert now carries `applicantNotes` and `petId` in both halves, escaped. |
| `ab1bc44` | `URGENT_RECEIPT_EMAIL_CORRECTNESS.md` closed out; four-builder audit recorded as §8. |
| `eab9e85` | `TARGET_EMAIL_HTML_ESCAPING.md` — the next target, measured and prototyped. |

The original defect: a **card** donation was receipted as "Direct Bank Transfer" in the HTML half
while the plain-text half of the same email said "Credit / Debit Card", on a statutory Sec 44(6)
document filed with LHDN. Both halves now resolve every field from one object.

---

## 2. 🧭 Decisions Worth Knowing

**The rail `Record` is keyed off `DonationReceipt["paymentMethod"]`, not the zod enum.** That union
is hand-written in **five** places — `src/types/sponsorship.ts:26`, `src/lib/server/donationLedger.ts:56`,
`src/lib/client/sponsorshipStore.ts:56`, and `src/lib/validations/donation.ts` twice (`:12` zod, `:64`
a hand-written copy). Keying the guard off the wrong copy gives you something that compiles happily
while the rendered field drifts. Key it off the type the template actually renders.

**`online_banking` deliberately does not name a bank.** The plain-text half used to say
"Direct Bank Transfer (Maybank)". The receipt DTO carries no bank field, so that was an unverifiable
claim on a tax document — the same defect class as the card bug, just less obvious. Do not put it back.

**DuitNow settled as "DuitNow QR (PayNet)".** The two halves had invented "Instant Standard" and
"Instant Rail" independently. Neither is a PayNet product name.

**The amount is formatted once, and this changed the subject line.** `RM ${amountMYR}.00` rendered an
RM 250.50 donation as `"RM 250.5.00"` in both halves. Now `toFixed(2)`. Side effect: whole-amount
subjects went from `RM 250` to `RM 250.00`. Deliberate — flag it if anyone asks why receipt subjects
changed.

**The staff alert got a two-field object, not the receipt's full treatment.** It has no derived
values; eight of its ten fields pass straight through. But writing `|| "None"` and `|| "N/A"` into
both templates would have re-created the exact defect being fixed, so only the two fallbacks were
hoisted. Right-sized, not scaled-down.

**`escapeHtml` is the primitive, not the call-site API.** It lives beside `wrapEmailHtml`. The target
turns it into the internals of a tagged template; do not spread more manual calls in the meantime, and
**do not write a second one**.

---

## 3. ⚠️ Traps That Cost Time

**A hand-rolled tokenizer will lie to you about this file.** Auditing HTML interpolations with a
backtick/`${}` scanner desynced on the regex literals inside `escapeHtml` (`/'/g` and `/"/g` — the
quote characters read as string delimiters), swallowed everything after it, and reported **23**
interpolations where the AST found **140**. It failed quietly; the low number looked like good news.
Use `ts.createSourceFile` and walk for `isTemplateExpression`. The script must run from the repo root
for `import ts from "typescript"` to resolve — copy it in, run, delete.

**`npm run test:unit <file>` does not run just that file.** The script already ends in `tests/unit`,
so the path becomes a *second* filter and the whole unit project runs. Use
`npx vitest run --project unit <file>` when you mean one file, and `--reporter=verbose` to prove your
new cases actually executed rather than being silently filtered out.

**`npx tsc --noEmit 2>&1 | tail -3; echo $?` reports `tail`'s exit code, not `tsc`'s.** It printed
`exit=0` under a screen of type errors. Redirect to a file and count `error TS` instead.

**The baseline moves under you.** Full-suite results across this one session: 640/640 green → 6
failures → 0 failures → 3 failures. None of the failures were ever from the email work; every one
belonged to the other session's in-flight `verifyAdminSession` and Prisma-enum changes. **Capture a
baseline before editing and re-check attribution before reporting** — and check whether the failing
suites even import your files before assuming.

**Never leave an injected defect in the tree.** Proving a guard bites means writing a deliberate
break. The other session commits with `git add -A`, so that window is dangerous — it has previously
swept an injected defect into a commit and then "fixed" it. Keep each injection to a single
`run → restore` inside one tool call and assert the restore. It has now written its own lesson about
this (`f051905`).

---

## 4. 🎯 Open Items, Prioritized

### P1 — Opt-in escaping leaves 43 human-entered fields raw in the HTML
**→ `docs/tasks/TARGET_EMAIL_HTML_ESCAPING.md`.** Measured: 140 interpolations reach an HTML body, 63
unescaped, 43 carrying human-entered text. The design (tagged template, branded `SafeHtml`, narrowed
sink) is prototyped and typechecked; flipping the signature surfaces exactly five errors, one per
builder. Start with `sendStaffApplicationAlert` — smallest builder, worst exposure, already has render
tests. Do not start elsewhere in the file.

### P2 — A rejected applicant's plain-text email carries no explanation
`sendApplicationStatusUpdateEmail` puts all status-specific prose in the HTML half. The plain-text
half reads `Status: REJECTED` and nothing more. Asymmetric by design, but the design is wrong for the
one status where the explanation matters most. Recorded in `URGENT_RECEIPT_EMAIL_CORRECTNESS.md` §8.

### P3 — The payment-method union is written five times
See §2. Collapse to one exported type and have the others reference it. Small, mechanical, and it
makes the `Record` guard authoritative for every consumer rather than just the email templates.

### P4 — `1276dfc` has no `Co-Authored-By` and a one-line message
It was swept into the other session's commit mid-verification. The committed blob was verified correct
— both HTML rows present, not a mutation state. **Do not amend or rebase it**; there are commits on
top and an upstream. Noted here so the history is explicable, not so it gets fixed.

---

## 5. 🚀 Picking This Up

### Start here — paste this to open the next session

```text
Read docs/tasks/HANDOFF_EMAIL_CORRECTNESS_AND_ESCAPING.md, then
docs/tasks/TARGET_EMAIL_HTML_ESCAPING.md.

Execute P1: convert sendStaffApplicationAlert ONLY to the tagged-template
SafeHtml design in TARGET §3.1.

- TARGET §3.2: every nested HTML template must be tagged too, not just the
  outer one. There are 18 in the file; this builder has several.
- TARGET §3.4: delete the existing escapeHtml(...) call sites as you convert,
  or you double-escape to &amp;lt;.
- Do NOT change the wrapEmailHtml signature yet. That is the last step, after
  all five builders convert, so the 5 compile errors light up only what is
  left.
- Do NOT touch palette hex; that belongs to TARGET_EMAIL_COLOUR_PARITY.md.

Test through the existing renderReceipt() fetch-spy helper in
tests/unit/email.test.ts — do not invent a second mechanism. Invoke the
test-harness skill before writing any test. Prove the new assertions bite by
removing a converted row and watching them go red, inside a single
run-then-restore tool call.

Then run npm run test:all and report how many pre-existing assertions needed
updating. That number sizes the remaining four builders.

This branch has concurrent writers: check `git diff --cached --name-only` in
its own tool call, commit with a pathspec, never `git add -A`, never stash.
```

**Read in this order**: `TARGET_EMAIL_HTML_ESCAPING.md` §1 and §3 → `src/lib/email.ts`
`wrapEmailHtml` and `escapeHtml` → the `renderReceipt` helper in `tests/unit/email.test.ts`.

**The render harness already exists.** `renderReceipt()` sets `RESEND_API_KEY`, spies `globalThis.fetch`,
and reads `text`/`html` off the Resend JSON payload. Every email assertion in this repo goes through it.
Generalise it for the other builders; do not invent a third mechanism. Invoke the `test-harness` skill
before touching any test here.

**Verify with**: `npx tsc --noEmit`, `npx vitest run --project unit tests/unit/email.test.ts`,
`npm run test:all`. Prove any new guard bites by injecting the defect and watching it go red — the
house pattern, and the reason the rail `Record` is trustworthy.

**Coordination** — this branch has concurrent writers and the index is shared:
- `git diff --cached --name-only` in its **own** tool call before composing a commit.
- `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`. Never `-A`, never `git stash`,
  never a private `GIT_INDEX_FILE`.
- Re-read `src/lib/email.ts` immediately before editing. `escapeHtml` moved from line 227 to 270
  mid-task, and the file changed under two agents while they were working in it.
- If your work is swept into someone else's commit, verify the blob and move on. See P4.
