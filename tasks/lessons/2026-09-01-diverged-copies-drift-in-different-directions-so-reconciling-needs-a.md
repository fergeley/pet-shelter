# Diverged copies drift in different directions, so reconciling needs a decision

**Learned:** 2026-09-01

The commit convention lived in three files and all three disagreed: `CONTRIBUTING.md` gave
scopeless examples (`feat: add …`), `WHERE_CODE_GOES.md` required a scope, and
`.claude/agents/atomic-commit.md` specified a body wrap of 80 that nothing else mentioned. This is
the repo's known "anything written twice diverges" shape, with a wrinkle worth naming: they had not
drifted *together* away from an original, they had drifted **three different ways**. There was no
majority to trust and no most-recent copy to promote.

**Rule:** when consolidating duplicated knowledge, do not diff the copies and take the common
denominator — that silently picks a winner per disagreement and records none of the reasoning. Each
divergence is a decision that was never made. Enumerate them, decide each one explicitly, write the
decision down with its cost, and only then collapse to one copy and leave pointers. Here that
produced two settled conflicts (rule 3 binds on the summary; rule 2 is two-tier) whose rationale is
now the most useful part of the standard.
