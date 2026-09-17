# Nobody has seen GitHub return the ledger mirror's marker intact

**Status:** ASSERTED · opened 2026-09-18

`scripts/ledger-issues.mjs` finds the issue for an entry by the hidden comment
`<!-- ledger-mirror: tasks/open/<slug>.md -->` at the top of the issue body
(`tasks/decisions/2026-09-18-ledger-issues-are-a-one-way-mirror.md`). That relies on
`gh issue list --json body` handing back the body as submitted, HTML comment included.

The only evidence is next door: PR #34's body came back from `gh pr view --json body` with Vercel's
invisible `[vc]: #…` reference definition intact. That is the same raw-markdown storage, but it is a
pull request and a link definition, not an issue and an HTML comment. The unit tests cover the parser
against CRLF, not GitHub itself. Checking directly means publishing, which is a one-way door, so it
has not been done.

**Kill condition (registered before the first publish, immutable):** right after the first
`npm run ledger:issues -- --apply`, a second `npm run ledger:issues` prints `in sync, nothing to do`.
If it plans any `create` line instead, the marker did not survive: **DIED** — close the duplicates
and key identity some other way before running `--apply` again. If it plans only `update` lines,
identity survived but GitHub rewrote the body: not DIED, but every run would rewrite every issue, so
fix the comparison before anyone automates the sync.

**Settles when:** that second run has been observed, with its output quoted here or in the commit
that deletes this entry.
