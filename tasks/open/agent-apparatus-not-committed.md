# The Midwife apparatus is not under version control

**Status:** open · opened 2026-08-30

`tasks/decisions/`, `tasks/open/`, and all of `.claude/agents|hooks|templates/` are untracked.
They exist on disk only — one `git clean` from gone, and invisible to every other clone.

They were deliberately not committed: a concurrent session on this branch stages with
`git add -A`, so committing them from inside another task would have shipped that session's
in-flight work under an unrelated message.

**Settles when:** the human commits the agent apparatus — ideally as its own commit, staged by
explicit path.
