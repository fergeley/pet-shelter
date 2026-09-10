# Sandbox any agent test whose lane can reach a build

**Learned:** 2026-08-30

Litmus-testing the Midwife spec, four tests were dispatched. Three ran in throwaway directories.
The fourth — a deliberately fuzzy ticket — was classified "read-mostly" and pointed at the live
repo, on the reasoning that investigating a vague complaint is exploration.

It triaged GRAVE, ran the full lane, and Phase 4 *is a build*. It made two real commits to a
shared branch. The work was good and was kept, but nobody had asked for it.

**Rule:** the blast radius of an agent test is the blast radius of the widest lane its prompt can
trigger, not the narrowest. A prompt that can be triaged GRAVE ends in a commit by design. Copy
the agent config into a scratch directory and point the run there, or accept that the test is a
change to the repository.
