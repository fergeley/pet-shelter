# The pre-commit hook is written but not installed

**Status:** open · opened 2026-08-30

`.claude/hooks/pre-commit` exists and is inert. It is not in `.git/hooks/`, so it does nothing.
Installing it would also apply to the concurrent session working this branch, which is why it
was not installed unilaterally.

**Settles when:** the human either installs it (`cp .claude/hooks/pre-commit .git/hooks/ &&
chmod +x .git/hooks/pre-commit`) or says to drop it, at which point this entry and the file go.
