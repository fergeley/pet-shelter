# Your own background jobs are a load source

**Learned:** 2026-09-05

A full suite run reported **23 failures over 84 minutes** while two transcript-corpus replays ran in
the background, each spawning a node process per command across ~5,000 commands. Re-run with nothing
else going: **1,314 passed, 76 files, 58 seconds.** Only 2 of the 23 were real, and those were an
assertion about a config key I had just removed.

**Rule:** [[flaky-baseline-under-session-load]] applies to load you created yourself, not only to
the other sessions. Before reading a red suite as a regression, check what you left running —
`/tasks`, or the background IDs in your own transcript. A duration far above the known baseline
(~50s for this unit project) is the tell, and it is more reliable than the failure list.
