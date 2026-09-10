# A fresh worktree has no `node_modules`, so passing unit tests prove nothing about booting

**Learned:** 2026-09-09

In a worktree under `.claude/worktrees/`, Vitest, `tsc` and ESLint all worked, because `npx` walks
up the directory tree to the parent checkout's install. Turbopack refuses to — "files outside of the
workspace root are not compiled" — so `next dev` failed with `Could not find the Next.js package
(next/package.json)`. The error lists monorepo and workspace-root causes, none of which applied.

**Rule:** a worktree task that needs the running app (e2e, screenshots, manual checks) runs `npm ci`
inside the worktree first — `ci` rather than `install`, so the lockfile is not rewritten into the
diff. A green `npm run test:all` in a worktree is not evidence the app can start there.
