# `ln -s` on Git Bash silently deep-copies, and `lstat` will not tell you

**Learned:** 2026-09-10

Trying to give a worktree a `node_modules` for a Turbopack build, I ran `ln -s <target> <dest>`
in the Bash tool. It exited 0, printed nothing, and created **a real recursive copy of 622
packages**, several hundred megabytes, nested one level deeper than intended because the
destination directory already existed. MSYS falls back to copying when it cannot create a symlink,
and says so nowhere.

Cleaning up was the dangerous part. `fs.lstatSync().isSymbolicLink()` returned `false` and
`fs.realpathSync()` returned the path itself — both consistent with "real directory", but also
with a junction on some Node/Windows combinations, so neither settled it. Had I trusted a guess
and run a recursive delete on what was in fact a link, it would have followed into the real
`node_modules` and deleted the parent checkout's dependencies. The check that actually decides is
`fs.readlinkSync()`: it returns the target for a symlink or junction and throws `EINVAL` for a
genuine directory. Only after that did I delete, then re-counted the parent's 622 entries to
confirm it survived.

**Rule:** do not create links through the Bash tool on Windows — use `fs.symlinkSync(target, dest,
'junction')` from Node, which fails loudly instead of copying. Before any recursive delete of
something you believe is a link, prove it with `readlinkSync` and not with `lstat`/`realpath`, and
verify the *target* still exists afterwards. A cleanup that follows a link is how a mistake in a
scratch directory becomes a mistake in the repository.
