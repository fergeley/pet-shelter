# A probe that can report "missing" must be allowed to report "broken"

**Learned:** 2026-09-03

`git rev-parse <ref>:<path>` and `git cat-file -e <ref>:<path>` are silently rewritten by MSYS path
conversion in this Git Bash — `origin/master:.env.example` reaches git as `origin\master;.env.example`
and fails. It fires on some ref/path shapes and not others, so a loop over several branches returns
a believable mix of hits and misses rather than an obvious failure.

Wrapped in `2>/dev/null || echo MISSING`, the `fatal:` line vanished and the output read as data. It
produced a confident, wrong claim to the user — that a file was tracked only on two local branches
and any fix would be stranded — which a peer session caught. `git ls-tree` is the authority, and it
takes the ref as its own argument.

**Rule:** any probe whose negative result is itself a finding must let stderr through on at least
one run before the finding is reported. "Not found" and "the command never ran" are the same string
once stderr is discarded, and only one of them is evidence.
