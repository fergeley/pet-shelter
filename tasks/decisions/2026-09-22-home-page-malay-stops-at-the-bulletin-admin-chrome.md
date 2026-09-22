# The home page renders Malay everywhere except the bulletin admin chrome

**Decided:** 2026-09-22

Settles `tasks/open/home-page-text-stays-english-on-the-malay-site.md`. That entry allowed each row
of its inventory to be either translated or "accepted as intentionally English and that acceptance
written to `tasks/decisions/`". Every row is translated except one group, which is accepted here.

## Where the strings went

`src/app/page.tsx` is a Server Component under `revalidate = 300`, and the reader's language is
client state: `LanguageProvider` reads `localStorage`, and its `getServerSnapshot` returns `null`.
Reading the language cookie in the page would make it render per request and give up ISR — the
trade `src/app/api/sponsor/pet-media/[petId]/route.ts` already declined. So the three literals the
page rendered itself moved across the client boundary instead:

| Was | Now |
|---|---|
| `page.tsx` `<BulletinFeed title="Latest news and updates">` | prop dropped; `BulletinFeed` falls back to `t("home.bulletinsTitle")` |
| `page.tsx` Suspense fallback, "Loading rescue animals…" | `HomeGalleryLoading` in `HomeSections.tsx` |
| `page.tsx` "View All Animals" link | `HomeViewAllPetsLink` in `HomeSections.tsx` |

`Hero`'s `<h1>` and its image `alt` were already inside a client component and take inline `isMs`
ternaries, matching the five other ternaries in that file. They do **not** take dictionary keys:
the entire `hero.*` namespace is unused — `Hero` never calls `t()` — so adding keys there would
have grown a dead namespace rather than used a live one. `hero.title` in particular holds
different copy ("Adopt a dog or cat from your local shelter.") and is asserted on by
`tests/unit/i18n.test.ts`, so repurposing it would have broken a test to reuse a name.

## Which wording was kept, and why

Both unused keys the entry named are now used, with **the dictionary's wording, not the page's**:

- `home.bulletinsTitle` — "Shelter Bulletins & Updates" / "Buletin & Pengumuman Pusat
  Perlindungan". The page said "Latest news and updates".
- `home.viewAllPets` — "View All Adoptable Pets" / "Lihat Semua Haiwan Sedia Diadopsi". The page
  said "View All Animals".

Three reasons, in order of weight. The dictionary values already carry a human-authored Malay
string; keeping the page's wording would have meant commissioning new Malay for a phrase nobody
reviewed. `BulletinFeed`'s own default prop was already "Shelter Bulletins & Updates", so the page
was the only place disagreeing — this makes `/` agree with `/bulletins` and with the component.
And "View All Adoptable Pets" is the more accurate label for a link to `/pets`.

**This is a visible English copy change on `/`**, and it is the easiest thing here to reverse: edit
the two values in `src/lib/i18n/translations.ts` and the Malay follows.

One string deliberately did **not** reuse its nearest key. The entry suggested `common.loading`
("Loading…" / "Memuatkan…") for the gallery's "Loading rescue animals…". Using it would have
narrowed the English from a specific label to a generic one — a visible regression on the English
site in order to fix a Malay bug. A new `home.galleryLoading` carries the specific wording in both
languages instead, and `common.loading` remains unused.

## The heading prop takes a key, not a string

`BulletinFeed`'s `title?: string` became `titleKey?: BulletinKey`, a template type over
`keyof TranslationDictionary["bulletins"]`. Every caller is a Server Component that cannot resolve
its own heading without giving up ISR, so each hands over a key and the feed — already a client
component — resolves it. `/bulletins` passes `bulletins.allNoticesTitle`, `/pets` passes
`bulletins.petsFeedTitle`, `/` passes nothing and gets `home.bulletinsTitle`.

This was not in the entry's inventory. It became necessary *because of* the rest of this change:
once the chips, byline and empty state around those two feeds rendered Malay, an English string
literal above them left `/bulletins` and `/pets` in a worse mixed-language state than before. A
change that improves one page by degrading two is not an improvement.

The same typing rule applies to the category chips. `labelKey` is a `bulletins.*` template type
rather than `string`, so renaming a key is a compile error instead of a chip silently falling back
to English on the Malay site. **No `t()` call in `BulletinFeed` passes an English fallback**:
`LanguageProvider` already falls through to the `en` dictionary when a key is missing from the
active one, so a literal argument could only ever be a second copy of the label — unreachable, and
free to drift from the one a translator edits.

## What stays English: the bulletin admin chrome

Everything gated on `isAdminMode` in `BulletinFeed.tsx` keeps its English literal:

`Post Update / Media` · `title="Reset to sample announcements"` · the "Admin Editing Mode…" banner ·
`title="Unpin notice"` / `"Pin notice to top"` · `title="Edit bulletin"` · `title="Delete bulletin"` ·
`Post First Update`

Because `tasks/open/bulletins-are-a-per-browser-demo-anyone-can-edit.md` settles by deleting it.
Its settle condition is a server-side store behind a `MANAGE_CONTENT`-guarded action "with the
public toggle gone — or the feeds come off the public pages until they do". Either branch removes
this editor. Translating it now would commission Malay for copy that entry deletes, and would
polish a control that is itself the defect: that toggle has no session check, so every visitor gets
it and it works.

The line drawn is **what a visitor sees before clicking anything**. That includes the toggle's own
label, so `Staff Admin Access` *is* translated, along with the category chips, `Pinned`,
`Posted by:` and the empty state. `Admin Mode Active` is translated only because it is the other
branch of the same ternary; splitting a ternary across two policies would be worse than either.

A comment at the `isAdminMode` block in `BulletinFeed.tsx` points here, so the next reader does not
"finish the job" by hand.

## Not in scope, and still true

- **`<html lang>` is hardcoded `"en"`** in `src/app/layout.tsx`, site-wide. Every page's served
  HTML is English until hydration, because the server cannot know the language — which is what a
  crawler reads, and what a screen reader announces the language of. Translating the `<h1>` makes
  this worse in one narrow sense: the document now declares English over Malay text. Fixing it is a
  different change from this one, and the entry recorded it as not owned by itself.
- **Bulletin and Pet content columns have no Malay field.** `title`, `content`, `breed`,
  `description` and `tags` are single-column English. That is a schema question, not a literal.
- **`/pets` and `/bulletins` still have untranslated chrome of their own**, outside this entry's
  inventory. Their `BulletinFeed` headings are no longer part of it — see "The heading prop takes a
  key" above — but the rest of each page is unchanged.

## Verification

`tests/components/homeMalay.test.tsx`, 18 cases. Every Malay case asserts the **English is absent**
rather than that the Malay is present, which is the gap the entry names: the existing
`home.test.tsx` asserted presence and passed for sixteen days beside a hardcoded English `<h1>`.
Two further cases pin the English side, because an inverted `isMs` would satisfy every Malay
assertion at once.

Run against the components before this change, 12 of the then-17 failed. The five that passed were
the two new components (which did not exist), the heading-prop guard, and the two English cases —
exactly the set that should not have moved.

The image `alt` is read from the attribute, not by text: `queryByText` cannot see an `alt` at all,
which is how that string stayed English while a Malay hero test passed next to it.
