# Target — Admin Status Write-back

**Date**: 2026-08-27
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 39 test files / 518 tests green · `npx tsc --noEmit` clean
**Predecessor commit**: `2514489 docs: record the ledger commit split as an optional target`

> **Scope**: records open item **P9** in the
> [TNRM & Rehabilitation Sprint handoff](HANDOFF_TNRM_REHABILITATION_SPRINT.md). Found while fixing
> [P7](TARGET_ADMIN_STATUS_PARITY.md) — P7 fixed what the admin table *displays*; this is what it
> displays after the server has said no.
>
> Line numbers read from source after the `src/lib/` restructure (`f75de27`), so they reflect the
> post-split layout.

---

## 1. 🔴 Why this is the next target

**The admin pet table can show — and persist — a status the database refused.**

`updatePetStatus` never throws. It catches everything and *returns* a result:

```ts
// src/actions/pets.ts:260-284
export async function updatePetStatus(id, status): Promise<{ success: boolean; error?: string }> {
  try { … await updateServerPet(id, updated, actor); return { success: true }; }
  catch (err: unknown) { return { success: false, error: msg }; }   // ← never rethrows
}
```

The caller treats it as though it does:

```ts
// src/hooks/usePetTableController.ts:123-132
const handleStatusChange = (id, newStatus) => {
  updatePetStatus(id, newStatus);                    // client store — writes localStorage
  setLocalPets(…);                                   // optimistic row update
  serverUpdatePetStatus(id, newStatus).catch((err) => // ← dead branch
    console.warn("Background server status sync:", err)
  );
};
```

`.catch` cannot fire, because a resolved promise carrying `{ success: false }` is not a rejection.
The return value is discarded. So when `validatePetTransition` rejects the move at
`src/lib/server/petRepository.ts:117`, three things happen and none of them are visible:

1. The database keeps the old status.
2. The row keeps rendering the new one.
3. `src/lib/client/petStore.ts:156-166` has already called `savePets(...)`, so the refused status is
   **written to `localStorage` and survives a reload**.

| Defect | Location | Consequence |
|---|---|---|
| Result discarded, `.catch` unreachable | `usePetTableController.ts:129-131` | A rejected transition is indistinguishable from a successful one |
| Optimistic write persists client-side | `client/petStore.ts:163` | The divergence outlives the page, so "refresh and see" does not correct it |
| Same swallow on the form path | `usePetTableController.ts:92-94` | Applies to `handleFormSubmit` too, for every field, not only status |

### This is live, not latent

The handoff entry called it latent because P7 constrained the row's quick-status `<select>` to legal
moves. That closes one of two routes. The other is open:

```tsx
// src/components/admin/PetFormDialog.tsx:316-318
<option value="Pending">Pending Application</option>
<option value="Adopted">Adopted (Happy Tail)</option>
<option value="In Rehabilitation">In Rehabilitation (Under Care)</option>
```

The edit form offers every status regardless of the animal's current one. `Adopted → Pending` is
illegal (`PET_TRANSITION_GRAPH.Adopted === ["Available"]`), reachable in two clicks today, and fails
exactly as described above — silently.

---

## 2. What already exists to reuse

The application table solved this. Nothing needs designing:

| Module | Provides |
|---|---|
| `src/hooks/useApplicationTableController.ts:31,47-57` | `statusError` state; `handleQuickStatus` inspects the result and calls `setStatusError` instead of discarding it |
| `src/components/admin/ApplicationDataTable.tsx:207-216` | The error banner UI — destructive surface, message, Dismiss button |
| `src/lib/domain/stateMachine.ts` | `getAllowedPetStatusTransitions(current)` — added in P7, already used by the row select |

---

## 3. ⚠️ The one real decision

**What happens to the optimistic row when the server refuses?**

- **(a) Surface an error, leave the row.** Matches the application table exactly. Cheapest, but the
  table still shows the refused status, so the two halves of the screen disagree with each other.
- **(b) Roll the row back, surface an error.** The row returns to the persisted status and the banner
  explains why. Requires capturing the previous status before the optimistic write and undoing both
  `setLocalPets` and the `petStore` write.
- **(c) Stop writing optimistically.** Await the action, then apply. Simplest to reason about; costs
  a round trip of latency on every status change, which is what the optimistic write was buying.

**(b) is recommended.** (a) leaves the defect's most visible symptom in place — the wrong status on
screen — and fixes only the silence. (c) is defensible but reverses a deliberate design choice for a
failure that should be rare; make it separately if the optimism is judged not worth its cost.

Note that (b) needs a rollback in `petStore` too, not only in `setLocalPets`, or the refused status
stays in `localStorage` and reappears on the next mount.

---

## 4. Step plan

1. Resolve §3.
2. Extend `usePetTableController` to inspect the result of `serverUpdatePetStatus`, mirroring
   `useApplicationTableController.handleQuickStatus`. Expose `statusError` / `setStatusError` on the
   controller's `state` and `handlers`.
3. Apply the §3 outcome — for (b), capture the prior status, and on `{ success: false }` restore both
   `setLocalPets` and the client store before setting the error.
4. Render the banner in `PetDataTable`, reusing the markup at `ApplicationDataTable.tsx:207-216`.
5. Do the same for `handleFormSubmit` (`:92-94`), which swallows `serverUpdatePet` identically. A
   rejected *edit* is the same class of bug and the same fix.
6. Constrain `PetFormDialog`'s status options with `getAllowedPetStatusTransitions(editingPet.status)`
   when editing, matching what the row select already does. This removes the live route; step 2 keeps
   the remaining ones honest.

Steps 2-4 are the bug. Steps 5-6 are the same defect on the other path and can land separately.

---

## 5. Acceptance criteria

- A rejected transition leaves **no** trace of the refused status: not in the row, not in
  `localStorage`, and the reason is on screen.
- The controller's result-handling is unit-testable in the node tier — assert that a
  `{ success: false }` result produces an error and leaves the pet list unchanged. Mock the action;
  the point is the caller's handling, not the server's decision.
- No `.catch()` remains attached to a Server Action that resolves with `{ success: false }` rather
  than rejecting. Grep `src/hooks/` for the pattern; `handleFormSubmit` is the other instance.
- `PetFormDialog` cannot offer a transition `validatePetTransition` would reject.
- `npx tsc --noEmit` clean, `npm run test:all` green, `npm run lint` no new warnings.

---

## 6. Out of scope

- **Making Server Actions throw instead of returning results.** The `{ success, error }` shape is the
  convention across `src/actions/`, and the application table consumes it correctly. The defect is the
  caller, not the contract.
- **Whether the admin table should use optimistic updates at all** — that is §3 option (c), and it is
  a performance/UX call worth making deliberately rather than as a side effect of a bug fix.
- **Render-level tests for the banner.** No `@testing-library/react` in the repo yet; that belongs to
  [Test Task 02](TEST_TASK_02_COMPONENT_AND_UI_SUITE.md). The controller logic is testable today
  without it, which is why criterion 2 is scoped to the hook.
