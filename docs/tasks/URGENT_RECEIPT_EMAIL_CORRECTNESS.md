# 🔴 URGENT — The tax receipt email misstates the payment method

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Found at**: `285295e`, while auditing `src/lib/email.ts` for `TARGET_EMAIL_COLOUR_PARITY.md`
**File**: `src/lib/email.ts`, `sendDonationReceiptEmail()` (from line 543)
**Status**: fixed in `98e8a97` — see §7. §3's last item was audited only, not fixed; findings in §8.

> This is not the colour work. `TARGET_EMAIL_COLOUR_PARITY.md` is a brand-consistency task and can
> wait. **This is a factual error on a statutory document and should not.** The two are separated on
> purpose so the correctness fix is not held behind a palette refactor.

---

## 1. What is wrong

`sendDonationReceiptEmail()` builds the Sec 44(6) tax-exempt e-receipt **twice** — once as plain
text, once as HTML — by hand. The two have drifted.

### 1.1 🔴 A card donation is receipted as a bank transfer

`paymentMethod` is a three-value enum (`src/lib/validations/donation.ts:12`):

```ts
z.enum(["duitnow_qr", "online_banking", "card"])
```

The plain text handles all three (`email.ts:568`):

| `paymentMethod` | Plain text renders |
|---|---|
| `duitnow_qr` | DuitNow QR Instant **Standard** (PayNet) |
| `online_banking` | Direct Bank Transfer (Maybank) |
| `card` | Credit / Debit Card |

The HTML handles two (`email.ts:616`) — a single ternary with no `card` branch:

```ts
${receipt.paymentMethod === "duitnow_qr" ? "DuitNow QR Instant Rail (PayNet)" : "Direct Bank Transfer"}
```

| `paymentMethod` | HTML renders |
|---|---|
| `duitnow_qr` | DuitNow QR Instant **Rail** (PayNet) |
| `online_banking` | Direct Bank Transfer |
| `card` | **Direct Bank Transfer** ← wrong |

**So a donor who pays by card receives a tax receipt whose HTML body states the payment rail was a
direct bank transfer, while the plain-text part of the same email says "Credit / Debit Card".** The
document contradicts itself, and the half most donors actually see is the wrong one.

This is filed with LHDN for personal or corporate tax relief. A receipt that misdescribes how the
payment was made is a receipt that cannot be reconciled against a bank or card statement.

### 1.2 The DuitNow label differs between the two halves

"DuitNow QR Instant **Standard** (PayNet)" in text, "DuitNow QR Instant **Rail** (PayNet)" in HTML,
for the same donation. At most one is the correct product name. Worth settling while the file is
open — check what PayNet actually calls it rather than picking the nicer-sounding one.

### 1.3 The donor's own message is dropped from the HTML

`receipt.notes` renders as `- Donor Message: "…"` in the plain text (`email.ts:569`) and appears
nowhere in the HTML. A donor who wrote a dedication sees it echoed only if their client falls back
to plain text.

---

## 2. Root cause

The receipt is authored twice, in two languages, with no shared source of the field values. Nothing
compares them. Every field in this email is one careless edit away from the same divergence — these
three are simply the ones that have already happened.

Note this is the *same shape* as the defect `da81c1b` fixed on the CSS side: one value, two
hand-maintained copies, drifting silently. It is not a coincidence that both showed up in the two
files that guard exempts.

---

## 3. Do this

- [x] **Extract the field values once**, above both templates: a small object holding the resolved
      payment-rail label, the formatted amount, and the optional rows (`taxIdOrIc`, `targetPetName`,
      `notes`). Both representations read from it. This is the fix — the two edits below are what it
      makes impossible to get wrong again.
      *Delivered as `fields`, and it also carries `frequencyLabel` and `donorPhone`, which were
      resolved twice by hand as well.*
- [x] **Give `paymentMethod` one exhaustive mapping.** A `Record<PaymentMethod, string>` rather than
      a ternary chain, so a fourth rail added to the enum is a type error here instead of silently
      becoming "Direct Bank Transfer".
      *Keyed off `DonationReceipt["paymentMethod"]`, not the zod enum — see §7.*
