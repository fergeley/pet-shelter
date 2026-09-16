# Gating an input is half the job; the assertions about it are the other half

**Learned:** 2026-09-09

`/code-review high` found the defect I had congratulated myself on closing in PR #36. I made the tax
identifier conditional and left every surface that *asserts* deductibility unconditional — so
unticking the box still produced a receipt headed "TAX DEDUCTION DOSSIER", still printing the LHDN
reference, still emailing "valid for tax filing under Section 44(6)" with no NRIC on it. Worse:
because I had just made unticked the **default**, I turned an edge case into the ordinary path.

The decision document written in the same change states the goal as stopping "a receipt that
announces itself as tax-deductible while carrying nothing to deduct against". I wrote the sentence
and then did not check the four places that say it.

**Rule:** when a field becomes optional or conditional, grep for every surface that makes a claim
*about* that field, not only the ones that read it. Input validation and output assertions are two
lists, and shrinking the first without the second is how a document starts lying. One predicate
asked at every site — here `isTaxClaimable` — is also what keeps them from drifting apart.
