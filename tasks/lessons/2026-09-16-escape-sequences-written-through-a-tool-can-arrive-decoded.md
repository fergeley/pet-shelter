# Escape sequences written through a tool can arrive in the file already decoded

**Learned:** 2026-09-16

This lesson spells every escape sequence out in words — backslash, the letter u, hex digits — for
the reason it describes. Do not rewrite it with the literal sequences.

PR #38 fixed a stored XSS by serialising the pet profile's JSON-LD with every less-than sign
replaced by its six-character JSON unicode escape (backslash, u, 003c). The code came out right. The
*comments* explaining it did not: wherever the prose contained that escape literally — in the
source file, its test and the work-stream write-up — the file-writing tool decoded the sequence back
into a plain `<` on the way to disk. The comment on the security fix therefore read "escape `<` as
`<`": a description of a no-op, sitting above the one line that stopped the attack. A later review
caught it. A maintainer trusting that comment could reasonably have deleted the `.replace` as
redundant and reopened the hole.

The code survived only because it had been written with the backslash doubled, which the same
decoding reduced to the single backslash the source needed. Nothing in the edit's result showed the
difference — the tool reported success both times — and reading the file back as rendered text does
not reliably show it either. What settled it was printing each line through `JSON.stringify`, so
backslashes were visible, and running the serialiser on `</script>` to observe its output.

The same session produced two more cases of one tool silently changing text on its way somewhere
else: `sed` and Windows argument parsing both mangled a backslash next to a quote, and Git Bash
rewrote an argument beginning with `/` into a Windows path, so a mutation meant to prove a test
caught the regression never applied.

**Rule:** when writing text that contains an escape sequence — unicode escapes, regex escapes, a
backslash beside a quote — treat the file as unverified until you have seen its bytes. Print the
relevant lines with `JSON.stringify` (or `od -c`) rather than reading them rendered, and for code,
execute it on an input that distinguishes the escaped from the unescaped result. In prose, prefer
describing an escape in words over printing it. For anything passed on a command line, use a
script that refuses unless its pattern matches exactly once, and set `MSYS_NO_PATHCONV=1` for
arguments that start with `/`.