- [x] Settle the DuitNow product name (§1.2) and use the settled value in both halves.
- [x] Render `receipt.notes` in the HTML, matching the plain text. *Escaped; see §7.*
- [x] **Test it.** For each of the three `paymentMethod` values, assert the rendered text and HTML
      each contain the expected label and do not contain either of the other two. That single test
      is what turns this from "fixed" into "cannot recur". `tests/unit/email.test.ts` already exists.
- [ ] Re-read the remaining four builders in `email.ts` for the same text/HTML divergence — the root
      cause is structural, so assume the other templates have it until checked.
      **Audited at `98e8a97`, not fixed** — one builder has the same defect and one field class is
      unsafe across the whole file. Findings and remaining work in §8. This box stays open until
      that work lands.

## 4. Verification

- [x] `npm test` green, with the new payment-rail cases. *`tests/unit/email.test.ts` 15/15.*
- [x] `npx tsc --noEmit` clean.
- [x] Render one receipt per payment method and read both halves side by side. Arithmetic will not
      catch a wrong *label*; a human reading it will.
      *Done — one receipt per method, both halves read side by side. All three agree.*
- [x] Confirm the exhaustive mapping actually fails the build when a value is removed from the enum —
      the house pattern: prove the guard bites before trusting it.
      *Exercised in the opposite direction: a fourth rail was added to the union, which produced
      `src/lib/email.ts(568,7): error TS2741` on the record literal, and was then reverted. Adding
      is the direction that matters here — it is the case that used to fall through to "Direct Bank
      Transfer" silently.*

## 5. Explicitly not in this task

- The palette. `#0f172a`, `#16a34a`, `#dcfce7` and the rest stay exactly as they are here; they are
  `TARGET_EMAIL_COLOUR_PARITY.md`'s subject. Mixing the two makes the correctness fix
  unreviewable — a reviewer cannot see a one-word label change inside a 64-value colour diff.
- Any change to what is legally required on a Sec 44(6) receipt. The registration number, LHDN
  reference and statutory wording are present and are not in question here; only the payment-rail
  statement is wrong.

## 6. ⚠️ Coordination

The branch has concurrent writers and the shared git index is routinely non-empty.

- Check `git diff --cached --name-only` in its **own** tool call before composing a commit.
- Commit with a pathspec: `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`.
  See `TARGET_EMAIL_COLOUR_PARITY.md` §7 for why, and for the `GIT_INDEX_FILE` trap to avoid.

---

## 7. Landed

`98e8a97` — *fix(email): state one payment rail in both halves of the tax receipt*. Two files:
`src/lib/email.ts` and `tests/unit/email.test.ts`. Nothing else was touched.

Both templates now read from one `fields` object built above them — the formatted amount, the
frequency label, the payment rail, and the optional rows `donorPhone` / `taxIdOrIc` /
`targetPetName` / `notes`. Neither half re-derives a value of its own.

### 7.1 The settled labels

| `paymentMethod` | Label, identical in both halves |
|---|---|
| `duitnow_qr` | DuitNow QR (PayNet) |
| `online_banking` | Direct Bank Transfer |
| `card` | Credit / Debit Card |

- **DuitNow** — "DuitNow QR (PayNet)" is PayNet's actual product name. Both invented variants,
  "Instant Standard" and "Instant Rail", are gone.
- **`online_banking`** — the bank name is dropped. The receipt DTO carries no bank field, so the
  old "(Maybank)" in the plain-text half was an unverifiable claim on a statutory document. That is
  the same defect class as §1.1: a value stated on a tax receipt that nothing in the record backs.
  It was found while settling §1.2 and fixed in the same commit.

### 7.2 The mapping is keyed off the rendered type, not the enum

