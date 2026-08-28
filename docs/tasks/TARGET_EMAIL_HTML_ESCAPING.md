# Target — Email HTML Escaping

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Found at**: `98e8a97` / `1276dfc`, while fixing the receipt and staff-alert text/HTML divergence
**File**: `src/lib/email.ts` (all five builders + `wrapEmailHtml`)

> The two commits above each added exactly one escaped field, because each was reviewed. This
> target is about the other forty-three that were not.

---

## 1. 🔴 Why this is the next target

`src/lib/email.ts` builds every transactional email by interpolating values straight into HTML
template literals. Escaping is **opt-in**, and it has been opted into four times out of sixty-seven.

### 1.1 The numbers, measured

Counted by walking the TypeScript AST of `src/lib/email.ts` (not by grep — a hand-rolled tokenizer
desynced on the regex literals inside `escapeHtml` and under-reported by 5×; if you re-audit, parse,
do not pattern-match):

| | count |
|---|---|
| HTML template literals | 18 |
| Interpolations landing in HTML | 140 |
| — already escaped | 4 |
| — compile-time constants / design tokens | 65 |
| — conditional wrappers (payload counted separately) | 8 |
| — **unescaped, dynamic** | **63** |

Of those 63, **43 carry human-entered text**: `applicantName`, `applicantNotes`, `address`, `phone`,
`email`, `currentPets`, `householdExperience`, `housingType`, `hasFencedYard`, `donorName`,
`donorEmail`, `tierName`, `targetPetName`, `taxIdOrIc`, `coordinatorNotes`, `coordinatorName`,
`location`, `petName`, `notes`.

The remaining 20 are system-derived (`app.id`, `trackingUrl`, `newStatus`, `receipt.receiptNumber`,
`receipt.date`, `fields.amount`, `fields.paymentRail`, `TONE_RULES`, …) and are not a vector — but
see §3.5, because two of them still render *incorrectly* today.

### 1.2 What that actually permits

`donationPledgeSchema` caps `notes` at 500 characters and `donorName` at 100. Neither constrains the
character set. An adoption application's `applicantNotes` has no server-side length or content bound
at all beyond the form. So:

```
applicantName: Tan Ah Kow</strong><a href="https://evil.example/reset">Click to verify</a><strong>
```

is submitted through the public adoption form and arrives, rendered as live markup, in the shelter
coordinator's inbox via `sendStaffApplicationAlert`. The coordinator is the person who approves
adoptions and reads every application. This is a phishing vector aimed squarely at the one account
that matters, and the payload is typed into a form the site invites the public to fill in.

The donation receipt is worse in kind if not in reach: it is a **statutory Sec 44(6) document** filed
with LHDN. `donorName`, `tierName`, `taxIdOrIc` and `targetPetName` all interpolate raw. A donor name
containing `&` already renders as an undefined-behaviour entity today.

### 1.3 Opt-in escaping is the defect, not the missing calls

Both recent fixes added `escapeHtml(...)` at exactly the site under review, and neither author
touched the adjacent unescaped rows in the same card — `1276dfc` escaped `applicantNotes` while
leaving `applicantName`, `email`, `phone`, `address`, `housingType`, `hasFencedYard`,
`householdExperience` and `currentPets` raw **in the same eight-line block**.

That is not carelessness twice. It is what opt-in safety produces: the reviewer checks the field in
the diff, and the file's default stays wrong. A lint rule or a grep guard would be one more thing
that has to be remembered. The fix is to make the safe thing the thing that happens when you do
nothing, and the unsafe thing require a word you have to type.

This is the same root cause as `docs/tasks/URGENT_RECEIPT_EMAIL_CORRECTNESS.md` §2 and the CSS defect
`da81c1b` closed: not a wrong value, but a structure in which the wrong value is the default.

---

## 2. What already exists to reuse

- **`escapeHtml(value: string): string`** — `src/lib/email.ts`, added by `98e8a97`, sits directly
  after `wrapEmailHtml`. Escapes `& < > " '`. Correct as written; it becomes the internal primitive,
  not the call-site API. **Do not write a second one.**
- **`wrapEmailHtml(content: string): string`** — the single sink every builder's HTML passes through.
  This is the chokepoint the whole design hangs on. Exactly five call sites.
- **The fetch-spy render harness** — `renderReceipt()` in `tests/unit/email.test.ts` sets
  `RESEND_API_KEY`, spies `globalThis.fetch`, and reads `text`/`html` off the Resend JSON payload.
  Both recent email fixes tested through it. Generalise it; do not invent a third mechanism.
