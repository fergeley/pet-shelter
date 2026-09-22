# The home page remounts its adoption-process section and sends /#support to /get-involved

**Decided:** 2026-09-22

Settles `tasks/open/nav-links-point-at-home-sections-the-page-no-longer-renders.md`.

## The choice, per dead export

`1137d3e` took three components out of `src/app/page.tsx` and left four links pointing into their
anchors. They are not one problem, and they do not get one answer.

| Export | Disposition | Why |
|---|---|---|
| `HomeProcessSection` (`#how-it-works`) | **Remounted on `/`** | Three links want it and the content exists nowhere else |
| `HomeCommunitySection` (`#support`) | **Deleted**; its one link repointed | `/get-involved` already holds the same content, better |
| `HomeGalleryHeader` | **Deleted** | It was `return null` |

`Footer.tsx:59` now points at `/get-involved#volunteer`. `Navbar.tsx:53`, `Footer.tsx:54` and
`HomeSections.tsx:161` keep `/#how-it-works`, which resolves again.

## Why `#how-it-works` was remounted rather than repointed

The open entry's own framing — and the brief that carried it — preferred pointing links at content
that exists over "remounting sections nobody has missed". That works for `#support` and is what was
done there. It is not available for `#how-it-works`, because **no adoption-process content with an
id exists anywhere else in `src`**. The candidates were checked:

- `/adopt` is the application wizard. It has no `id=` on any element, it is `max-w-3xl` centred
  around a form, and **nothing in `src` links to it** (`grep -rn '"/adopt"' src` is empty). Mounting
  a full-width marketing section there, or pointing "Adoption Process & Criteria" at a form, would
  trade a broken anchor for a misleading one.
- `/faq` renders `FaqBrowser`, whose only id is `faq-search`. `PetsFaqSection`'s `id="faq"` renders
  only on `/pets`.

`HomeProcessSection` holds the three-step journey in both languages, is styled as a home section
(`border-t`, `max-w-7xl`), and its id is the one all three links already name. Restoring it costs
an import and a line, and changes no link. It goes back in its original slot — between the `#adopt`
gallery and `HomeStandardsSection` — which is where `1137d3e` removed it from.

That commit is titled "chore(ui): update home page" and left four links behind pointing into what it
removed. Leaving the links is the evidence that the removal was not a considered decision *about
those links*; it is not evidence that the section was wanted back. Anyone who does want the home
page shorter should delete the section and the three links together, which is now one guard failure
away from being obvious.

## What `#support` gains by moving

`HomeCommunitySection` and `/get-involved` both covered volunteering and fostering.
`/get-involved` covers more (`#volunteer`, `#foster`, `#corporate`, `#partnerships`), is already
linked from `Navbar.tsx:76,82,88,94`, and each of its sections carries `scroll-mt-24`. `/` also
still routes there: `HomeQuickActionsSection`'s "Volunteer" card links `/get-involved`. So deleting
the duplicate removes a second copy rather than a capability.

## Two things fixed in passing, and one deliberately not

- **`Navbar.tsx:148` compared `pathname` to `"/#how-it-works"`.** `usePathname()` returns no
  fragment, so that clause could never be true. Dropped rather than reimplemented: making the
  Adoption dropdown highlight on a fragment needs a `hashchange` listener, which is a lot of
  machinery for a font weight. The remaining `pathname.startsWith("/applications")` is unchanged.
- **`#how-it-works` gained `scroll-mt-24`.** The header is `sticky top-0`, and no home section
  declares a scroll offset, so an anchor lands under it. After this change `#how-it-works` is the
  only id on `/` that anything links to, so it is the only one where the offset is observable.
- **`#adopt`, `#our-work` and `#mission` still have no `scroll-mt`.** Nothing links to them, so
  nothing scrolls to them. Left alone rather than swept up.

## The guard, and what it cannot see

`tests/unit/homeAnchors.test.ts` walks down from `page.tsx`'s render tree, attributing each id to
the *component* that declares it, and asserts every `/#id` in `src` resolves. Attribution by
component rather than by file is the point: `#how-it-works` and `#support` live in the same file as
three sections that were always mounted, so a file-level scan would have called both fine — which is
`tasks/lessons/2026-09-18-a-grep-for-an-anchor-id-proves-it-is-declared-not-rendered.md` happening
again.

Run against the tree before this change, it named all four links from the open entry, at the lines
the entry gives. Its ceiling is in the file: it does not evaluate conditionals, so it over-accepts.
It also only counts ids on landmark elements, so an anchor added to a `<span>` would be rejected —
move it to a `<div>` or `<section>`.
