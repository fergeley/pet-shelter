# The trap a brief warns you about can be wrong in the brief

**Learned:** 2026-08-28

`/fix-category-tabs` spent a numbered trap on the "all" tab: do not drop it, losing it is the
quietest way to break this. The same paragraph then gave one literal tab for both components —
`"All Topics"` / `"Semua Topik"` — and `RehabNeedsSection` actually said `"All Wishlist Items"` /
`"Semua Barangan Keperluan"`. Following the warning literally would have committed the exact silent
relabel it was written to prevent. The brief also framed the defect as dead tabs when the category
sets were already right and 7 of 9 *labels* had drifted.

**Rule:** a brief's warnings are claims about the tree, with the same status as its file paths — read
the values out of the source before trusting either. Being told where the trap is does not mean the
sentence naming it is accurate.
