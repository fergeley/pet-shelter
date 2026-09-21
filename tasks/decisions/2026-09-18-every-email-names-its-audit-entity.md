# Every email names its own audit entity; there is no default

**Decided:** 2026-09-18

Closes `tasks/open/email-audit-rows-name-the-wrong-entity.md`.

`sendRawEmail` in `src/lib/email.ts` defaulted `entity` to `"AdoptionApplication"`, and three
senders never overrode it: the donation receipt, the sponsorship welcome and the caretaker
question. Their `EMAIL_SENT` and `EMAIL_FAILED` audit rows were filed under adoption applications.
That is not only a label: the audit viewer (`src/hooks/useAuditLogController.ts`) builds its
Adoptions tab from `entity === "AdoptionApplication"`, so receipt emails showed among adoptions.
It was seen in production data — the eleven `EMAIL_FAILED` rows local e2e wrote on 2026-09-14.

## What was chosen

- `entity` is a **required** argument of `sendRawEmail`. A new sender that omits it fails to
  compile, instead of silently inheriting another domain's name.
- Donation receipt → `DonationReceiptEmail`, which no tab or export matches. **Not**
  `DonationReceipt`, the first choice: code review found three readers that treat that entity as
  a donation — the viewer's receipt list (`receiptLogs`), whose length is the tax export's
  completeness check; the LHDN CSV fallback (`generateReceiptsCsvString`); and the row highlight
  in `AuditLogViewer`. Filed there, every receipt email doubled the count, raised a false "do not
  file as a complete return" warning, and became a zero-amount line in a tax file. The same trap
  is why the pet photo update is `SponsorNotification` and not `Pet`.
  `tests/unit/emailAuditEntity.test.ts` now checks the CSV itself, not only the label.
- Sponsorship welcome → `PetSponsorship`, as `src/actions/sponsorships.ts` names its own rows.
- Caretaker question → `Sponsor`, as `src/actions/sponsors.ts` names sponsor-portal rows.
- The four application emails state `AdoptionApplication` explicitly; their rows are unchanged.

## What this does not change

Rows already written keep the entity they were written with. The audit log is append-only, and
re-labelling production rows is a data change for the owner, not something a deploy should do.
Old receipt-email rows will go on appearing under Adoptions.
