# `tasks/lessons.md` is split into one file per lesson

**Decided:** 2026-09-11

Closes `tasks/open/lessons-md-collides-like-the-old-ledger.md`, which is deleted in the same
commit. That entry measured the defect, escalated it on 2026-09-02 when a conflicted PR was found
to receive no GitHub Actions run at all, and listed three fixes, recommending the first. It was
blocked on a human choosing. The human chose it on 2026-09-11.

## What prompted the decision now

The same day, a seven-step session close was made standing procedure in `CLAUDE.md`, and step 4
writes lessons every session. On a single append-point file that turns an occasional conflict
into a guaranteed one, and the conflict's cost was never the manual resolve — it is that GitHub
runs `pull_request` workflows against the computed merge commit, which a conflicted PR does not
have, so the branch silently loses its whole verification pipeline until someone notices.

## The layout

    tasks/lessons/<YYYY-MM-DD>-<slug>.md

    # <title>

    **Learned:** YYYY-MM-DD

    <the pattern, and its **Rule:**>

The same construction `open/` and `decisions/` already use, for the same reason: two sessions
never write the same path, so git merges the directory with no driver, lock or protocol. There is
deliberately **no index file**. An index everyone appends a line to is `lessons.md` again under
another name. Read the directory: `cat tasks/lessons/*.md`, which sorts by date because the
filename starts with one.

## How the split was done

A one-shot script, not by hand — 94 entries. It split only on `## ` headings outside code fences,
refused on an unbalanced fence, refused on a slug collision, refused to write into a non-empty
directory, and compared every non-blank body line of the source against the planned output before
deleting anything. All 1,077 body lines survived; the only permitted change was trimming blank
lines at block edges. A dry run preceded the write.

93 headings carried a leading date. One did not — *"Read the branch you are merging into before
you build on the one you left"*, which sat in the file between the 2026-08-31 and 2026-09-01
entries. Its own body opens **"2026-09-03."**, and `git log -S` puts its first commit on
2026-09-03, so it was filed under that date: two observed sources agreeing, over its position in
the file. The collision ledger's author had not been able to place it either, listing it as
"2026-09-01 or 08-31 (the tail)".

Two preamble lines were dropped: the `# Lessons` title and *"Patterns worth not relearning.
Newest first."* The second had been false for a long time — entries were appended at the tail —
and the collision ledger had already recorded that. `tasks/README.md` now describes the directory
instead.

## Pointers updated, and pointers deliberately not

Updated, because they instruct future action: `CLAUDE.md` (three places, including the new close
procedure), `tasks/README.md`, the `remove-legacy-admin-token` command and its skill mirror, the
unchecked checklist item in `docs/tasks/TARGET_LEGACY_ADMIN_TOKEN_REMOVAL.md`, the reading
instruction in `docs/tasks/TARGET_MIDWIFE_ADOPTION.md`, and two live `open/` entries — one of which
now names the exact lesson file it cites instead of the whole directory.

Left as written: every entry in `decisions/` and the handoff and review docs under `docs/tasks/`.
This directory's own rule is that an old entry describing a superseded layout stays as written,
because it was true when written; `tasks/README.md` says those citations mean `tasks/lessons/`.

## The one-time cost

A branch still open with an uncommitted or unmerged append to `tasks/lessons.md` will hit a
modify/delete conflict when it meets this. That is paid once, where the old layout charged it on
every concurrent pair of sessions. The resolution is mechanical: take the appended entry, write it
as `tasks/lessons/<date>-<slug>.md` in the shape above, and accept the deletion.

Option 2 from the closed entry — `merge=union` in `.gitattributes` — was not taken: union merge
interleaves silently, which is wrong for dated prose and hides the very loss it exists to prevent.
