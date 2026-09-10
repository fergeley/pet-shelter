# Making a field persist can turn a harmless bug destructive

**Learned:** 2026-09-03

The admin settings form seeds from a `localStorage`-backed store. That was
survivable while `updateShelterSettings` wrote to a module-level variable —
nothing persisted, so nothing could be lost. The moment the QR fields reached
real columns, a second admin on a browser that had never uploaded them would
open the page with empty inputs and blank the saved codes on save.

When you make a field persist, audit every path that *seeds* the form. A
previously write-only field has no loading path, and the absence is invisible
until it deletes something.
