# Home page copy is duplicated outside the dictionary, and half the dictionary has no reader

**Status:** open · opened 2026-09-22 · counted at `b90304d`

`src/lib/i18n/translations.ts` is not the source of the home page's copy. Most sections inline
`isMs ? "…" : "…"` ternaries, and for several of them a fully translated key already exists and is
read by nothing. The two copies then drift, silently, because nothing compares them.

## Where it stands after 2026-09-22

`tasks/decisions/2026-09-22-home-anchors-remount-the-process-section-and-repoint-support.md` fixed
one instance — `HomeProcessSection`'s steps, which had to be settled because remounting the section
meant republishing its copy — and deleted eight keys orphaned by removing `HomeCommunitySection`.
It did not fix the rest, and picking one instance out of several is why this entry exists rather
than a claim that the problem is handled.

**Still duplicated and already diverged.** `HomeStandardsSection` (`HomeSections.tsx`), the function
immediately below the one that was fixed, inlines copy that `home.protocol1Title`…`protocol4Desc`
already hold in both locales, and they disagree:

| Key | Dictionary (ms) | Rendered (ms) |
|---|---|---|
| `protocol2Title` | "Polisi Adopsi 100% Percuma" | "Polisi Adopsi Percuma 100%" |
| `protocol3Title` | "Bimbingan & Jaminan Sepanjang Hayat" | "Bimbingan & Jaring Keselamatan" |

`protocol1Desc` differs by a whole clause. A translator editing any of these changes nothing on
screen.

**Duplicated across components.** `Navbar.tsx`'s brand tagline renders the hero's `<h1>` English
verbatim — "Coexistence through TNRM & Education" — while its Malay is a shortened form. Shortening
the English to match was tried on 2026-09-22 and reverted: it drops "& Education", one of the three
pillars `HomeOurWorkSection` names, which is a content decision and not a deduplication. Neither
copy is reachable by a translator.

**Keys with no reader.** After the eight deletions, roughly 14 of 24 `home.*` keys and 11 of 23
`bulletins.*` keys still have no reader anywhere in `src` — including `home.howItWorksSubtitle`,
and `bulletins.noBulletins`, which is a near-duplicate of the `bulletins.noUpdates` that does ship.
Someone editing either has no way to tell which one a visitor sees.

## Why a guard, not another sweep

The 2026-09-22 deletion was hand-picked: it removed the keys whose component had just been deleted
and left every other orphan in place. That does not prevent the next orphan, and the next sweep will
be equally arbitrary. `tests/unit/i18n.test.ts` checks only that `en` and `ms` carry the same keys —
it cannot see that a key has no consumer, and nothing scans JSX for literals that bypass one.

The diff that raised this already builds a compile-time key type (`BulletinKey` in
`BulletinFeed.tsx`), so the pieces for a structural guard exist.

**Settles when:** a test asserts every dictionary leaf has a reader in `src` — with an explicit,
justified allowlist for any key deliberately kept unused — and the copy that currently bypasses a
key either uses it or the key is deleted. Either outcome is fine; two copies is not.
