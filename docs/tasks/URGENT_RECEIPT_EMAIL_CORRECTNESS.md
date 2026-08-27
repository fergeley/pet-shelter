# 🔴 URGENT — The tax receipt email misstates the payment method

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Found at**: `285295e`, while auditing `src/lib/email.ts` for `TARGET_EMAIL_COLOUR_PARITY.md`
**File**: `src/lib/email.ts`, `sendDonationReceiptEmail()` (from line 543)

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

- [ ] **Extract the field values once**, above both templates: a small object holding the resolved
      payment-rail label, the formatted amount, and the optional rows (`taxIdOrIc`, `targetPetName`,
      `notes`). Both representations read from it. This is the fix — the two edits below are what it
      makes impossible to get wrong again.
- [ ] **Give `paymentMethod` one exhaustive mapping.** A `Record<PaymentMethod, string>` rather than
      a ternary chain, so a fourth rail added to the enum is a type error here instead of silently
      becoming "Direct Bank Transfer".
- [ ] Settle the DuitNow product name (§1.2) and use the settled value in both halves.
- [ ] Render `receipt.notes` in the HTML, matching the plain text.
- [ ] **Test it.** For each of the three `paymentMethod` values, assert the rendered text and HTML
      each contain the expected label and do not contain either of the other two. That single test
      is what turns this from "fixed" into "cannot recur". `tests/unit/email.test.ts` already exists.
- [ ] Re-read the remaining four builders in `email.ts` for the same text/HTML divergence — the root
      cause is structural, so assume the other templates have it until checked.

## 4. Verification

- [ ] `npm test` green, with the new payment-rail cases.
- [ ] `npx tsc --noEmit` clean.
- [ ] Render one receipt per payment method and read both halves side by side. Arithmetic will not
      catch a wrong *label*; a human reading it will.
- [ ] Confirm the exhaustive mapping actually fails the build when a value is removed from the enum —
      the house pattern: prove the guard bites before trusting it.

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
