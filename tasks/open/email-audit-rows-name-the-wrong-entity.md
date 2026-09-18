# Email audit rows for donations and sponsorships name `AdoptionApplication` as their entity

**Status:** open · opened 2026-09-16

`sendRawEmail` in `src/lib/email.ts` defaults its `entity` parameter to `"AdoptionApplication"`
(line 52, "Defaults to the historical value"), and that value becomes the audit row's
`targetEntity` (`src/lib/domain/auditLog.ts:94`) for `EMAIL_SENT`, `EMAIL_FAILED` on an HTTP error
(`email.ts:138-139`), and `EMAIL_FAILED` on a network error (`email.ts:179-180`).

Only two senders override it: the pet photo update (`"SponsorNotification"`, line 1088) and the
staff invitation (`"User"`, line 1184). So `DONATION_RECEIPT` (`email.ts:790-797`),
`SPONSORSHIP_WELCOME` (935-942) and `CARETAKER_QUESTION` (1233-1240) rows are filed under adoption
applications, with a receipt number or sponsorship id in `targetId`.

Seen in production data: the 11 `EMAIL_FAILED` rows local e2e wrote on 2026-09-14 are all
`[AdoptionApplication]`, including the three donation receipts' (masked export summary,
2026-09-16).

Noticed while closing the e2e hazard, and deliberately not fixed there: it changes what existing
audit queries return, which is its own decision.

**Settles when:** each sender passes its own entity, or the default is removed so a sender cannot
omit it, with a test naming the entity on a donation receipt's audit row.
