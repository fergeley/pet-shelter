# Lessons

Patterns worth not repeating, captured after corrections.

## Collapsing role lists into permissions silently widens access

**2026-09-02, RBAC migration.** Rewriting `assertAuthorized(session, [ROLES.X])`
into `assertHasPermission(session, PERMISSIONS.Y)` looks like a refactor and is
not one. Two settings guards sat at *different* levels — `updateShelterSettings`
was `[ADMIN]`, `sendTestEmailAction` was `[ADMIN, COORDINATOR]` — and mapping
both onto one permission handed the coordinator the credential store.

**Rule:** before replacing a role list with a permission, diff the old allow-list
against the new permission's holder set, per call site. If the holder sets differ,
that is a behaviour change and needs its own decision, not a rename. `git show
<base>:<file>` is the source of truth for what the guard used to be — not memory.

## An audit log that records "before and after" records secrets too

`SETTINGS_UPDATED` serialised the whole settings object, so saving the form wrote
the live Resend API key into a log that `/admin/audit` renders to any holder of
`VIEW_AUDIT_LOG`. Redact by field-name pattern (`/(key|secret|token|password)$/i`)
so a future credential field is protected by default, and keep "was it set?"
without keeping the value.

## Verify a claimed bug before fixing it

Asserted a hydration mismatch in a column that calls `Date.now()` during render.
Checked it against a running build instead of shipping the fix: the component's
markup appears **0 times** in the SSR HTML, because the admin layout renders a
loading state instead of `{children}`. The premise was false and the "fix" would
have been noise.

**Rule:** a plausible mechanism is not evidence. `curl` the built page and grep
for the component's own strings before claiming anything about SSR.

## Prove a security test fails without the fix

A green suite proves nothing about a guard until the guard is removed. After each
security fix, reintroduce the defect, confirm the specific expected failures, then
revert. Re-granting `MANAGE_SETTINGS` produced 4 failures across 3 files; leaking
the invite failure reason produced 2. That is the evidence the tests are
load-bearing — see [[stress-test-all-the-way]].

## Don't inflate the value of an optimisation

Claimed ~25 call sites re-read the session per request. Wrong: server actions are
separate requests, so almost every path checks once. The real duplication was one
function reading it twice. The optimisation was still worth keeping — the
overstated justification was not. State the measured win, not the imagined one.
