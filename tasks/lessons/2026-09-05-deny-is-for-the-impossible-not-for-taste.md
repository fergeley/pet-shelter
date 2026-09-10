# `deny` is for the impossible, not for taste

**Learned:** 2026-09-05

`Read(./node_modules/**)` was added to keep dependency source out of context. It also forbade
`node_modules/next/dist/docs/`, which `AGENTS.md` **mandates** reading before writing Next.js code,
and it blocked `find . -path ./node_modules -prune` — the idiom whose whole purpose is to *not* read
that directory. The path resolved against the project root regardless of the shell's cwd.

A context-hygiene preference was enforced as a hard security fence, and it contradicted a standing
instruction in the same repo.

**Rule:** `permissions.deny` carries what must be impossible. Context hygiene is a judgment call and
belongs in judgment. Before adding a path rule, check whether any instruction in the repo requires
reading that path — and remember the rule matches shell commands that merely name it.
