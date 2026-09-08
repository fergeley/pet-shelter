# Documenting a defect is not a substitute for fixing it, and "latent" is a tell

**Learned:** 2026-09-08

I logged the above in `tasks/open/` with a settles-when, and moved on. The entry was accurate,
well-written, and functioned as a way of not doing the work. The giveaway was in my own sentence:
"not a correctness bug today ... no `home_*` row exists yet" — the row does not exist yet *because
the feature shipped in the same branch*. A defect that only waits for a user is not latent.

**Rule:** a ledger entry is for something you cannot resolve — a genuine unknown, or a fix that
needs a decision or an owner you do not have. If you can name the failing sequence concretely
enough to write it down, you are usually close enough to fix it. Before filing, ask what the entry
is protecting: the codebase, or the size of the diff.
