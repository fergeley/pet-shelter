# The hero mounts a quiz and a sponsorship dialog that nothing can open

**Status:** open · opened 2026-09-18 · observed at `85ee351`

`Hero.tsx:134-135` holds `isQuizOpen` and `isSponsorshipOpen`, and `:248-256` mounts `PetMatchQuiz`
and `SponsorshipModal` with them. The setters are passed only to the dialogs' own `onOpenChange`,
which can close a dialog but never open one. The buttons that opened them were removed in two
separate changes, and neither removed the mounts:

- `68b1981` (2026-08-26) replaced `onClick={() => setIsQuizOpen(true)}` … "Pet Compatibility Quiz"
  with a `/needs` link.
- `112c78e` (PR #34) deleted the already-commented-out `setIsSponsorshipOpen(true)` "Sponsor Care"
  button and added the `/donate` link.

**Visitors lose nothing.** Both dialogs are also mounted by `Navbar` (rendered on every page from
`src/app/layout.tsx:102`; quiz at `Navbar.tsx:254,314`, sponsorship at `:264,326`) and by
`PetGallery`, whose header buttons render on `/` because they sit outside the `showFilters` blocks
(`PetGallery.tsx:121,131`). So `/` mounts three of each.

**The dead pair is not free.** A jsdom render of `<Hero />` with both closed produced no dialog nodes
but still read `hope_for_strays_pets_v1` twice and read then wrote
`hope_for_strays_donation_receipts_v1` — `usePetStore` via `usePetMatchQuizController.ts:21`, and
`useSponsorshipStore` (`sponsorshipStore.ts:29,43`). That those calls come from the dialogs rather
than another Hero import is reasoned from Hero's import list, not isolated.

**Deleting them is not obviously the fix.** `docs/archives/tasks/SPRINT_PLAN_BACKEND_AND_FRONTEND.md:189`
(FE-02) specifies hero buttons *Meet Our Animals*, *Pet Match Quiz* and *Sponsor Care*. What shipped
is pinned instead by `tests/components/home.test.tsx:153`, "routes to the three destinations the
sitemap requires" (`/pets`, `/donate`, `/get-involved`) — and no sitemap exists in the repo
(`grep -ri sitemap docs tasks` is empty). The spec on disk and the test disagree, and neither says why.

**Settles when:** either the Hero mounts and their state are deleted, or the FE-02 quiz and sponsor
buttons come back to drive them — with the choice, and the sitemap it rests on, written to
`tasks/decisions/`.
