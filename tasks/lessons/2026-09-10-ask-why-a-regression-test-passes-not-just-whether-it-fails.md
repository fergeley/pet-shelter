# Ask why a regression test passes, not just whether it fails

**Learned:** 2026-09-10

Having fixed the above, I wrote four DB-backed tests and did the right thing: reverted the fix and
confirmed they went red. **Two of four went red. The archived-animal case stayed green** — the one
assertion the whole exercise existed to protect.

It used the id `itest-archived`, consistent with the file's other fixtures. That id appears in no
`pets.json` row, so against the broken mirror-reading code the lookup returned `null` for *not
found* rather than for *archived*, and `toBeNull()` was satisfied either way. The test asserted
the right outcome through the wrong mechanism. Repointing it at `pet-001` — a real fixture row,
present and unarchived in the mirror — is what made it discriminate, and that is also the exact
production scenario: staff archive an animal that the fixture still lists as available.

A red/green check answers "does this test respond to this bug." It does not answer "does it
respond *for the reason I think*." Where the arrangement and the assertion can both produce the
same result down two different paths, only reading the failure tells them apart.

**Rule:** when a regression test does not go red under the reverted fix, that is data, not noise —
stop and find out why before adjusting the assertion. And when it does go red, check the failure
message names the mechanism you meant. Prefer fixture identifiers that already exist in the
fallback data, because an id absent everywhere makes "not found" and "correctly filtered"
indistinguishable.
