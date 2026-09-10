# Tests and mutants both only check the rules you thought of

**Learned:** 2026-09-02

Four holes in that linter survived 62 tests and 12 killed mutants. That is not a failure of either
technique, it is their shape: unit tests assert the rules the author imagined, and mutation testing
asks whether those tests discriminate against the code the author wrote. Neither can produce an
input nobody considered — a subject with a trailing space, a body of comment lines, an unclosed
fence, a summary opening on a backtick.

An adversarial read of the *inputs* found all four in one pass.

**Rule:** a green suite plus killed mutants means "the rules I wrote are enforced and my tests can
tell". It does not mean the rule set is complete. Before trusting a guard, enumerate the input
shapes rather than the rules: empty, whitespace-only, leading and trailing padding, the comment
character, an unterminated delimiter, a non-letter first character. Then check the new tests fail
against the old code — 9 of the 14 written here did, and the other 5 were controls that must pass
both ways.
