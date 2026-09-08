# Never break the shared tree on purpose; the other session repairs it into history

**Learned:** 2026-08-28

This repo's own rule is to break a guard once and watch it fail — a guard never seen red is not
known to work. Applied to the newly union-keyed `FAQ_CATEGORY_LABELS`, that meant adding an eighth
member to `FaqCategory` to prove an unlisted category becomes a compile error. It does: TS2741, at
the single declaration. The property was real and the check was worth making.

But the injection lived in the working tree for about two minutes, and the parallel session read
the error as a genuine missing case. It added the label entry *and* an `adoption_events` member to
`FAQ_CATEGORIES` in the Zod validator, then committed both. Reverting the union afterwards did not
restore the status quo — it inverted the error (TS2353) and left a category nobody asked for in
history, out of sync with the type in one direction and the fixtures in the other. HEAD did not
typecheck until `4b06451`.

**Rule:** run deliberate breakage where the other session cannot see it. A detached worktree costs
one command — `git worktree add --detach <tmp> HEAD`, copy the files under test in, junction
`node_modules`, run `vitest` there — and the same technique already proved this session's tab work
green in isolation. Reserve in-tree injection for moments when the tree is provably yours, and
revert within the same tool call that injects. A transient error in a shared tree is not transient:
it is an open invitation to a concurrent agent that has no way to know it was staged.

Corollary for the reader on the other side: an error that appears in a file you are not working on,
for a symbol you have never heard of, is more likely someone else's experiment than a real gap.
Check `git diff` before filling it in.
