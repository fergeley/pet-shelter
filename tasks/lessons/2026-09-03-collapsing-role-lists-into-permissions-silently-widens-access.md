# Collapsing role lists into permissions silently widens access

**Learned:** 2026-09-03

Rewriting `assertAuthorized(session, [ROLES.X])` into
`assertHasPermission(session, PERMISSIONS.Y)` looks like a refactor and is not one. Two settings
guards sat at *different* levels — `updateShelterSettings` was `[ADMIN]`, `sendTestEmailAction` was
`[ADMIN, COORDINATOR]` — and mapping both onto one permission handed the coordinator the shelter's
Resend and storage credentials. Before replacing a role list with a permission, diff the old
allow-list against the new permission's holder set, per call site. `git show <base>:<file>` is the
source of truth for what the guard used to be, not memory.
