# Pending is a stage of the adoption track; Adopted is a track that offers nothing

**Decided:** 2026-09-10

The public catalogue was asked for "dual-track: Adoptable vs In Rehabilitation". `PetStatus` has
four canonical values, so two tabs cannot hold it, and the brief did not say where `Pending` and
`Adopted` go. This records the answer and the reasoning, because both are reversible and the next
person to look will not be able to infer either from the code.

## Where the grouping lives

Not in a tab list in a component. `PetStatusPresentation` — the record that already maps a status
to its tone, its label and its `isAdoptable`/`isInRehabilitation` flags — gained one field,
`track`. Everything else derives: the tab strip, its counts, the status options scoped inside it,
and the card's call to action. Adding a status means adding a `track:` line and touching no
component.

That shape was not invented here. `buildPetStatusFilterOptions` in the same file already existed,
already built filter options by counting over a supplied population, and its docstring already
said filter controls should derive from it "rather than hand-listing them, which is how
rehabilitation was omitted from the admin table's status filter in the first place." The admin
table obeyed it. The public gallery hand-listed three of the four statuses and omitted `Adopted` —
committing the exact defect the function was written after. So the task was finishing an
abstraction the repo had, not adding one.

## Pending → the adoptable track

An application under review is a stage of the adoption journey, not a section of the shelter. The
detail page had already settled this without saying so: its adopt button renders "Adoption
Pending" and stays put rather than disappearing. Filing Pending anywhere else would have made the
catalogue disagree with the page it links to.

Consequence accepted: `PetCard` renders a *disabled* button reading "Pending" for these animals.
That is a dead button on purpose — it reports queue position, and removing it would make Pending
indistinguishable from Available at a glance. Reverse this by giving Pending its own branch in
`PetCard`'s footer; the comment there names the choice so it is found.

## Adopted → its own track, carrying no action

Neither adoption nor sponsorship applies to an animal who has gone home, so `alumni` is not a
third thing to support — it is the absence of a support action, and the card renders no second
button at all. Before this, adopted animals appeared mixed into the default grid behind a
*disabled* "Adopted" button: the dead button `PetCard`'s own comment said the footer was shaped
to avoid.

They are still shown rather than hidden. A shelter's rehomed animals are the evidence the place
works, and the tab only exists when there are any — tracks are built from the population, so a
shelter that has never rehomed anyone is never offered an empty "Adopted" tab.

## The track filter defaults to "all", not "adoptable"

`PetGallery` also mounts on the home page without filter controls. A default of `adoptable` would
have silently hidden every animal under care there, with nothing on screen to explain it. One
default everywhere; the tab strip is additive.

For the same class of reason, `matchesTrackFilter` treats an unrecognised value as "all" rather
than failing closed: `?track=Adoptable` with the wrong case would otherwise empty the grid with no
tab marked active — a filter that hides everything and does not admit to being on.

## `/pets` stopped pre-filtering server-side

The page used to read the filter search params, narrow the query, and hand the result to a gallery
that narrowed it again from the same URL. The second pass is the one that matters — it re-runs on
every interaction — and the first actively breaks the new tab strip, because track and status
counts are computed over the population the gallery *receives*. Pre-narrowing to `?status=Pending`
would report every other track as empty and hide the tabs leading out of it.

So the page sends the whole public population. Marked with a `ceiling:` comment naming ~500
animals as the point to page it or move faceting to the server. It also declares
`export const dynamic = "force-dynamic"`, because dropping the `searchParams` prop would otherwise
have flipped the route to static prerendering silently — and a build that cannot reach the
database bakes the `pets.json` fixtures into the catalogue until the next revalidation
(`tasks/open/pets-json-fallback-empty-means-outage.md`).

## Not done, deliberately

`src/lib/domain/petProfiles.ts` was specified and was not created: its stated contents — rehab
progress, status badge — already live in `petStatusPresentation.ts`, and creating it would have
been the duplication AGENTS.md names as this repo's top defect shape. ISR cache tags were
specified and were not added: tagging a reader that serves fixtures on a zero-row count caches the
ambiguity, and that trigger is still an open question.