- **`src/lib/presentation/emailTokens.ts`** — the colour tokens now interpolated into the HTML.
  These are constants and must **not** be escaped into `&amp;`-mangled CSS; §3.3 covers how.

---

## 3. ⚠️ The real decisions

### 3.1 A tagged template with a branded return type — escaping becomes the default

```ts
declare const brand: unique symbol;
export type SafeHtml = { readonly [brand]: "html"; readonly value: string };

/** Interpolated values are escaped unless they are themselves SafeHtml. */
export function html(strings: TemplateStringsArray, ...values: Value[]): SafeHtml;

/** Explicit, greppable escape hatch for pre-trusted markup. */
export function trustedHtml(value: string): SafeHtml;
```

Then change the sink:

```ts
function wrapEmailHtml(content: SafeHtml): string
```

**This was prototyped and typechecked before this doc was written.** Verified behaviour:

| case | result |
|---|---|
| `html\`<p>${notes}</p>\`` with `<script>alert("x")</script> Ali & Sons` | `&lt;script&gt;…&lt;/script&gt; Ali &amp; Sons` |
| nested fragment `${cond ? html\`<em>${v}</em>\` : ""}` | composes, inner value escaped once |
| array `${rows.map(r => html\`<li>${r}</li>\`)}` | joined, each escaped |
| `${undefined}` | renders `""`, not `"undefined"` |
| `wrapEmailHtml(\`<p>${notes}</p>\`)` — a bare string | **compile error** |

That last row is the point. It is not a convention, a lint rule, or a review checklist — it is
`error TS2345`, in the same house pattern as the exhaustive `Record<PaymentMethod, string>` that
`98e8a97` used to make an unhandled payment rail unbuildable.

**Measured migration surface**: flipping the signature on the real file and running `npx tsc --noEmit`
produces **exactly 5 errors, one per builder** — the compiler enumerates the work and will not let
you declare it finished early.

### 3.2 Every nested HTML template must be tagged too — this is the trap

There are 18 HTML template literals, not 5. The builders nest fragments inside conditionals:

```ts
${fields.notes ? `<tr><td>${fields.notes}</td></tr>` : ""}
```

If the outer template is tagged and this inner one is not, the inner fragment is a plain `string`,
so the tag escapes it **as text** and the coordinator sees literal `<tr><td>` in their email. It
fails loudly and visibly, not silently — but it will fail on first run if you convert only the
outermost template. Convert all 18.

### 3.3 `trustedHtml()` is the only escape hatch, and it must stay single-digit

`wrapEmailHtml`'s own chrome (the `<!DOCTYPE>`, the `<style>` block, `TONE_RULES`) is generated
markup and CSS, not data. Escaping it would mangle the stylesheet — CSS child selectors (`>`) would
become `&gt;`.

Wrap those in `trustedHtml(...)`. The name is deliberately ugly and greppable: `grep -c trustedHtml`
is the audit, and the acceptance criteria pin it. If that count climbs past the CSS chrome, the
design has been routed around.

### 3.4 Delete the four `escapeHtml(...)` call sites during conversion — or double-escape

`escapeHtml` returns `string`. Under the tag, a `string` gets escaped. So:

```ts
html`<td>${escapeHtml(fields.notes)}</td>`   // "Ali &amp;amp; Sons" — wrong
html`<td>${fields.notes}</td>`               // "Ali &amp; Sons" — right
```

The four existing calls (receipt notes, staff-alert notes, staff-alert petId) must be unwrapped as
they are converted. A test asserting `&amp;lt;script&amp;gt;` would be a test locking in the bug —
assert `&lt;script&gt;` and `not.toContain("&amp;lt;")`.

### 3.5 Do not escape at the DTO boundary — and expect rendered output to change

Escape at render, never on the way in. Escaping in the action or the ledger would corrupt the
plain-text half of every email (which must stay verbatim — the receipt's plain text is the
LHDN-readable copy), and would write entities into the donation ledger and the database.

Two consequences to accept deliberately, not discover:

- **`trackingUrl` currently renders wrong.** It is built with `encodeURIComponent`, so it is not an
  injection vector, but it goes into `href="…"` containing a raw `&` between query params. In HTML
  that should be `&amp;`. Escaping it is a *fix*, and it changes four rendered `href` values.
