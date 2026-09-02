---
description: Wire PetsFaqSection and RehabNeedsSection to the derived category readers instead of their hardcoded tab lists
---

Wire two components to the category readers that already exist but nothing consumes.

Read `docs/architecture/WHERE_CODE_GOES.md` first. Full background:
`docs/tasks/TARGET_RESTRUCTURE_FOLLOWUPS.md` §1.

## What exists

- `src/lib/server/faqCatalog.ts:72` — `getServerFaqCategories()`
- `src/lib/server/rehabNeedsCatalog.ts:77` — `getServerRehabCategories()`

Both return only the categories actually **populated** in the fixtures, which is the point: the
`FAQ_CATEGORIES` / `REHAB_NEED_CATEGORIES` Zod enums list all seven, so a tab built from those can
filter to nothing.

## What is hardcoded

- `src/components/layout/PetsFaqSection.tsx:9` — `FAQ_CATEGORY_TABS`
- `src/components/features/needs/RehabNeedsSection.tsx:23` — `CATEGORY_TABS`

## Four things that will bite you

1. **Both components are `"use client"` and MUST NOT import `@/lib/server/*`.**
   `tests/unit/layerBoundaries.test.ts` fails CI on it. This is the correct constraint — do not
   weaken the guard or route around it.
2. **Their parents are Server Components already passing data down.**
   `src/app/pets/page.tsx:70` passes `initialFaqs`; `src/app/needs/page.tsx:35` passes
   `initialNeeds`. Pass `initialCategories` the same way. **Do not add a Server Action.**
3. **Shape mismatch.** The readers return `{ category, labelEn, labelMs }`; the tabs use
   `{ value, labelEn, labelMs }`.
4. **The `"all"` tab is not in the data.** Both hardcoded lists open with
   `{ value: "all", labelEn: "All Topics", labelMs: "Semua Topik" }`. The readers derive from
   fixture rows and can never produce it — prepend it in the component. Dropping it is the
   quietest way to break this. Confirm the `"all"` filter still works after your change.

Bilingual labels come from the fixture rows (`categoryLabel` / `categoryLabelMs`), **not** the i18n
dictionary. The `"all"` label is the exception and has no fixture row — say where you sourced it.

## Verify

```bash
npx tsc --noEmit
npx vitest run --project unit tests/unit/faqs.test.ts tests/unit/rehabNeeds.test.ts tests/unit/layerBoundaries.test.ts
```

Full-suite baseline: 41 files / 524 tests.

Then **run the app and look at both tab strips**. This is UI — green tests do not prove a tab
renders. Report what you actually saw.
