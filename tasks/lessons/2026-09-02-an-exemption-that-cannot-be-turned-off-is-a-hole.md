# An exemption that cannot be turned off is a hole

**Learned:** 2026-09-02

Rule 6 exempted fenced code blocks by toggling a boolean on each ``` line. An unbalanced fence —
one stray line in prose — latched it on and silently excused every remaining line, trailers
included, from the wrap check. Nothing reset it and nothing reported it. The exemption was not
wrong; its inability to recover was.

**Rule:** any state machine that suppresses a check needs a defined end, and a report when it does
not reach one. Count the delimiters first and refuse to trust unpaired ones, rather than toggling
optimistically and hoping the input closes. The same shape appears wherever a guard has an "unless"
— a skip flag, an ignore comment, a fixture that disables an assertion.
