# A long-lived branch stops being a merge and becomes a port

**Learned:** 2026-09-03

The QR branch was cut before `src/lib` was reorganised into `client/`, `server/`
and `presentation/`. By the time it was ready, `serverStore.ts` had been deleted
and split into repositories, and a second session had built
`server/settingsRepository.ts` doing the same job as its `domain/shelterSettings.ts`.
Merging would have resurrected deleted files and shipped two settings layers.

Rebuilding the feature on top of `origin/master` and re-applying each change was
the cheaper and safer path. The signal to stop merging and start porting is a
`modify/delete` conflict on a file the branch depends on. Read the other
session's notes before assuming your version is the one to keep — the guidance
here had already moved on from "keep master's".
