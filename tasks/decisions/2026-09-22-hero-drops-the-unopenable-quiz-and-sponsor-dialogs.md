# The hero drops the quiz and sponsorship dialogs instead of regrowing buttons for them

**Decided:** 2026-09-22

Settles `tasks/open/hero-mounts-a-quiz-and-sponsor-dialog-nothing-can-open.md`, which offered two
ways out: delete the mounts, or bring back the FE-02 buttons that used to drive them.

## The choice

`src/components/layout/Hero.tsx` no longer imports or mounts `PetMatchQuiz` and
`SponsorshipModal`, and `isQuizOpen`/`isSponsorshipOpen` are gone with them. The three CTA links
(`/pets`, `/donate`, `/get-involved`) are untouched. The `useState` import stays — `useCountUp`
uses it.

## Why, and what the open entry got slightly wrong

**Visitors lose nothing on `/`, but not by the route the entry names.** The entry credits `Navbar`
with mounting both dialogs "on every page". It mounts both, but only the quiz has a live desktop
trigger: the desktop sponsorship button at `Navbar.tsx:261-269` is a commented-out JSX block, so
`:264` is not live code. The sponsorship dialog is reachable from the Navbar only through the
mobile sheet (`:326-327`). What actually keeps sponsorship reachable on a desktop `/` is
`PetGallery`, whose header buttons sit at `:117-141`, outside the `showFilters &&` block that opens
at `:198` — so they render even with `showFilters={false}`. The conclusion holds; the citation
behind it did not, and a later reader deleting the PetGallery buttons would have taken the last
desktop trigger with them.

**`tests/components/home.test.tsx:153` does not decide this, either way.** The entry treats
"routes to the three destinations the sitemap requires" as what pins the shipped three-link layout
against FE-02. It does not. The test reads `getAllByRole("link")` and asserts `toContain` three
times — it is not exhaustive, and modal triggers are `<button>`, which never appear in a link
query. FE-02's buttons could have been restored without that test noticing. Anyone reversing this
decision should know the test is not the obstacle it looks like.

**The sitemap that test names exists nowhere.** `grep -ril sitemap` over `src/`, `tests/`, `e2e/`,
`public/`, `scripts/`, `docs/` and `tasks/` returns exactly one hit: the test's own name. There is
no `src/app/sitemap.ts` either. So the requirement the test claims to enforce is not written down
anywhere, and `docs/archives/tasks/SPRINT_PLAN_BACKEND_AND_FRONTEND.md:189` (FE-02) is the only
document that states a hero button set — naming *Meet Our Animals*, *Pet Match Quiz* and *Sponsor
Care*, which is not what shipped. The spec on disk and the shipped page disagree and neither cites
the other. Deleting the mounts does not resolve that disagreement; it only stops the page paying
for it.

**What the dead pair cost.** Both dialogs' stores are module-level, so mounting them ran
`usePetStore` and `useSponsorshipStore` on every homepage load. Deleting the mounts stops that.

## What is deliberately left behind

`hero.quizBtn` and `hero.sponsorBtn` stay in `src/lib/i18n/translations.ts` (en and ms), now
unused. They are the human-authored labels FE-02 would need, and deleting them would throw away a
Malay translation that a restore would have to re-commission. The whole `hero.*` namespace is
already unused — `Hero.tsx` branches on `isMs` inline rather than calling `t()` — so these two keys
join a pile rather than starting one.

## Verification

`tests/components/heroDialogMounts.test.tsx` mounts `Hero` with both dialog modules replaced by
recording stubs and asserts neither is invoked. It was run against the unfixed component first and
failed there (`Number of calls: 1`), then passed against the fix. A first attempt that spied on
`localStorage` instead **passed against the unfixed component** and was discarded: the stores read
their keys at module import, before any spy can be installed.
