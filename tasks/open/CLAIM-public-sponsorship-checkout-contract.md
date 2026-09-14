# CLAIM - public sponsorship checkout reaches the commitment ledger

**Status:** open - opened 2026-09-14 - owner Codex `/root` - lane GRAVE
**Branch:** `codex/sponsorship-contract`, cut from `origin/master` at `690a09c`.
**Phase:** 2 - falsification

**Paths:** `src/hooks/useSponsorshipController.ts`,
`src/components/features/pets/SponsorshipModal.tsx`,
`src/actions/donations.ts`, `src/components/features/donations/DonationWidget.tsx`,
`src/lib/domain/contributionFailure.ts`, `src/lib/domain/petSponsorship.ts`, `src/lib/email.ts`,
`tests/components/SponsorshipModal.test.tsx`, `tests/unit/petSponsorship.test.ts`,
`tests/components/DonationReceiptIntegrity.test.tsx`, focused sponsorship-email coverage, and a close-out decision under
`tasks/decisions/2026-09-14-*.md`.

The concurrent Claude claim `CLAIM-sponsorship-reconciliation-atomic.md` owns the receipt,
reconciliation-action, repository, admin-queue, and database-test paths. Its owner has
acknowledged this split and will preserve `createPetSponsorshipAction`'s input and creation-result
contract. This claim will not edit that session's paths.

## Phase 0 - frame

**Problem:** The public modal is used both for general donations and pet-specific sponsorships,
but its controller always calls `submitDonationPledgeAction`. A pet selection therefore produces
an immediate `Donation` receipt rather than a pending `PetSponsorship`, leaving the existing
coordinator queue unreachable from its intended public UI. The same modal also promises a receipt
while a pet pledge is still unverified, enforces the general RM5 floor instead of the sponsorship
RM10 floor, and prints statutory-relief claims without the explicit opt-in used by the canonical
donation form.

**Claim:** Keep one modal and give its controller a strict checkout-result union. With a target pet,
call the existing `createPetSponsorshipAction`, enforce RM10, show the `HFS-PLG-*` acknowledgement,
and never write the result to the donation-receipt store. Without a target pet, preserve
`submitDonationPledgeAction` and its immediate receipt path. Reuse the existing explicit tax-receipt
opt-in and `isTaxClaimable` boundary so neither branch makes an unconditional statutory claim.

**frame-confidence:** high - the four call sites, both action contracts, the current controller,
and the merged reconciliation decision were inspected at `origin/master`.

## Phase 1 - assumption stack

- **A1 [MEASURED]** Two modal call sites pass a target pet and two do not; the controller currently
  calls only `submitDonationPledgeAction`, while production code has no caller of
  `createPetSponsorshipAction`.
- **A2 [ASSERTED]** A discriminated controller result can preserve the no-pet donation behavior
  while routing a target pet to the pending-pledge action. Cheap check: one component test per
  branch, with both server actions observed.
- **A3 [MEASURED]** Pet sponsorship validation requires RM10 while general donation validation
  permits RM5. Cheap check: component validation at RM5 for both contexts.
- **A4 [ASSERTED]** A successful pledge can be rendered without any issued-receipt or statutory
  wording and without a receipt-store write. Cheap check: assert the pledge reference is shown,
  receipt identifiers/print control are absent, and the store spy is untouched.
- **A5 [MEASURED]** The canonical donation form sends `wantsTaxReceipt` and gates relief wording
  through `isTaxClaimable`; this modal does neither. Cheap check: an opted-out general receipt must
  not render Section 44(6) or a tax reference.
- **A6 [MEASURED]** The modal offers both DuitNow QR and Maybank transfer while every submission is
  recorded as `duitnow_qr`. Cheap check: select each visible rail and observe the action payload.
- **A7 [MEASURED, review expansion]** The newly reachable welcome email promises Section 44(6)
  relief even when no tax identifier was supplied. Cheap check: render both welcome-email bodies
  for an identifier-free pledge and reject statutory-relief wording.
- **A8 [MEASURED, review expansion]** A completed checkout survives close/reopen or a target-pet
  change. Cheap check: rerender the shared modal from Bella to Max and reopen it; no Bella result or
  prior supporter PII may remain.
- **A9 [MEASURED, review expansion]** Both public external-transfer surfaces say "Nothing has been
  charged" on an action or network failure even though neither application layer can observe the
  bank rail. Cheap check: make each action fail after the transfer controls were shown and reject
  that assurance while retaining contact-before-retry guidance. A lost response cannot prove the
  opposite either, so the browser must say that it could not confirm the ledger outcome.

### Fence sweep

- **F1** No-target callers rely on the existing general donation action and immediate receipt.
  Preserve it and pin it independently from the target-pet branch.
- **F2** The shared modal preserves target-pet identity and existing payment instructions, but
  pending-pledge success must not imply payment verification.
- **F3** Only a real `DonationReceipt` enters `saveDonationReceipt`; a pledge DTO never does.
- **F4** No client-generated pledge or receipt fallback. Failed actions leave no success state.
- **F5** No production database mutation, outbound email, migration command, or browser submission;
  validation uses mocked component boundaries only.
- **F6** No path owned by the concurrent atomic-reconciliation claim is edited here.

## Kill conditions - registered before the spike; immutable

- **K1 (A2)** Fires if a target-pet component probe does not fail against unchanged `origin/master`
  specifically because the donation action is called instead of `createPetSponsorshipAction`.
- **K2 (A2/F1)** Fires if the implementation routes a no-target submission anywhere except the
  existing donation action or ceases to render its returned receipt.
- **K3 (A3)** Fires if RM5 can reach the target-pet server action, or if RM5 stops reaching the
  general donation action.
- **K4 (A4/F3)** Fires if a pledge success writes the receipt store or renders `HFS-DON`,
  "receipt issued", Section 44(6), or the print-receipt control.
- **K5 (A5)** Fires if an opted-out donation receipt still renders statutory-relief language or a
  tax-reference field.
- **K6 (A6)** Fires if the default rail stops submitting `duitnow_qr`, or choosing Maybank transfer
  does not submit `online_banking`.
- **K7 (A7)** Fires if an identifier-free pledge's on-screen acknowledgement or welcome email says
  Section 44(6), tax-exempt, or otherwise promises claimability before reconciliation.
- **K8 (A8)** Fires if closing/reopening or changing `targetPet.id` preserves a completed result or
  supporter identity from the prior checkout.
- **K9 (A9)** Fires if any target-pet or general-donation write/network failure claims that no money
  moved, or fails to tell someone who already transferred how to reconcile it before retrying.

**Settles when:** the discriminating baseline is observed, all kill conditions pass after the
smallest implementation, the relevant component/unit/check/build gates are recorded, the atomic
claim's final contract is reconciled, a decision is written, and this claim is deleted.
