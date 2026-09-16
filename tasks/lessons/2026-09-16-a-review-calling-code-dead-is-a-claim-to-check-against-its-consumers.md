# A review calling code dead is a claim to check against its consumers, not an instruction

**Learned:** 2026-09-16

PR #38's gallery preselected an animal for the Adoption Form with
`filteredPets.find(isAdoptable) ?? pets.find(isAdoptable) ?? null`. The fourth review called the
middle fallback dead: `resolveDefaultPet`, which receives the selection, already picks the first
Available animal from the same array when handed `null`, and `isAdoptable` is true for exactly that
status. The reasoning was sound as far as it went, the two expressions do pick the same animal, and
I removed it.

The fifth review found it was load-bearing. The form copies a selection into its fields only when it
receives a real pet — `if (selectedPet && open)` in `useAdoptionFormController`. Handed `null`, the
form's *title* followed `resolveDefaultPet` while its `petId` kept whatever the previous opening had
left, so reopening inside the close animation named one animal and would have submitted for another.
The "redundant" branch was the only thing guaranteeing that effect ran.

"These two produce the same value" and "this branch can be deleted" are different claims. The first
is about the expression; the second is about everything that *observes* the expression — and a
`null` and a pet are not interchangeable to a consumer that branches on truthiness, even when both
lead to the same pet being shown. The review checked the first and asserted the second. I did not
check either before deleting, and two reviews then contradicted each other.

**Rule:** before removing code a review calls dead or redundant, open every consumer of the value it
produces and check what each does with it — not whether the final visible result matches. Pay
particular attention to the difference between `null`/`undefined` and a real value flowing into an
effect, a guard or a truthiness check. When a later review contradicts an earlier one, neither is
evidence; the consumer's code is. See
[[2026-09-03-self-review-is-blindest-where-it-is-most-confident]]: a confident review of someone
else's code is blind in the same place.
