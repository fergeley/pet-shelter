# Settings arrays are replaced by the highest-precedence source, not merged

**Learned:** 2026-09-05

Adding `autoMode.environment` to `.claude/settings.json` appears to have discarded all 23 entries of
the `~/.claude/settings.json` profile for this project — including a warning that this repo is
**public** and a PDPA data-location entry. The tell is in the schema: `$defaults` exists to
re-inherit the *built-in* rules at a chosen position, and there is no `$user` equivalent. If arrays
merged across sources, neither sentinel would be needed.

Marked **ASSERTED** — inferred from the sentinel design, not measured, and I could not measure it
because the classifier refuses edits to either settings file.

**Rule:** before adding an array-valued key at project level, read the same key at user level. If it
has entries, either extend it in place or accept that yours replace it — and say which, in the
entry. `permissions.allow/deny/ask` may behave differently (deny rules are documented as
cumulative); do not assume one answer covers both keys.
