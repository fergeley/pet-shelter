# Mutation-test the fix, not just the feature

**Learned:** 2026-09-03

Removing a raw-error leak felt obviously right, so it shipped without a test. Reintroducing the
defect proved it: the suite stayed green. Any security fix that a reintroduced defect does not break
is undefended. Six defects were re-injected on this branch; five failed loudly, one did not, and
that one was the bug in the test suite.
