# Verify against git before reporting data loss

**Learned:** 2026-08-28

Mid-task I reported that the other session had reverted `prisma/seed.ts` and destroyed its rehab and
history seeding. It had not. Its `npm install` was rewriting `package.json` in place, and file reads
during that window returned partial or stale content — including one snapshot with git conflict
markers that never existed on disk a second later.

**Rule:** before reporting that work was lost, confirm with `git diff HEAD -- <path>` and
`git show HEAD:<path> | grep -c <marker>`. A single read of a file in a repo with a concurrent writer
is a sample, not a fact. State the correction plainly and move on — see also
`docs/tasks/TARGET_PERSISTENCE_TARGETING.md` §8.
