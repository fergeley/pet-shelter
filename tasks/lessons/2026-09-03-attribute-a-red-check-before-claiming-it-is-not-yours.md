# Attribute a red check before claiming it is not yours

**Learned:** 2026-09-03

`Playwright golden paths` failed on the QR PR. Rather than assert it was
pre-existing, it was checked against master's own latest run: same job, same
assertion, same line 101, already failing there, with master's previous five
merges all landed red. That turns "probably not mine" into a fact worth acting
on, and it takes two commands.

The inverse also held in the same run: the unit failure alongside it *was* ours,
and the same check proved it — master was green on that job.
