# A blocklist over shell text has an unbounded defect surface

**Learned:** 2026-09-05

The parser's defect count per independent review pass: **8, then 12, then 14.** The rate never fell.
Each fix opened a new seam, and one fix for a false positive introduced a *fail-open* bypass
(stripping heredoc bodies to stop denying documentation meant `bash <<EOF … git reset --hard … EOF`
was skipped entirely). `gitWrites()` in the same file had already written the reason down: *"a
blocklist is only as good as its author's imagination."*

**Rule:** when a check must classify free-form shell text, the defect count per pass is the metric,
not the defect count. A rate that does not converge is a statement about the design, and no further
round fixes it. Either invert to an allowlist over a bounded vocabulary, or move the check to a
layer where the input is structured — a tool name, a file path, a first-party matcher.
