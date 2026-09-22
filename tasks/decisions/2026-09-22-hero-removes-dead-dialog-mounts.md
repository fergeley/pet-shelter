# Hero removes dead dialog mounts and retains sitemap CTA links

**Decided:** 2026-09-22

Settles `tasks/open/hero-mounts-a-quiz-and-sponsor-dialog-nothing-can-open.md`.

## Decision

The inert mounts for `<PetMatchQuiz>` and `<SponsorshipModal>` and their unreferenced boolean state (`isQuizOpen`, `isSponsorshipOpen`) in `src/components/layout/Hero.tsx` are removed. The Hero component retains its three CTA navigation links (`/pets`, `/donate`, `/get-involved`).

## Why

1. **Visitors lose nothing:** Both `PetMatchQuiz` and `SponsorshipModal` are mounted globally on every page by `Navbar.tsx` (lines 254, 314, 264, 326) and on `/` by `PetGallery.tsx`.
2. **Eliminates unwanted side-effects:** Mounting the dialogs in `Hero.tsx` with initial `open={false}` still executed their controllers on component initialization, incurring unneeded `localStorage` reads (`hope_for_strays_pets_v1`) and writes (`hope_for_strays_donation_receipts_v1`) on the root route.
3. **Aligns with current test contracts:** `tests/components/home.test.tsx:153` ("routes to the three destinations the sitemap requires") explicitly tests navigation to `/pets`, `/donate`, and `/get-involved`. Reintroducing modal buttons would contradict the active component test suite.

## Verification

- `tests/components/home.test.tsx`: 10/10 tests pass, confirming all CTA links and Malay localized labels render without errors.
- `npm run typecheck`: clean.
