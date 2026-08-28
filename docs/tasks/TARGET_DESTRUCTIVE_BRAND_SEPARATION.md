# Target — Destructive Was a Third Red

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 52 test files / 697 tests green · `npx tsc --noEmit` clean · `npm run lint` 0 errors
**Predecessor**: `TARGET_LIGHT_PRIMARY_CONTRAST.md` §8.1, which recorded the collision this closes.

> **Scope**: `--destructive`. Darkening `--primary` for AA moved the brand into `--destructive`'s
> neighbourhood, and the fix turned out not to be "move destructive somewhere else" — it was that
> the palette had **two** hand-maintained reds meaning the same thing, and one of them could go.

---

## 1. 🔴 Why this was next

Darkening `--primary` to `#b2594f` fixed a real AA failure and cost something measurable:

| | ΔEok vs `--primary` |
|---|---|
| old `--destructive` `#b54043` vs old primary `#d77a6f` | 0.147 — clearly different |
| old `--destructive` `#b54043` vs **new** primary `#b2594f` | **0.049 — similar** |

`text-primary` has 121 call sites and `text-destructive` 55, all of them text on cream. At ΔEok 0.049
a destructive link reads as a primary one, which matters more than it sounds: the two mean opposite
things.

### 1.1 The actual defect was older than that

Laying the three reds side by side is what gave the fix away:

| token | hex | L | C | H |
|---|---|---|---|---|
| `--primary` (new) | `#b2594f` | 56.9% | 0.118 | 27.9° |
| `--destructive` | `#b54043` | 53.6% | 0.152 | 22.4° |
| `--tone-danger-text` | `#9f0712` | 44.5% | 0.177 | 26.8° |

`--destructive` sat **between the brand and the app's own danger tone** — ΔEok 0.049 from primary but
0.096 from `--tone-danger-text`. It was closer to the terracotta than to the colour this application
already uses to mean "rejected · urgent · negative".

So there were two separately maintained reds for the same idea. That is this repo's one recurring
defect shape, the same one behind the `dark:` overrides, the duplicated `settings.ts` palette and the
two halves of the receipt email: **one value written twice, kept in step by hand, until it is not.**

---

## 2. The decision, and why it is not a hue shift

`TARGET_LIGHT_PRIMARY_CONTRAST.md` §8.1 recommended pushing `--destructive` off the brand hue. That
would have worked — a sweep of the hue circle holding L and C reaches ΔEok 0.08–0.10 by 355°–350° —
but it invents a **third** red to sit between the other two, and leaves the duplication in place.

**Chosen instead: `--destructive` *is* `--tone-danger-text`.** It is strictly better on every axis
that was measured:

| light theme | before | after |
|---|---|---|
| ΔEok vs `--primary` | 0.049 | **0.138** — better than before primary was darkened |
| `text-destructive` on `--card` | 5.48:1 | **8.23:1** (AA → AAA) |
| distinct reds in the palette | 2 | **1** |
| call sites changed | — | **0** |

`--destructive-foreground` needed no change: `#fffdfb` on `#9f0712` is 8.23:1, and the dark pairing is
9.09:1.

### 2.1 A literal plus an assertion, not a `var()` alias

`--destructive: var(--tone-danger-text)` would be a true single source, and it was rejected. `:root`
holds literal values everywhere else — there is not one `var()` in it today — and the two guards that
parse these tokens would both need to resolve indirection.

More importantly, an assertion makes the coupling *visible*. With a `var()` alias, changing the danger
tone silently drags the destructive slot with it. With the assertion, that change fails the build and
someone has to answer "should destructive follow?" out loud. This is the same arrangement the email
hex mirror uses, and for the same reason.

---

## 3. What shipped

- `:root --destructive` `#b54043` → `#9f0712`; `.dark --destructive` `#f39aa4` → `#ffa2a2`. Both now
  equal their theme's `--tone-danger-text`.
- A new assertion in `designSystemGuards.test.ts` — *"keeps the destructive slot and the danger tone
  the same red"* — checking both themes through the same `cssColorToHex` the mirror uses, so an
  `oklch()` and a hex that describe the same colour compare equal.
- Verified to bite, both directions: reverting `--destructive` to `#b54043` fails, and moving
  `--tone-danger-text` while leaving `--destructive` behind fails.
- `npm run test:all` 52 files / **698 tests** green · `tsc` clean · lint 0 errors.

---

## 4. Acceptance criteria

1. ✅ `npm run test:all` green.
2. ✅ `npx tsc --noEmit` clean; `npm run lint` no new problems.
3. ✅ The new assertion verified to bite, by injection, in both directions.
4. ✅ Failure message names both tokens and both computed values.
5. ✅ No new dependency, no new token, no call site changed.

---

## 5. ⚠️ Still open: the dark theme has the same collision, and this does not fix it

**Picked up in [`TARGET_DARK_BRAND_SEPARATION.md`](TARGET_DARK_BRAND_SEPARATION.md)**, which
measured it properly: hue rotation does not fix it, lightness does, and the tone palette is healthy.

Measured while doing the above, and **not** addressed:

| dark theme | ΔEok |
|---|---|
| `--destructive` `#f39aa4` vs `--primary` `#eaa39b` (before) | 0.032 |
| `--destructive` `#ffa2a2` vs `--primary` `#eaa39b` (after) | **0.036** |

In dark mode the brand primary and the danger red are both light pinks about 0.03 apart — *closer
than the light theme's collision ever was*, and unifying destructive with the danger tone barely moves
it. Nothing in this change made it worse; it was already there, and it was invisible because the light
theme was the one being measured.

The fix is not in `--destructive`: it is that `.dark --primary` (`#eaa39b`) is a pink sitting on top
of the danger hue. Re-picking it is another brand-colour decision — the third in this sequence — so it
is recorded here rather than taken. It scores 8.34:1 on card, so it has headroom the light one did
not — but **not in the direction this section originally guessed**: the successor measured the hue
circle and found rotation tops out at ΔEok 0.075 even at 60°, where it is no longer the brand colour.
Lightness is the lever, not hue.

A contrast guard cannot catch this class of problem at all — two colours can both pass AA against the
background and still be indistinguishable from each other. If it is worth enforcing, the assertion is
a **minimum ΔE between tokens that mean different things**, which is a different guard from §8 of the
design-system doc and would want its own target.

---

## 6. Out of scope

- **Non-text contrast** — `TARGET_LIGHT_PRIMARY_CONTRAST.md` §3.2.
- **Dark-mode email** — `TARGET_EMAIL_COLOUR_PARITY.md` §3.2.
- **A ΔE guard** — §5 above.

---

## 7. ⚠️ Coordination — this branch has concurrent writers

Unchanged. During this task the other session committed `globals.css` twice while it was being
edited, once absorbing an injected test defect and then landing `f1717a3`, a commit whose message
describes fixing what was a transient test fixture.

- **Check `git diff --cached --name-only` in its own tool call before composing a commit.**
- **Commit with a pathspec**: `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`.
- **Keep every injection inside a single run-and-restore step**, and assert the restore. An injected
  defect left in the tree for one extra tool call is an injected defect in the branch history.
- `globals.css` is **CRLF** in the working tree — it was LF until a concurrent commit normalised it.
  Multi-line search strings written with `\n` match nothing and fail silently. `cat -A` did not show
  it; read the bytes.
