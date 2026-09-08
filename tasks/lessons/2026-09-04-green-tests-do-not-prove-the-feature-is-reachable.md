# Green tests do not prove the feature is reachable

**Learned:** 2026-09-04

A notification feature shipped with a schema, a validator, a server action, an email
template, a dispatcher and 251 passing tests. Nothing anywhere set `targetPetId`, so
the audience query always returned empty and not one email could ever have been sent
to a real donor. Every test seeded the sponsor directory directly and so never
exercised the one path that fills it in production.

Worse, the fix was applied to one of the two entry points. The per-pet modal was
corrected; the general donate widget was missed and kept sending no ID at all. The
lesson was written down between those two commits and did not prevent the second.

**Rule:** for a new feature, trace the data from the real UI entry point to the consumer
at least once. The question is "what writes this row in production?", not "does my test
write it?". Then enumerate *every* entry point — a fix applied to one caller of two is
not a fix.
