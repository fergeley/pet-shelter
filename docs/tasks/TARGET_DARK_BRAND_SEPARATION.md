# Target — In Dark Mode the Brand and the Danger Red Are the Same Colour

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 52 test files / 698 tests green · `npx tsc --noEmit` clean · `npm run lint` 0 errors
**Predecessor**: `TARGET_DESTRUCTIVE_BRAND_SEPARATION.md` §5, which measured this and did not take it.

> **Scope**: one token — `.dark --primary`. It was the last open item in the colour stream, and the
> obvious fix (rotate the hue) **does not work**. The numbers below say why, and what does.
>
> **✅ Done 2026-08-29 — see §8.** The stream is closed.

---

## 1. 🔴 The finding, and how small it is

`.dark --primary` (`#eaa39b`) and `.dark --destructive` (`#ffa2a2`) are **ΔEok 0.036** apart. They are
both pale pinks, they mean opposite things, and a destructive control in dark mode is close to
indistinguishable from a primary one.

For scale: the light theme sits at **0.138** for the same pair, and 0.049 — a third of that — was
judged bad enough to act on in the predecessor.

**This is not a systemic problem.** A full sweep of both themes was run before writing this, so the
next session does not have to repeat it:

| group | closest pair | median |
|---|---|---|
| light — 7 tone `text`s (21 pairs) | 0.071 warning/danger | 0.244 |
| light — 7 tone `accent`s (21 pairs) | — | 0.253 |
| dark — 7 tone `text`s (21 pairs) | 0.077 care/highlight | 0.177 |
| dark — 7 tone `accent`s (21 pairs) | 0.107 care/highlight | 0.222 |
| **dark — `--primary` vs `--destructive`** | **0.036** | — |

The seven-tone palette is healthy in both themes. The only pair that is both *too close* and
*semantically opposed* is this one. Everything else that measures close is deliberately the same
family — `--ring` (0.068) and `--accent` (0.069) are supposed to look like `--primary`.

### 1.1 It is pre-existing

Nothing in the recent colour work caused this. It was there before, and was invisible because the
light theme was the one being measured. Unifying `--destructive` with the danger tone moved it from
0.032 to 0.036 — no material change either way.

---

## 2. ⚠️ Hue rotation does not fix it — do not start there

The predecessor's instinct, and the obvious move, is to rotate `.dark --primary` away from the danger
hue. It was measured across the whole sweep and it **fails**:

| `.dark --primary` hue | ΔEok vs destructive |
|---|---|
| 26.4° (today) | 0.036 |
| 40° | 0.050 |
| 50° | 0.062 |
| 60° — visibly orange, no longer the brand | 0.075 |

Rotating the brand colour until it stops being the brand colour still lands at half the light theme's
separation. The reason is that both colours sit at L ≈ 78–80% with chroma ≈ 0.09–0.11: near the top of
the lightness range everything pale converges, and hue has little perceptual room left.

**Lightness is the lever.** Holding the brand hue and dropping L:

| L | hex | ΔEok vs destructive | as text on `--card` | dark ink on it |
|---|---|---|---|---|
| 78% (today) | `#eaa39b` | 0.036 | 8.34:1 | 8.48:1 |
| 70% | `#cf8a82` | 0.108 | 6.21:1 | 6.32:1 |
| **66%** | **`#c17e76`** | **0.148** | **5.32:1** | **5.41:1** |
| 62% | `#b4726a` | 0.187 | 4.54:1 | 4.62:1 |
| 58% | `#a7665f` | 0.227 | 3.84:1 | ❌ below AA |

**Recommended: `oklch(66% 0.086 26.4)` = `#c17e76`.** It reaches 0.148 — slightly better than the
light theme's 0.138 — while keeping ~15% headroom over AA on both constraints. Hue and chroma
unchanged, so it is the same terracotta.

Note the two-sided constraint: in dark mode `--primary` is used both as text (`text-primary` on
`--card`) and as a fill (`--primary-foreground` `#221718`, dark ink, on it). Both ratios fall together
as L drops and both reach AA at about L 62%, which is why 66% rather than lower.

### 2.1 A side benefit worth naming

`.dark --primary` at `#eaa39b` had drifted *pale* — it is a pink, while the light theme's brand is a
terracotta. Pulling it to `#c17e76` moves it back toward the same family as `:root`'s `#b2594f`. This
fix improves brand fidelity between themes as well as fixing the collision.

---

## 3. The decision

This is the third brand-colour change in the sequence, and like the other two it needs a person:
`docs/design-system.md` §9 puts choosing colours outside what a test can judge.

1. **`#c17e76` (recommended)** — one line, ΔE 0.148, AA with headroom, better brand fidelity.
2. **Move `.dark --destructive` instead** — it is pinned to `--tone-danger-text` by an assertion
   (`TARGET_DESTRUCTIVE_BRAND_SEPARATION.md` §2.1), so this means moving the whole dark danger tone.
   Larger blast radius, and the danger tone is currently well separated from the other six.
3. **Accept it** — dark mode is a minority of sessions and destructive actions carry icons and labels.
   Cheapest; record it and move on.

---

## 4. Step plan

1. **Get the decision.** Nothing below can start without it.
2. Change `.dark --primary` — and `--primary-hover` with it, preserving its ΔL (today `#f0b0a8`, which
   is *lighter* than primary; keep that relationship or state why it changed).
3. Re-check `--ring` and `--accent` in `.dark`: both are deliberately near `--primary`, so if primary
   moves 12 lightness points and they do not, the brand family stops looking like a family. Measure
   before deciding — they may be fine, they may want the same shift.
