# Sponsorship checkout accepts an animal the shelter has archived

**Status:** ASSERTED · opened 2026-09-22 · residual carried out of
`pet-profile-falls-back-to-a-fixture-the-database-lacks.md`, which was settled the same day

`createPetSponsorshipAction` in `src/actions/sponsorships.ts` resolves its target and then checks
only that something came back:

    const [pet, sponsorUserId] = await Promise.all([
      findServerPetByIdAsync(validated.petId),
      resolveCheckoutSponsorId(sponsorEmail),
    ]);
    if (!pet) { ... }          // ← the only check on the animal

`grep -n "isArchived" src/actions/sponsorships.ts` returns nothing. The public profile refuses an
archived animal — `getPetById` ends with `|| pet.isArchived` — and this path, which takes money,
does not.

Concretely: staff archive `pet-001`. `/pets/pet-001` returns 404. An unauthenticated POST to the
Server Action with `petId: "pet-001"` still resolves the row, passes `if (!pet)`, and records a
pledge with a real reference against an animal the shelter has taken down. Archiving is the
shelter's "take this down" action; it is currently taking down the page and not the checkout.

**Why it is filed separately rather than fixed.** The entry this came out of was settled by a
change to `findServerPetByIdAsync` — a missing row now returns `null` instead of a fixture
(`tasks/decisions/2026-09-22-a-pet-the-database-lacks-is-a-missing-pet.md`). That closed the
*missing-animal* half of the checkout exposure and not this one, because an archived animal is a
row the database really has: no repository-level rule distinguishes it, and the repository stays
unfiltered on purpose so the update and archive mutations can read the row they are about to
write. It is a caller check, and the caller is being rewritten wholesale on the unmerged
`codex/sponsorship-contract` branch, so a one-line guard added now would be written twice.

Found by review of the settling change rather than in production; no pledge against an archived
animal has been observed. The severity is that it takes money, not that it is known to have
fired.

**Settles when:** `createPetSponsorshipAction` refuses a pet whose `isArchived` is true, with an
integration test that arranges an archived row under a real `src/data/pets.json` id and asserts no
pledge is recorded — an id absent from the fixture would pass against the broken code for the
wrong reason. Worth deciding at the same time whether the refusal reuses
`SPONSORSHIP_RECORDING_UNCONFIRMED_MESSAGE`, which currently tells a supporter their pledge could
not be confirmed and invites a retry that can never succeed.
