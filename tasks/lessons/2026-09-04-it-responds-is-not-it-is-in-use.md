# "It responds" is not "it is in use"

**Learned:** 2026-09-04

Eight abandoned `next start` servers were pinning worktree directories on Windows,
holding `next-swc.win32-x64-msvc.node` open so the directories would not delete. The
obvious liveness test — does the port answer HTTP — said all eight were alive. Seven
were returning 500.

Measuring instead of probing settled it: zero CPU consumed across a 25-second sampling
interval, and zero established TCP connections. All eight were idle and safe to kill,
which the HTTP check could never have shown.

**Rule:** an HTTP *error* still proves something is listening, so a response is evidence
of a process, not of a user. When the question is "is anyone using this", measure
activity over an interval — CPU delta, open connections — and scope any kill to
command lines you have actually read.
