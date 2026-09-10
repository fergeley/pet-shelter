# A destructive helper in a shared location must prove provenance

**Learned:** 2026-09-02

`install-git-hooks.mjs` wrote `.git/hooks/commit-msg` unconditionally and `--uninstall` removed
whatever carried that name. Hooks live in the **common** git directory — the fact the script's own
docstring stressed — so the file it clobbers may belong to the main checkout, another worktree, or
husky. Its stated goal, not installing a hook the human did not ask for, was enforced by nothing but
the argument the caller typed. Naming no hook with `--uninstall` printed the roster and exited 0,
which reads exactly like a successful removal.

**Rule:** before overwriting or deleting a file in a location you share, prove you wrote it —
compare against the source you would install — and refuse otherwise, with `--force` as the
deliberate way through. A no-op that exits 0 is worse than an error, because the caller believes it
worked. Test this in a throwaway repo, never against the live artifact.
