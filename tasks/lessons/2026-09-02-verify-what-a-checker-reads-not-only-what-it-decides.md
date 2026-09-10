# Verify what a checker reads, not only what it decides

**Learned:** 2026-09-02

The commit-msg linter enforced its seven rules correctly and was still wrong, because it was not
reading the bytes git commits. Two instances, found by review after it had merged and been armed:

- It stripped every line starting with `#`. `git commit -F` — the path this repo mandates — uses
  `cleanup=whitespace`, which **keeps** comment lines; only an editor session uses `cleanup=strip`.
  So a body made of `#` lines reported "no body", and a 90-column `#` line escaped the wrap check.
- It tested rule 4 against the untrimmed subject, so `"Add the button. "` passed while
  `"Add the button."` failed. Git trims the line, then commits the period the rule forbids.

Both are the same defect: the checker's input was not the artifact's input. Every rule test in the
suite was correct, and every one of them was asked about the wrong string.

**Rule:** when a gate protects a downstream artifact, prove the gate reads what the artifact will
contain, and prove it by producing the artifact — a scratch `git init`, one `commit -F`, and
`git log -1 --format=%B` settled this in under a minute. Reading the tool's documentation about
cleanup modes would not have; the default differs by invocation path.
