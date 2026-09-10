# A named external standard outranks the repo's habit, and the corpus is not the spec

**Learned:** 2026-09-01

Asked for commit guidelines from Chris Beams' seven rules, the first move was to measure this
repo's 203 commits against them and let the measurements soften the rules: 92% of subjects exceed
50 characters, 94% write a lowercase summary, and the body wrap in `atomic-commit.md` had already
drifted to 80. Reporting that as "here is what the repo actually does" turns a standard into a
description, which is the one thing a standard is not. The correction was one line: *defer to
Beams*.

Measuring was still right — it produced the honest baseline (0 of 203 pass), found five commits
whose subject is a bare `@` from a PowerShell here-string, and forced the two genuine conflicts to
be *settled and written down* rather than averaged away: rule 3 binds on the summary after the
colon because `Feat(ui):` would break every parser, and rule 2 is two-tier because Beams himself
asks for 50 and notes GitHub truncates at 72.

**Rule:** when the human names an external standard, implement it faithfully and let existing habit
be the thing that changes; grandfather the history instead of diluting the rule. Measure the corpus
to find the *conflicts* and to size the cost of adopting — never to lower the bar to what the
corpus already does. Where the standard and the codebase genuinely cannot both hold, decide, say
which one moved, and put the number on it.

**And:** a guard that passes on its first run has proved nothing. This one's 62 tests were all green
immediately; a 12-mutant run then showed 11 real kills and one test that passed whether or not the
code worked. Mutate before believing — it costs one throwaway script.
