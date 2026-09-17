# Bulletins are a per-browser demo that anyone can edit and no deploy can update

**Status:** open · opened 2026-09-18 · observed at `85ee351` in a jsdom scratch run; production not observed

The "Latest news and updates" section on `/`, and the feeds on `/pets` and `/bulletins`, read and
write nothing but `localStorage`. There is no Prisma model, server action, or repository reader for
bulletins: `grep -i bulletin` over `prisma/schema.prisma`, `src/actions`, `src/lib/server` and
`src/app/admin` returns only labels. `docs/tasks/TARGET_SCHEMA_TYPE_INTEGRITY.md` (P-D, 2026-08-27)
said as much and asked for a per-type decision; `tasks/decisions/` has none for `Bulletin`.

Three consequences, each observed in a scratch component test at `85ee351` (deleted afterwards):

1. **Nothing staff post reaches a visitor.** `BulletinFeed.tsx:96` toggles an editor and
   `bulletinStore.ts:27-33` writes the result to that one browser. The admin sidebar sends staff
   there anyway: `src/app/admin/layout.tsx:105` links "Community Bulletins" to the public
   `/bulletins`. `MANAGE_CONTENT` (`src/lib/security/permissions.ts:83`), `CONTENT_EDITOR`
   (`prisma/schema.prisma:16`) and `docs/runbooks/OPERATIONAL_RUNBOOK.md:116` all claim bulletins;
   nothing enforces or implements that claim.

2. **Every visitor gets the "Staff Admin Access" button, and it works.** The toggle has no session
   check (`BulletinFeed.tsx:1-18` imports nothing auth-related). Rendered with no session:

       BUTTONS_AFTER_TOGGLE [ 'Admin Mode Active', 'Post Update / Media', 'Reset to sample announcements',
         'Unpin notice', 'Edit bulletin', 'Delete bulletin', ... ]
       STORED_IDS_AFTER_ANON_DELETE [ 'bulletin-002', 'bulletin-003', 'bulletin-004' ]

   The damage stays in the visitor's own browser. It is still a staff control on three public pages.

3. **A redeployed seed never reaches a returning visitor.** The sync effect writes the seed into
   storage on the first visit, and the initializer prefers storage from then on
   (`bulletinStore.ts:13-15`). With the seed module swapped for a different one:

       RETURNING_VISITOR_TITLES [ 'Low-Cost Microchip & Vaccination Clinic This Saturday',
         'Urgent: Temporary Foster Homes Needed in Petaling Jaya' ]
       FRESH_VISITOR_TITLES [ 'NEW SEED NOTICE' ]

   Only renaming `STORAGE_KEY` (`hope_for_strays_bulletins_v1`) or the visitor pressing Reset gets
   past it. The server renders the seed while the client initializer reads storage, so a visitor
   whose copy differs also gets a hydration mismatch — observed as React's recoverable error under
   `renderToString` then `hydrateRoot`, **not** in a real Next render.

What `/` shows: the two pinned seed notices above, dated 2026-08-14 and 2026-08-12, unchanged since
`1cfa39c`. The seed is sample content — `bulletin-003` embeds YouTube video `dQw4w9WgXcQ`.
Production was not observed: the one deployment URL `gh api` returned is behind Vercel SSO.

The feed is also English-only (`Bulletin` has no Malay fields and `BulletinFeed` never calls
`useLanguage`); that half lives in `home-page-text-stays-english-on-the-malay-site.md`.

**Settles when:** bulletins get a server-side store written only through a `MANAGE_CONTENT`-guarded
action, with the public toggle gone — or the feeds come off the public pages until they do — and the
choice is recorded in `tasks/decisions/` as the answer to P-D for `Bulletin`.
