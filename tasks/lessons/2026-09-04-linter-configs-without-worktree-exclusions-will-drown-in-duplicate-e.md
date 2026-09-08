# Linter configs without worktree exclusions will drown in duplicate errors

**Learned:** 2026-09-04

Git worktrees created under `.claude/worktrees/` hold complete checkout trees that duplicate source files
without isolated or fully installed `node_modules`. Because Next.js and ESLint 9's flat config (`eslint.config.mjs`)
only ignored default build outputs (`.next/**`, `build/**`, `out/**`), `eslint` traversed into `.claude/`,
reporting 8,542 problems (322 fatal parsing/type errors). The noise completely buried the real syntax and type
errors in `src/`.

**Rule:** In repos that support agent worktrees or nested branch workspaces, add the worktree container
(e.g. `.claude/**`, `.worktrees/**`) to `globalIgnores` in the root linter config, not just `.gitignore`.
Linters inspect the working tree directly and do not always inherit gitignore rules.