§3 asked for `Record<PaymentMethod, string>`. The delivered `PaymentMethod` is
`DonationReceipt["paymentMethod"]` (`src/types/sponsorship.ts:26`), **not**
`z.infer<typeof paymentMethodEnum>`. That matters: the union is written out in five places in this
repo — `src/types/sponsorship.ts`, `src/lib/server/donationLedger.ts`,
`src/lib/client/sponsorshipStore.ts`, and `src/lib/validations/donation.ts` twice (the zod enum at
line 12 and a hand-written copy at line 64). Keying the exhaustiveness guard off any copy other than
the one the template actually renders yields a mapping that compiles while the rendered field
drifts — the guard would be decorative.

### 7.3 One user-visible side effect

`RM ${receipt.amountMYR}.00` string concatenation was replaced with `toFixed(2)`. The old form
rendered an RM 250.50 donation as **"RM 250.5.00"** — in both halves and in the subject line. This
document did not record that defect; it was found while consolidating the amount into `fields`.

The correction changes the subject line for whole amounts from `RM 250` to `RM 250.00`. That is the
only user-visible change outside the payment-rail statement, and it is deliberate: one formatter for
one value.

### 7.4 Donor notes reach the HTML escaped

`receipt.notes` now renders in the HTML half, through a new `escapeHtml()` helper placed beside
`wrapEmailHtml()`. The field is up to 500 characters of free text arriving from a public form
(`src/lib/validations/donation.ts:45`), so it cannot be trusted as markup. The plain-text half is
left verbatim — it is not markup. This is the only field in the file that is escaped; see §8.5.

### 7.5 Tests

For all three rails, both halves are asserted to contain the expected label and **neither of the
other two**. Mutation-tested: reintroducing the two-branch ternary fails exactly the `card` case and
nothing else. Also covered: the donor message present and absent, escaping of donor-supplied markup,
and a fractional amount rendering identically in both halves.

§5 held — no palette hex value was touched by `98e8a97`.

---

## 8. Follow-up — the read-only audit of the other four builders

§3's last item was carried out as an audit at `98e8a97`. Nothing was changed. It is recorded here as
work, not as done.

### 8.1 `sendStaffApplicationAlert` — the same defect shape 🔴

The plain text renders `Notes: ${app.applicantNotes || "None"}` and
`Pet: ${app.petName} (ID: ${app.petId})`. The HTML omitted **both**. A coordinator who reads the
HTML half — which is the half most clients show — never sees what the applicant wrote about their
household, and has no pet ID to reconcile the application against.

This is §1.3 again, in the email that decides whether an application is followed up.

> A separate stream picked this up while the audit was being written. If
> `sendStaffApplicationAlert` already resolves a small `fields` object above both halves and escapes
> it at the point of use, that fix has landed and this item is closed; check the builder before
> starting.

### 8.2 `sendInterviewInvitationEmail` — clean

Resolves `meetingTypeLabel` once above both templates and reads it from there in each half. This is
the pattern `sendDonationReceiptEmail` adopted in `98e8a97`, and it predates the fix — the receipt
was the outlier, not the norm.

### 8.3 `sendApplicationConfirmationEmail` — clean

The submission summary is parallel and consistent between the two halves.

### 8.4 `sendApplicationStatusUpdateEmail` — asymmetric by design, with a content gap

The HTML carries status-specific prose per branch; the plain text is a single summary. That
asymmetry is deliberate and the two halves do not contradict each other, so it is not the §1 defect.

But a plain-text reader of a **REJECTED** decision receives `Status: REJECTED` and none of the
explanation the HTML gives — no statement that the decision turned on the animal's temperament and
needs, no encouragement to look at other rescues. A content gap on the least welcome email the
shelter sends. Lower priority than §8.1, and a copy decision rather than a correctness one.

### 8.5 Systemic — free text still enters HTML unescaped

`escapeHtml()` exists now, but `receipt.notes` is the only caller. Every other free-text field is
still interpolated raw into an HTML body: `applicantNotes`, `coordinatorNotes`, `currentPets`,
`address`, `donorName`, `tierName`. All of them arrive from a public or admin form.

The helper sits next to `wrapEmailHtml()` for whoever takes this on. It is one task across the file,
not five separate ones, and it is not this one's — a correctness fix to a statutory document should
not be held behind an escaping sweep, for the same reason §5 keeps the palette out.
