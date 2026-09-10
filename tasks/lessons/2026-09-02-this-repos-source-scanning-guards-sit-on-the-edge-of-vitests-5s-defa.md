# This repo's source-scanning guards sit on the edge of Vitest's 5s default

**Learned:** 2026-09-02

`shelterIdentity.test.ts` walks the whole `src/` tree synchronously to prove statutory literals are
confined to one module. It takes ~6s under full-suite parallel load on Windows and fails as
`Test timed out in 5000ms`, while passing in isolation in 2.7s. It surfaced only after unrelated
failures were fixed: those had been dying fast and leaving it headroom, so repairing one problem
appeared to create another. `agentGuard.test.ts` then failed the same way at 5507ms.

Two instances in one session. These guards are the tests that assert properties of the source tree
no behavioural test can see, which makes them the ones worth keeping and the ones most likely to be
deleted when they flake.

**Rule:** when a test fails only in a full run and passes alone, read the failure before theorising
— `Test timed out in 5000ms` is not an assertion failure and has nothing to do with the thing under
test. Give whole-tree scans an explicit timeout, and prove the timeout is wired by mutating it to
`{ timeout: 1 }` and watching it fail; an ignored option is indistinguishable from a generous one.
