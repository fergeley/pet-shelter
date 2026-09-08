# On a busy trunk, a branch is only as merged as its last sync

**Learned:** 2026-09-03

The QR branch needed four syncs with `origin/master` in one sitting. Between
them, the RBAC work, the FAQ CMS, sponsor photo notifications and the sponsor
portal all landed, and three of the four touched the same files. Each sync was
real work, not a formality: `serverStore.ts` was deleted mid-flight, a parallel
session shipped `settingsRepository.ts` doing the same job as this branch's
`domain/shelterSettings.ts`, and `SUPER_ADMIN` / `ANIMAL_MANAGER` — reported as
non-existent when the feature began — were added by the RBAC branch.

**Rules that came out of it:**

- **A `modify/delete` conflict on a file your branch depends on is the signal to
  stop merging and start porting.** Rebuild on the current trunk and re-apply
  each change; merging would have resurrected deleted files and shipped two
  settings layers.
- **Resolve in favour of what already landed.** Where a parallel session had
  fixed the same hole differently — `getAdminPets`, secret redaction — take
  theirs and delete your version, even when yours is arguably tidier. One
  approach on trunk beats two competing ones.
- **When both sides added, resolve as a union, not a side.** Two of the later
  conflicts were purely additive; picking either side would have silently
  dropped the other feature.
- **Read the other sessions' notes before assuming yours is the version to
  keep.** `tasks/open/` held a note predicting this branch's guard would flag
  the FAQ reads, and warning that "fixing" them with `assertAuthorized` would
  break the public category tabs. Following it saved a real regression.
- **Do not merge a long-lived branch into your local `master` while trunk is
  moving.** It forked a copy that served no purpose and had to be abandoned;
  the branch itself was the only thing that mattered. Leave `master` alone and
  let the PR land it.
