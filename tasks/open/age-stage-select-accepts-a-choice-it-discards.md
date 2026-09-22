# The Age Stage select takes an operator's choice and throws it away

**Status:** open · opened 2026-09-22 · from PS-114, raised by review of PR #42

`PetFormDialog` renders "Age Stage" as an editable `<select>` over the four bands. Since PR #42
the value it collects is discarded on every path that could store it: `createPet` and
`petStore.addPet` no longer pass `ageCategory` through, and `withDerivedAge` and
`mapDbPetToPet` both recompute it from the birthday.

Deriving it is right — `tasks/decisions/2026-08-30-pet-age-computation-authoritative.md` settled
that, and a hand-set band is exactly the sort of value that rots as an animal ages. The defect
is that the control still accepts input. An operator who disagrees with the derived band and
changes it sees their choice revert after saving, with no error and no explanation. The helper
text beneath it ("Derived from age band boundaries") describes the system honestly and is
contradicted by the control being editable at all.

Not fixed in PR #42 because the safe shape is not obvious: the field is required by
`petFormSchema`, and simply adding `disabled` to a `register`ed select risks submitting
`undefined` and failing validation on a field the operator cannot reach to correct. Rendering
the derived band as read-only text, and dropping `ageCategory` from the form schema in favour of
deriving it server-side, is the change that actually matches the decision — and it is larger
than the birth date work.

**Settles when:** the band is presented as derived output rather than as an input — read-only
text, or a disabled control that provably still submits its value — or a maintainer decides
manual override should win, which would mean reversing the 2026-08-30 decision rather than
quietly contradicting it.
