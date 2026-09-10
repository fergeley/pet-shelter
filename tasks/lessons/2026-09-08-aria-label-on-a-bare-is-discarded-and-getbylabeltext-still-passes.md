# `aria-label` on a bare `<span>` is discarded, and `getByLabelText` still passes

**Learned:** 2026-09-08

To keep a count-up animation from being announced frame by frame, I put the settled figure in an
`aria-label` on the wrapping `<span>` and marked the climbing digits `aria-hidden`. A `span` has no
role, so it maps to `role=generic`, which prohibits naming — the label is dropped and the only other
copy was hidden. All five figures left the accessibility tree entirely, which is worse than the
plain text they replaced.

The test agreed with the bug. RTL's `getByLabelText` matches the `aria-label` *attribute*
regardless of whether the element's role can carry a name, so my assertion passed against markup no
screen reader could read. The fix is an `sr-only` sibling holding the real value — real text, in
the tree, next to `aria-hidden` decoration.

**Rule:** `aria-label` needs an element whose role supports naming. On a decorative wrapper, use a
visually-hidden text node instead. And never let an attribute-matching query stand as proof of an
accessibility contract — it tests the attribute you wrote, not what a user is given.
