# Nav and footer links point at home sections the page no longer renders

**Status:** open · opened 2026-09-18 · observed at `85ee351`

`1137d3e` ("chore(ui): update home page", 2026-09-02) took `HomeGalleryHeader`, `HomeProcessSection`
and `HomeCommunitySection` out of `src/app/page.tsx` and added `HomeQuickActionsSection`. All three
are still exported from `src/components/layout/HomeSections.tsx` (`:29`, `:267`, `:426`) and rendered
nowhere — `grep -rn "<HomeGalleryHeader\|<HomeProcessSection\|<HomeCommunitySection" src` is empty.
Their anchors left the page with them. The links into those anchors did not:

| Link | Label | Its id was declared in |
|---|---|---|
| `Navbar.tsx:53` → `/#how-it-works` | "Adoption Process & Criteria" | `HomeProcessSection` (`HomeSections.tsx:298`) |
| `Footer.tsx:54` → `/#how-it-works` | "Adoption Process & Fees" | same |
| `HomeSections.tsx:172` → `/#how-it-works` | the TNRM pillar's "Learn More", on `/` itself | same |
| `Footer.tsx:59` → `/#support` | "Volunteer & Foster Care" | `HomeCommunitySection` (`HomeSections.tsx:430`) |

Each lands at the top of `/` with nothing to scroll to. The ids `/` renders today are `adopt`,
`our-work` and `mission`. The same commit edited `Navbar.tsx` and `Footer.tsx` — it moved other links
to `/donate`, `/get-involved` and `/#faq` — so these four were in files it changed.

Reasoned, not observed: `Navbar.tsx:148` highlights the Adoption dropdown when
`pathname === "/#how-it-works"`, which cannot be true, because `usePathname()` returns no fragment.

Nothing in `tests/` or `e2e/` mentions these anchors, and no test checks that a `/#id` link resolves
to an id the home page renders.

**Settles when:** every `/#…` link in `src` targets an id that `/` renders — by remounting the
sections, pointing the links at a page that holds the content, or removing them — with a test
pinning it, and the three unrendered exports are either mounted or deleted.
