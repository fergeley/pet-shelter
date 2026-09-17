# Ledger issues are a one-way mirror of `tasks/open/`, keyed by a marker in the body

**Decided:** 2026-09-18

Asked for: a script that mirrors `tasks/open/` into GitHub issues. It is `scripts/ledger-issues.mjs`
(`npm run ledger:issues`). Each choice below is one someone could reasonably reverse.

**The file wins, and sync runs one way.** Memory lives in files, and a second copy of a list is a
copy that drifts (`AGENTS.md`, "Sub-agents"). So an issue description is regenerated from its file
and overwritten on every run; comments are never touched. The cost is that a conclusion reached in a
comment settles nothing until someone writes it into the file — the rendered header says so.
*Rejected — two-way sync* (issue edits written back as commits): it needs a bot with push rights and
conflict rules nobody has designed, and it turns an issue edit into a ledger write that skipped
review.

**Identity is a hidden `<!-- ledger-mirror: <path> -->` marker, not the title or a label.** Titles
get edited and labels get removed; the `ledger` label is presentation only. Issues without a marker
were filed by people and are never touched. Two issues carrying one marker stop the run rather than
letting it pick one. A renamed entry is a new identity: its old issue closes and a new one opens.

**Entries are read from `origin/<default branch>` after a fetch, never from the working tree.** Run
from a feature branch, a working-tree read would publish unmerged entries and close the issues of
entries that branch has not merged yet.

**An issue closes when its file leaves `tasks/open/`.** An entry closes by moving to `decisions/` or
by being deleted (`tasks/README.md`), and the script cannot tell which, so the close comment names
the `git log` that does. A closed issue whose entry is still in `tasks/open/` is reopened.

**`CLAIM-*` files are excluded.** They are session locks that live for one session.

**Dry run by default; `--apply` publishes.** The repository is public, and publishing is a one-way
door (`.claude/templates/triage-rules.md` §6).

**Not wired into CI.** A workflow that syncs on every push to `master` is the obvious next step. It
was deliberately not taken: it changes CI and publishes on every merge, which is the repository
owner's call, not a ride-along to the script.

Unobserved when this was written: that GitHub returns the marker byte-for-byte. That is a live
kill condition, in `tasks/open/ledger-issue-marker-round-trip-is-unobserved.md`.
