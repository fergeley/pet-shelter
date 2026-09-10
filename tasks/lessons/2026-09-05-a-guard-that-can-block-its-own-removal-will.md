# A guard that can block its own removal will

**Learned:** 2026-09-05

Twice in one session. First: disarming the hand-rolled fence was chained into one Bash call with a
`git checkout` used to verify the disarm — the fence denied the whole call, including the disarm.
One denied segment kills the entire tool call, which multiplies the annoyance cost far beyond the
measured 3%. Second, and better: an `autoMode.soft_deny` entry I had just written read *"Editing
.claude/settings.json … should not be changed casually by the party it constrains"* — and it then
refused my edit removing that very block.

**Rule:** the disarm path must not pass through the guard. Put the removal in its own tool call with
nothing else in it, and before writing a rule that covers configuration, work out who removes it and
whether they can. The second instance is not a bug — it is the principle working, and it is the same
principle that says an override belongs in the environment rather than in a repo file. It still
means the only actor who can undo it is the human.