- **Any existing assertion on a raw `&`, `<`, `>`, `"` or `'` in an HTML body will break.** The
  colour-parity and brand-token tests added in `152e817` assert on rendered HTML. The count is not
  knowable until the first builder is converted — convert `sendStaffApplicationAlert` first (§4) and
  read the real number off the suite before estimating the rest.

---

## 4. Step plan

- [ ] Extract `html`, `trustedHtml`, `SafeHtml` and the existing `escapeHtml` into
      `src/lib/email/html.ts` (or `src/lib/presentation/safeHtml.ts` — match wherever
      `emailTokens.ts` settled). Unit-test the tag directly: escaping, nesting, arrays,
      `null`/`undefined`, and idempotency.
- [ ] Convert **`sendStaffApplicationAlert` only**. It is the smallest builder, has the worst
      exposure (§1.2), and already has render tests from `1276dfc`. Run the full suite and record how
      many existing assertions needed updating — that number sizes the remaining four.
- [ ] Convert the remaining four builders and `wrapEmailHtml`'s chrome. Change the sink signature to
      `SafeHtml` **last**, so the 5 compile errors light up only the builders not yet done.
- [ ] Delete the four `escapeHtml(...)` call sites as their builders convert (§3.4).
- [ ] Add one adversarial render test per builder: feed
      `<script>alert("x")</script> & <b>bold</b> O'Brien` into every human-entered field, assert the
      HTML half contains no `<script>`, no `<b>`, and does contain `&lt;script&gt;`; assert the
      plain-text half is byte-for-byte verbatim.
- [ ] Prove the guard bites, per the house pattern: pass a bare template literal to `wrapEmailHtml`,
      confirm `tsc` fails, revert. Record the error code in the commit message.

## 5. Acceptance criteria

- [ ] `npx tsc --noEmit` clean; `npm run test:all` green with no new failures.
- [ ] `wrapEmailHtml` accepts `SafeHtml` only. Passing a `string` is a compile error.
- [ ] Re-running the AST audit reports **0** unescaped dynamic interpolations in HTML context
      (down from 63). Keep the audit script — §6 of `TARGET_DESIGN_SYSTEM_GUARDS.md` is the
      precedent for turning it into a committed guard test rather than a throwaway.
- [ ] `grep -c trustedHtml src/lib/email*` is single-digit and every call sits on generated CSS or
      chrome, never on a field that came from a request.
- [ ] The plain-text half of all five emails is byte-for-byte unchanged. Diff one rendered email per
      builder before and after; the text half must not move at all.

## 6. Out of scope

- **The palette.** `TARGET_EMAIL_COLOUR_PARITY.md` owns every hex value and `emailTokens.ts`. Do not
  retune a colour while converting a template; a reviewer cannot see an escaping change inside a
  palette diff, which is the same reason the receipt correctness fix was split out.
- **A templating engine.** MJML, react-email or JSX-for-email would subsume this, and would also
  rewrite all five builders, the test harness, and the plain-text halves. If that is ever wanted it
  is its own target — the tagged template is ~40 lines and is not an obstacle to it later.
- **Sanitising stored data.** Nothing in the ledger, the application store or the DB changes.
- **The other divergences.** `sendApplicationStatusUpdateEmail`'s plain-text half still drops the
  status-specific prose entirely (a REJECTED applicant's text half reads `Status: REJECTED` with no
  explanation). Real, logged in `URGENT_RECEIPT_EMAIL_CORRECTNESS.md` §8, not this task.

## 7. ⚠️ Coordination — this branch has concurrent writers

Still true and still biting. During the two fixes that produced this doc, the other session committed
**both agents' working-tree changes into its own commits** via `git add -A` — `1276dfc` carries a
complete fix under a one-line message with no `Co-Authored-By`, authored by neither the agent that
wrote it nor the session that reviewed it.

- Check `git diff --cached --name-only` in its **own** tool call before composing a commit.
- Commit with a pathspec: `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`.
  Do **not** build the commit in a private `GIT_INDEX_FILE`.
- Do not `git stash`. The index is shared.
- Re-read `src/lib/email.ts` immediately before editing. It moved four times in one hour on the day
  this was written, and `escapeHtml` shifted from line 227 to 270 mid-task.
- If your work is swept into someone else's commit, **do not amend or rebase.** Verify the committed
  blob is the correct state and note it. Rewriting shared history on a branch with an active writer
  and an upstream costs more than a bad commit message does.