4. Run the contrast guard. `.dark --primary` is checked in both directions, so an over-darkened value
   fails the build rather than shipping.
5. **The email mirror does not need regenerating** — it mirrors `:root` only, by design
   (`TARGET_EMAIL_COLOUR_PARITY.md` §3.2).
6. Update `docs/design-system.md` §1.1 if it names a value.

---

## 5. The guard question, and why the naive version is wrong

`TARGET_DESTRUCTIVE_BRAND_SEPARATION.md` §5 floated "assert a minimum ΔE between tokens". Before
anyone writes it: **a blanket "all token pairs ≥ X" guard fails immediately.** `--ring` is 0.068 from
`--primary` and `--accent` is 0.069, in both themes, *on purpose* — they are one brand family, and a
guard that reds them turns into a guard people delete.

A useful version needs an explicit list of pairs that mean **different** things — roughly: brand vs
each semantic tone, and the tones against each other. That list is a design statement, not a
derivation, so it belongs in the same place `TONES` and `SLOTS` already live, with the same reasoning
written next to it.

Worth knowing before committing to it: the sweep in §1 says such a guard would find **nothing today**
except the pair this target fixes. It is insurance against a future regression, not a way to discover
existing bugs — price it accordingly.

The maths is already in `tests/support/oklch.ts`: `parseCssColor` + `compositeOver` give an opaque hex
per token, and OKLab ΔE is `Math.hypot` over the three components. The scratch sweep used for §1 is
~40 lines.

---

## 6. Out of scope

- **Non-text contrast** — `TARGET_LIGHT_PRIMARY_CONTRAST.md` §3.2.
- **Dark-mode email** — `TARGET_EMAIL_COLOUR_PARITY.md` §3.2. The mirror is light-only by design.
- **The tone palette** — measured healthy in both themes (§1); leave it alone.

---

## 7. ⚠️ Coordination — this branch has concurrent writers

Every colour change in this stream was committed by the other session under its own message before
this one could commit it. That is not a problem to fix, but it changes how you work:

- **Check `git diff --cached --name-only` in its own tool call before composing a commit.** The index
  routinely holds the other session's in-flight work.
- **Commit with a pathspec**: `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`.
- **Keep every injection inside a single run-and-restore step, and assert the restore.** An injected
  defect left in the tree for one extra tool call got committed, and then "fixed" by the other session
  in `f1717a3` — a commit whose message describes repairing a test fixture that never existed.
- **`globals.css` is CRLF** in the working tree; it was LF until a concurrent commit normalised it.
  Multi-line search strings written with `\n` match nothing and fail *silently*. `cat -A` did not
  reveal it — read the bytes.
- **Re-measure before quoting any number in this document.** Every figure here was computed on the
  date in the header, against `globals.css` as it stood; the predecessor's headline numbers were
  already stale when its work began.

---

## 8. Outcome

**Done.** `.dark --primary` `#eaa39b` → **`#d17469`**, `--primary-hover` `#f0b0a8` → `#dc7e73`.

| dark theme | before | after |
|---|---|---|
| ΔEok `--primary` vs `--destructive` | 0.036 | **0.146** — now slightly better than light's 0.138 |
| `text-primary` on `--card` | 8.34:1 | 5.21:1 ✅ |
| `--primary-foreground` on `--primary` | 8.48:1 | 5.30:1 ✅ |

`npm run test:all` 54 files / **713 tests** green · `tsc` clean · lint 0 errors. The contrast guard
was verified to bite on an over-darkened value (L 58%, which drops `text-primary` to 3.84:1).

### 8.1 Not the value §2 recommended, and why

§2 proposed `#c17e76` — hold this theme's own hue and chroma, move only lightness. What shipped
instead holds **`:root`'s** hue and chroma (27.9°, 0.118) and picks lightness for the dark ground:

| | ΔE vs destructive | on card | ΔE vs light `--primary` |
|---|---|---|---|
| §2's `#c17e76` (dark's own H/C) | 0.148 | 5.32:1 | 0.097 |
| shipped `#d17469` (light's H/C) | 0.147 | 5.21:1 | **0.090** |

Numerically it is a wash. The reason to prefer it is that it states something true: **there is one
brand colour, and a theme chooses its lightness, not its hue.** That is the rule the token layer is
already built on — `TARGET_LIGHT_PRIMARY_CONTRAST.md` §1.2 leaned on it to argue the light theme's
fix — and `.dark --primary` was the one token breaking it, sitting at its own hue with two thirds of
the chroma. §2's value would have fixed the collision while preserving that drift.

So the change is smaller than it looks: not "pick a new dark primary" but "stop the dark primary
being a different colour".

### 8.2 What was checked and deliberately left alone

- **`--accent`** (`#d78d7c`) stays in the family: ΔEok 0.060 from the new primary, was 0.069.
- **`--ring`** (`#f2bea7`) moves from 0.068 to 0.191 away — and that is an **improvement**. The focus
  border on a primary button was previously near-invisible against its own fill; it now contrasts
  with both the button and the background (11.21:1 on `--background`).
- **The email mirror** was not touched, correctly: it mirrors `:root` only, by design
  (`TARGET_EMAIL_COLOUR_PARITY.md` §3.2).
- **The ΔE guard** of §5 was not built. The sweep in §1 said it would find nothing today beyond the
  pair this target just fixed, and a blanket version would red `--ring` and `--accent` on day one.
  Left as recorded insurance, not built speculatively.
