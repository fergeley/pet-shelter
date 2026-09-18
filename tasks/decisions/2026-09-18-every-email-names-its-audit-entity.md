# Every email names its own audit entity; there is no default

**Decided:** 2026-09-18

Closes `tasks/open/email-audit-rows-name-the-wrong-entity.md`.

`sendRawEmail` in `src/lib/email.ts` defaulted `entity` to `"AdoptionApplication"`, and three
senders never overrode it: the donation receipt, the sponsorship welcome and the caretaker
question. Their `EMAIL_SENT` and `EMAIL_FAILED` audit rows were filed under adoption applications.
That is not only a label: the audit viewer (`src/hooks/useAuditLogController.ts`) builds its
Adoptions tab from `entity === "AdoptionApplication"` and its Receipts tab from
`entity === "DonationReceipt"`, so receipt emails showed among adoptions and not among receipts.
It was seen in production data — the eleven `EMAIL_FAILED` rows local e2e wrote on 2026-09-14.

## What was chosen

- `entity` is a **required** argument of `sendRawEmail`. A new sender that omits it fails to
  compile, instead of silently inheriting another domain's name.
- Donation receipt → `DonationReceipt`, the name the Receipts tab already matches.
- Sponsorship welcome → `PetSponsorship`, as `src/actions/sponsorships.ts` names its own rows.
- Caretaker question → `Sponsor`, as `src/actions/sponsors.ts` names sponsor-portal rows.
- The four application emails state `AdoptionApplication` explicitly; their rows are unchanged.

## What this does not change

Rows already written keep the entity they were written with. The audit log is append-only, and
re-labelling production rows is a data change for the owner, not something a deploy should do.
Old receipt-email rows will go on appearing under Adoptions.
