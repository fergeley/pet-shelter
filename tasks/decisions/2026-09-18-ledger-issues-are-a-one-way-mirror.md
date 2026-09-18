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

**Identity is a hidden `<!-- ledger-mirror: <path> -->` marker at the top of the body; trust is the
`ledger` label.** The path is percent-encoded so the marker is printable ASCII for any file name:
four review rounds each found another raw name that could not round-trip (a space, `-->`, U+2028, a
control character GitHub might strip), and a marker that does not read back as its own path gains a
fresh issue on every run. Encoding closed the class instead of enumerating it; plain names encode to
themselves, so no existing marker changed. Titles get edited, so neither they nor the label identify an entry. But the
repository is public: anyone can open an issue whose body starts with a copied marker, and
the second review of this script showed that doing so would either stop every sync as a duplicate
or get the planted issue adopted as an entry's mirror, still editable by whoever planted it.
Only someone with triage rights can label an issue (this repository has no issue templates that
auto-apply one), so an issue counts as a mirror only with the marker *and* the label. The issues
are read filtered by that label, so spam cannot bury the mirrors — through GraphQL's
`repository.issues`, paged to the end, and deliberately not `gh issue list --label`: with a label
filter gh switches to the search index (`IssueSearch` under `GH_DEBUG=api`), which lags writes, so a
run queued behind another would miss the issue it had just created and create it again.
Everything else is never touched. That includes a real mirror a maintainer unlabels — but it is
detached, not opted out: its entry is still open, so the next run opens a fresh labelled issue. The
only way to stop mirroring an entry is to settle it. The marker counts only as the body's first line,
so an issue that quotes it is not taken for a mirror. A renamed entry is a new identity: its old
issue closes and a new one opens.

**Duplicates: an open issue beats a closed one; two open ones stop the run.** Picking between two
open issues would silently orphan one, so that stays a human call — but closing the wrong one is
all it takes, because a closed duplicate never displaces an open issue. If every duplicate is
closed, the oldest is the one reopened.

**A read that finds no entries may not close anything.** Zero entries beside open mirrored issues
stops the run. A ledger that empties in one step is far less likely than a broken read, and the
first review of this script found exactly one: `git ls-tree` without `--full-tree` resolved the
path against the caller's directory, so a run from `tasks/` read nothing and planned to close every
issue.

**Entries are read from `origin/<default branch>` after a fetch, never from the working tree.** Run
from a feature branch, a working-tree read would publish unmerged entries and close the issues of
entries that branch has not merged yet.

**An issue closes when its file leaves `tasks/open/`.** An entry closes by moving to `decisions/` or
by being deleted (`tasks/README.md`), and the script cannot tell which, so the close comment names
the `git log` that does. A closed issue whose entry is still in `tasks/open/` is reopened.

**`CLAIM-*` files are excluded.** They are session locks that live for one session.

**Dry run by default; `--apply` publishes.** The repository is public, and publishing is a one-way
door (`.claude/templates/triage-rules.md` §6).

**Synced by CI on every push to `master`, at the owner's request.** `.github/workflows/ledger-issues.yml`
runs `--apply` when `tasks/open/`, the script, or the workflow changes on `master`, and on demand.
Never on `pull_request`: a branch's entries are unmerged, and publishing them would make every PR a
one-way door. Runs queue in one concurrency group and never overlap, because two planning at once
would each create the same new issue — and that duplicate stops every later run.

Unobserved when this was written: that GitHub returns the marker byte-for-byte. That is a live
kill condition, in `tasks/open/ledger-issue-marker-round-trip-is-unobserved.md`.
