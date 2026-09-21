# A grep for an anchor's id proves it is declared, not that the page renders it

**Learned:** 2026-09-18

Asked what was pending on the home page, a session checked the footer's `/#support` link with a
grep for `id="support"`, found it at `src/components/layout/HomeSections.tsx:430`, and told the user
the link worked. It did not. `HomeCommunitySection`, the component declaring that id, had been
taken out of `src/app/page.tsx` by `1137d3e` two weeks earlier and was rendered nowhere. So had
`HomeProcessSection`, the home of `/#how-it-works`, which three more links still target. A parallel
investigation that started from `page.tsx`'s imports caught it, and the correction reached the user
a turn late — after they had been told the opposite. Filed as
`tasks/open/nav-links-point-at-home-sections-the-page-no-longer-renders.md`.

The grep was not wrong about what it found. It answered "is this id written down anywhere", and the
question was "does the page a visitor lands on contain it". An exported component matches its own
name, and a declared id matches itself, whether or not anything mounts them.

**Rule:** prove a link resolves by walking down from the target page's render tree — what does its
`page.tsx` import, and what does it actually render — not up from the id. To ask whether a component
is used, grep for its JSX (`<HomeCommunitySection`), never its name.
