# Every gallery filter change is a server navigation, and fast typing may drop characters

**Status:** ASSERTED · opened 2026-09-16 · raised by the second review of PR #38, reasoned and not measured

`usePetGalleryController` writes each filter change with `router.replace(...)`, and `/pets` is a
dynamic route. In the App Router a `replace` to a dynamic route requests a fresh server render, so
each change — each keystroke in the search box — re-runs the page: `getPublicPets` (every pet,
with its updates and medical timeline joined) and both FAQ reads.

Since PR #38 that render no longer depends on the query string at all. The page used to narrow its
query by the search params; it now sends the whole public population, because the track tabs count
over animals the visitor is not currently filtered to. So the round trip is now pure cost: same
payload whatever was typed.

It is **not new**. The page was dynamic before PR #38 (it read `searchParams`) and the controller
used `router.replace` then too. It was not fixed in that PR because it changes the navigation
model, and none of it has been measured.

The search box is also controlled by the URL: its value is read back from `useSearchParams`, which
updates only when a navigation settles. A visitor typing faster than a round trip may have
characters overwritten by the settled value. PR #38 fixed the *deterministic* version of this —
search was trimmed before being written, so a typed space vanished and "golden retriever" could not
be entered at all — but not the timing one.

The reviewer's suggestion, not verified here: `window.history.replaceState`, which
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` describes as
keeping `useSearchParams` in sync without a server request. Weigh it against what a real
navigation gives: the back button and shareable URLs keep working either way, but prefetch and the
server-rendered first paint of a deep link do not depend on this path.

**A related cost on the home page.** `usePetGalleryController` calls `useSearchParams()`
unconditionally. Since PR #38, `syncUrl: false` — the home page's featured strip — ignores the URL
entirely, so that read is now pure cost there. Per the Next 16 API reference for
`useSearchParams`, calling it in a prerendered route client-renders the tree up to the nearest
Suspense boundary; `src/app/page.tsx` is prerendered (`revalidate = 300`), so the static HTML would
ship the strip's fallback instead of the featured animals. Pre-existing — the hook called it before
PR #38 too — and unmeasured. The likely fix is splitting the URL-synced and local controllers so
the home page never mounts the hook that reads the URL.

**Settles when:** someone measures a filter change on `/pets` — network tab, or a Playwright
request count — and either the round trip is confirmed and replaced (with a test that a typed
multi-word search survives fast input), or it is shown not to happen and this is deleted.
