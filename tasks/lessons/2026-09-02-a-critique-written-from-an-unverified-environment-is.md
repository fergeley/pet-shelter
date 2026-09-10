# A critique written from an unverified environment is confidently wrong

**Learned:** 2026-09-02

Asked to self-critique, I reported that a target doc's baseline of "60 test files / 829 tests green"
was badly stale, citing 11 local failures. Measured properly afterwards: the file count was right,
the test count was off by one, and *green was true*. The 11 failures were my own broken environment.
In the same critique I called the audit range a trap where "the doc pins one form and CI uses
another" — but the doc pins a **rev** (`28159f3`), whose ancestor set is fixed and immune to later
merges. Only my own ad-hoc `28159f3..HEAD` was affected.

Two confident, specific, wrong indictments of my own work, produced by the same failure the critique
was complaining about, one level up. The doc did have a real defect — it never named the
`prisma generate` precondition — but that is not what I accused it of.

**Rule:** a critique is a set of assertions and gets no exemption from verification. Before naming
something a defect, reproduce it from a known-good environment; "I ran it and it failed" is a claim
about the environment until proven to be a claim about the code. Self-criticism feels rigorous,
which is exactly why an unverified one passes review unchallenged.
