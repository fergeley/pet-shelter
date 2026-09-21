# Home page text stays English on the Malay site

**Status:** open · opened 2026-09-18 · inventory read at `85ee351`

Literals rendered on `/` that do not switch under `isMs`. `PetCard`'s `{pet.age}` is left out because
`ages-render-in-english-on-malay-site.md` already holds it.

| Where | Text | Nearest key that already exists |
|---|---|---|
| `src/app/page.tsx:53` | "Latest news and updates" (the h2, via `BulletinFeed`'s `title`) | `home.bulletinsTitle` — unused, worded "Shelter Bulletins & Updates" |
| `src/app/page.tsx:66` | "Loading rescue animals..." | `common.loading` ("Loading..." / "Memuatkan...") |
| `src/app/page.tsx:87` | "View All Animals" | `home.viewAllPets` — unused, worded "View All Adoptable Pets" |
| `src/components/layout/Hero.tsx:151` | "Coexistence through TNRM & Education" — **the page's h1** | none |
| `src/components/layout/Hero.tsx:221` | hero image `alt` | none |
| `BulletinFeed.tsx:33-39` | the five category chips | partial: `bulletins.filter*`, different wording |
| `BulletinFeed.tsx:189,214,254` | "Pinned", "Posted by:", the empty state | `bulletins.noBulletins` is close |
| `BulletinFeed.tsx:102,113,135,257` and the tooltips at `:119,223,232,241` | admin chrome | none — see `bulletins-are-a-per-browser-demo-anyone-can-edit.md` |

**Why the obvious fix is wrong.** `page.tsx` is a server component under `revalidate = 300`, and the
language is client state: `LanguageProvider.tsx:27-36` reads `localStorage["hope_for_strays_lang"]`.
The provider also writes a cookie of that name (`:67`) that nothing reads. Reading `cookies()` in the
page would make it render per request and give up ISR — the trade
`src/app/api/sponsor/pet-media/[petId]/route.ts:11-13` already declined. The strings have to move
into client components that call `t()`.

**Why nothing caught it.** `tests/unit/i18n.test.ts` checks only that `en` and `ms` carry the same
keys; nothing scans JSX for literals or reports unused keys, which is how the two home keys above
sat unused while the page hardcoded differently worded English beside them. `tests/components/home.test.tsx` asserts that Malay strings are present, never that
English is absent, and `page.tsx` is not rendered by any tier.

Site-wide, recorded here but not owned by this entry: the provider's server snapshot is always
`null` (`LanguageProvider.tsx:38-40`) and `src/app/layout.tsx:67-69` hardcodes `<html lang="en">`, so
every page's served HTML is English until hydration — which is what a crawler reads. And content
stored as data (bulletin `title`/`content`, pet `breed`/`description`/`tags`) has no Malay field at
all; that is a schema question, not a literal to translate.

**Settles when:** every row above renders Malay under `isMs`, pinned by a component test that
asserts the English string is absent — or a row is accepted as intentionally English and that
acceptance is written to `tasks/decisions/`.
